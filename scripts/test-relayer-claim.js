const { ethers } = require("ethers");

/**
 * End-to-End Gasless Faucet Claim Verification via EIP-2771 ChordForwarder
 * Usage: node scripts/test-relayer-claim.js [BASE_URL]
 * Default BASE_URL: https://scan.chordchain.space
 */
async function main() {
  const baseUrl = process.argv[2] || process.env.BASE_URL || "https://scan.chordchain.space";
  const rpcUrl = process.env.RPC_URL || "https://rpc.chordchain.space";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log("==================================================");
  console.log(" [CHORD] Gasless Faucet Claim Live Verification");
  console.log("==================================================");
  console.log("Target Base URL :", baseUrl);
  console.log("Target RPC URL  :", rpcUrl);

  const forwarder = ethers.getAddress("0x34ec2b8950c43c126d8e7f57dd67d3f134ea1933");
  const faucet = ethers.getAddress("0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6");

  // 1. 새 테스트 지갑 생성 (잔액 0 CHOR)
  const testWallet = ethers.Wallet.createRandom(provider);
  const userAddress = testWallet.address;
  console.log("\n[Step 1] Created fresh test account:", userAddress);

  const balanceBefore = await provider.getBalance(userAddress);
  console.log(" - Balance before claim:", ethers.formatEther(balanceBefore), "CHOR");

  // 2. Relayer Nonce 엔드포인트 조회 (/api/relayer/nonce/:address)
  console.log(`\n[Step 2] Querying user nonce: GET ${baseUrl}/api/relayer/nonce/${userAddress}`);
  const nonceRes = await fetch(`${baseUrl}/api/relayer/nonce/${userAddress}`);
  if (!nonceRes.ok) {
    throw new Error(`Failed to fetch nonce from relayer: ${nonceRes.status} ${nonceRes.statusText}`);
  }
  const nonceData = await nonceRes.json();
  console.log(" - Nonce API Response:", JSON.stringify(nonceData));
  const nonce = nonceData.nonce ?? 0;

  // 3. EIP-712 서명 생성
  console.log("\n[Step 3] Signing EIP-712 ForwardRequest (0 CHOR Gasless)...");
  const domain = {
    name: "ChordForwarder",
    version: "1",
    chainId: 7613,
    verifyingContract: forwarder,
  };

  const types = {
    ForwardRequest: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "gas", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
  };

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const message = {
    from: userAddress,
    to: faucet,
    value: 0n,
    gas: 100000n,
    nonce: BigInt(nonce),
    deadline: BigInt(deadline),
    data: "0x4e71d92d", // ChordFaucet.claim()
  };

  const signature = await testWallet.signTypedData(domain, types, message);
  console.log(" - Generated Signature:", signature);

  // 4. Relayer Dispatch 엔드포인트 호출 (/api/relayer/dispatch)
  console.log(`\n[Step 4] Submitting meta-tx: POST ${baseUrl}/api/relayer/dispatch`);
  const dispatchRes = await fetch(`${baseUrl}/api/relayer/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: userAddress,
      to: faucet,
      value: "0",
      gas: "100000",
      nonce,
      deadline,
      data: "0x4e71d92d",
      signature,
    }),
  });

  const dispatchData = await dispatchRes.json();
  console.log(" - Dispatch Response:", JSON.stringify(dispatchData, null, 2));

  if (!dispatchRes.ok || !dispatchData.success) {
    throw new Error(`Dispatch failed: ${dispatchData.message || JSON.stringify(dispatchData)}`);
  }

  const txHash = dispatchData.txHash || dispatchData.transactionHash;
  console.log("\n[Step 5] Relayed Tx Hash:", txHash);

  // 5. 온체인 확인 및 잔액 수령 검증
  console.log(" - Waiting for on-chain block mining & balance update...");
  let balanceAfter = 0n;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    balanceAfter = await provider.getBalance(userAddress);
    if (balanceAfter > 0n) {
      break;
    }
  }

  console.log("\n==================================================");
  console.log(" VERIFICATION RESULT");
  console.log("==================================================");
  console.log(" - User Address   :", userAddress);
  console.log(" - Initial Balance:", ethers.formatEther(balanceBefore), "CHOR");
  console.log(" - Final Balance  :", ethers.formatEther(balanceAfter), "CHOR");
  console.log(" - Relayed TxHash :", txHash);
  console.log(" - Explorer Tx URL:", `${baseUrl}/tx/${txHash}`);

  if (balanceAfter >= ethers.parseEther("10")) {
    console.log(" \n✅ SUCCESS: 10 CHOR successfully claimed and verified on-chain!");
  } else {
    throw new Error(`Verification failed: Expected >= 10 CHOR, but got ${ethers.formatEther(balanceAfter)} CHOR`);
  }
}

main().catch((err) => {
  console.error("\n❌ Test Failed:", err.message);
  process.exit(1);
});
