const { ethers } = require("ethers");

async function main() {
  console.log("==================================================");
  console.log(" Testing EIP-712 Forwarder Simulation on CHORD RPC");
  console.log("==================================================");

  const rpcUrl = "https://rpc.chordchain.space"; // 라이브 RPC
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const forwarderAddress = ethers.getAddress("0x34ec2b8950c43c126d8e7f57dd67d3f134ea1933");
  const faucetAddress = ethers.getAddress("0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6");

  const forwarderAbi = [
    "function getNonce(address from) view returns (uint256)",
    "function domainSeparator() view returns (bytes32)",
    "function verify((address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 deadline, bytes data) req, bytes signature) view returns (bool)",
    "function execute((address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 deadline, bytes data) req, bytes signature) payable returns (bool, bytes)",
  ];

  const forwarder = new ethers.Contract(forwarderAddress, forwarderAbi, provider);

  // 1. 임의의 신규 사용자 지갑 생성 (CHOR 잔액 0)
  const testUser = ethers.Wallet.createRandom();
  console.log("1. Test User Address:", testUser.address);

  const userBalance = await provider.getBalance(testUser.address);
  console.log("   Initial User Balance:", ethers.formatEther(userBalance), "CHOR");

  // 2. Nonce 조회
  const nonce = await forwarder.getNonce(testUser.address);
  console.log("2. On-chain Nonce for User:", nonce.toString());

  // 3. Domain Separator 확인
  const onchainDomainSeparator = await forwarder.domainSeparator();
  console.log("3. On-chain Domain Separator:", onchainDomainSeparator);

  // 로컬 EIP-712 도메인 계산
  const domain = {
    name: "ChordForwarder",
    version: "1",
    chainId: 7613,
    verifyingContract: forwarderAddress,
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
    from: testUser.address,
    to: faucetAddress,
    value: 0n,
    gas: 100000n,
    nonce: nonce,
    deadline: BigInt(deadline),
    data: "0x4e71d92d", // ChordFaucet.claim()
  };

  // 4. 서명 생성
  const signature = await testUser.signTypedData(domain, types, message);
  console.log("4. Generated EIP-712 Signature:", signature);

  // 5. 온체인 verify() 시뮬레이션
  const req = [
    testUser.address,
    faucetAddress,
    0n,
    100000n,
    nonce,
    BigInt(deadline),
    "0x4e71d92d",
  ];

  const isValidOnChain = await forwarder.verify(req, signature);
  console.log("5. On-chain verify() Result:", isValidOnChain ? "✅ VALID" : "❌ INVALID");

  if (!isValidOnChain) {
    throw new Error("On-chain verification failed! Check domain separator or parameters.");
  }

  console.log("\n==================================================");
  console.log(" Simulation Passed! Contract accepts signature 100%");
  console.log("==================================================");
}

main().catch(console.error);
