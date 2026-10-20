/**
 * Helper to add the Chord network to the currently connected Web3 wallet (MetaMask, etc.)
 * using standard EIP-3085 (wallet_addEthereumChain).
 *
 * @param customProvider The specific provider from the active wagmi connector (connector.getProvider())
 *                       Passing this avoids conflicts when multiple wallet extensions (e.g. Core, MetaMask)
 *                       are installed simultaneously in the user's browser.
 */
export async function addChordNetworkToWallet(
  customProvider?: any
): Promise<{ success: boolean; message: string }> {
  let targetProvider = customProvider;

  if (!targetProvider && typeof window !== 'undefined') {
    const eth = (window as any).ethereum;
    if (eth?.providers && Array.isArray(eth.providers)) {
      // Prioritize pure MetaMask provider if present among multiple injected extensions
      const mm = eth.providers.find(
        (p: any) => p.isMetaMask && !p.isAvalanche && !p.isCore
      );
      targetProvider = mm || eth.providers[0];
    } else {
      targetProvider = eth;
    }
  }

  if (!targetProvider || typeof targetProvider.request !== 'function') {
    return {
      success: false,
      message: 'No active Web3 wallet provider found. Please connect your wallet first.',
    };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://scan.chordchain.space';
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ||
    (origin.includes('chordchain.space') ? 'https://rpc.chordchain.space' : `${origin}/api/rpc`);
  const explorerUrl =
    process.env.NEXT_PUBLIC_EXPLORER_URL ||
    (origin.includes('chordchain.space') ? 'https://scan.chordchain.space' : origin);

  try {
    await targetProvider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: '0x1dbd', // 7613 in hex
          chainName: 'Chord',
          nativeCurrency: {
            name: 'CHOR',
            symbol: 'CHOR',
            decimals: 18,
          },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [explorerUrl],
        },
      ],
    });

    return {
      success: true,
      message: 'Chord 네트워크가 지갑에 성공적으로 추가되었습니다.',
    };
  } catch (err: any) {
    // Error 4902: Unrecognized chain, or chain already added, try to switch
    if (err.code === 4902 || err?.data?.originalError?.code === 4902) {
      try {
        await targetProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x1dbd' }],
        });
        return {
          success: true,
          message:
            'Chord 네트워크로 전환되었습니다. (지갑에 이전 "Chord Devnet" 이름이 남아있다면 메타마스크 [설정 > 네트워크]에서 기존 네트워크를 삭제 후 다시 추가하시면 최신 "Chord"로 갱신됩니다.)',
        };
      } catch (switchErr: any) {
        return {
          success: false,
          message: switchErr?.message || 'Chord 네트워크 전환에 실패했습니다.',
        };
      }
    }

    // User rejected request (code 4001)
    if (err.code === 4001) {
      return {
        success: false,
        message: 'Network addition request was rejected by user.',
      };
    }

    return {
      success: false,
      message: err?.message || 'Failed to add Chord network to wallet.',
    };
  }
}
