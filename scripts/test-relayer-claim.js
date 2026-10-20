const { ethers } = require("ethers");

/**
 * Gasless Faucet Claim via AvaCloud-style EIP-2771 Gas Station Relayer
 * Usage: node scripts/test-relayer-claim.js [optional_recipient_address]
 */
async function main() {
  const recipientArg = process.argv[2];
  const user = recipientArg ? { address: ethers.getAddress(recipientArg) } : ethers.Wallet.createRandom();

  console.log("==================================================");
  console.log(" Testing Gasless Claim via Relayer");
  console.log("==================================================");
  console.log("Claimer Address (Gas: 0 CHOR) :", user.address);

  const sponsor = ethers.getAddress("0x470cc21093319e612e9779ce2c1d53b0f84562f5");
  const faucet = ethers.getAddress("0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6");

  const domain = {
    name: "ChordGasStation",
    version: "1",
    chainId: 7613,
    verifyingContract: sponsor,
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
  const value = {
    from: user.address,
    to: faucet,
    value: 0n,
    gas: 100000n,
    nonce: 0n,
    deadline: BigInt(deadline),
    data: "0x4e71d92d", // ChordFaucet.claim() selector
  };

  // If using random wallet, sign typed data directly
  let signature;
  if (user.signTypedData) {
    signature = await user.signTypedData(domain, types, value);
    console.log("EIP-712 Signature Generated!");
  } else {
    console.log("Recipient is specified without private key. Signing with temporary delegator...");
    const tempSigner = ethers.Wallet.createRandom();
    value.from = tempSigner.address;
    signature = await tempSigner.signTypedData(domain, types, value);
    user.address = tempSigner.address;
  }

  console.log("Dispatching to Relayer endpoint (POST /api/relayer/dispatch)...");
  const res = await fetch("http://127.0.0.1:3001/api/relayer/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: user.address,
      to: faucet,
      value: "0x0",
      gas: "0x186a0",
      nonce: 0,
      deadline,
      data: "0x4e71d92d",
      signature,
    }),
  });

  const data = await res.json();
  console.log("\nRelayer Dispatch Result:");
  console.log(JSON.stringify(data, null, 2));

  if (data.success) {
    console.log("\n✅ Sponsored Tx mined on-chain! Block Number:", data.blockNumber);
    console.log("Explorer Tx URL: http://localhost:3001/tx/" + data.txHash);
  }
}

main().catch(console.error);
