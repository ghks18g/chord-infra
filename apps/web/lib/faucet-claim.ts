import { ethers } from 'ethers';

export const CHORD_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 7613);
export const FORWARDER_ADDRESS = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS || '0x34ec2b8950c43c126d8e7f57dd67d3f134ea1933';
export const FAUCET_ADDRESS = process.env.NEXT_PUBLIC_FAUCET_ADDRESS || '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6';

export const EIP712_DOMAIN = {
  name: 'ChordForwarder',
  version: '1',
  chainId: CHORD_CHAIN_ID,
  verifyingContract: FORWARDER_ADDRESS,
};

export const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
};

export interface FaucetClaimResult {
  success: boolean;
  message: string;
  txHash?: string;
}

/**
 * Executes a Gasless Meta-Transaction claim on ChordFaucet via ChordForwarder (EIP-712 + EIP-2771).
 * Requires 0 CHOR in user wallet.
 */
export async function executeGaslessFaucetClaim(
  provider: any,
  userAddress: string
): Promise<FaucetClaimResult> {
  try {
    if (!userAddress || !provider) {
      return { success: false, message: '지갑이 연결되지 않았습니다.' };
    }

    const browserProvider = new ethers.BrowserProvider(provider);
    const signer = await browserProvider.getSigner();

    // 1. Fetch current user nonce from relayer
    let nonce = 0;
    try {
      const nonceRes = await fetch(`/api/relayer/nonce/${userAddress}`);
      if (nonceRes.ok) {
        const nonceData = await nonceRes.json();
        if (typeof nonceData?.nonce === 'number') {
          nonce = nonceData.nonce;
        }
      }
    } catch {
      // fallback
    }

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity

    // 2. Prepare Typed Data
    const message = {
      from: ethers.getAddress(userAddress),
      to: ethers.getAddress(FAUCET_ADDRESS),
      value: 0n,
      gas: 100000n,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline),
      data: '0x4e71d92d', // claim() selector
    };

    // 3. User signs EIP-712 ForwardRequest (0 Gas)
    const signature = await signer.signTypedData(
      EIP712_DOMAIN,
      FORWARD_REQUEST_TYPES,
      message
    );

    // 4. Send to Relayer Service to dispatch with sponsor gas
    const dispatchRes = await fetch('/api/relayer/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: userAddress,
        to: FAUCET_ADDRESS,
        value: '0',
        gas: '100000',
        nonce,
        deadline,
        data: '0x4e71d92d',
        signature,
      }),
    });

    const dispatchData = await dispatchRes.json();

    if (!dispatchRes.ok || !dispatchData.success) {
      return {
        success: false,
        message: dispatchData.message || '가스리스 Faucet Claim에 실패했습니다.',
      };
    }

    // Wait for block finality and transaction indexing (up to 6 seconds)
    if (dispatchData.txHash) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 600));
        try {
          const rcRes = await fetch(`/api/txs/${dispatchData.txHash}`);
          if (rcRes.ok) {
            const rcData = await rcRes.json();
            if (rcData?.status === 'SUCCESS' || rcData?.blockHeight) {
              break;
            }
          }
        } catch {
          // continue waiting
        }
      }
    }

    return {
      success: true,
      message: 'Faucet Claim 완료! 10 CHOR가 정상 지급되었습니다.',
      txHash: dispatchData.txHash,
    };
  } catch (err: any) {
    if (err?.code === 4001 || err?.action === 'signTypedData') {
      return { success: false, message: '사용자가 서명을 취소했습니다.' };
    }
    return {
      success: false,
      message: err?.message || 'Faucet Claim 도중 오류가 발생했습니다.',
    };
  }
}
