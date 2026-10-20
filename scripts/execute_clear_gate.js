const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';
const OPERATOR_KEY = '0x33cd645873b169b884f6f1903e0eaa6fb9a74bf8a7b4ea04399bfe3f7d0f2650'; // 0x0C04A109F5CE34F079AD52B0f5b6e38a55ecceE7
const HUNTER_KEY = '0x31187206c3974f3b313107a9520d2861702c561227666d5382786aa2d8763f10';   // 0xA552b00A6f79e7e40eFf56DC6B8C79bE1a333E60
const RANDOM_SIGNER_KEY = '0xf7e55e2657ab83bfcb0bd2dd988f13609ccee472af148495ebb7e334f62e66df'; // 0x3246047fBdfc14f1F00C984e1c1825819c3839e7

const ARTIFACT_DIR = '/Users/freddie/Documents/otherworld/slu/packages/evm-contracts/artifacts/contracts';

function loadArtifact(relPath) {
  const fullPath = path.join(ARTIFACT_DIR, relPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

async function main() {
  console.log('========================================================================');
  console.log('⚔️  CHORD L1 - SLU Dungeon Gate Clear & Token Airdrop Execution');
  console.log('   Target RPC:', RPC_URL);
  console.log('========================================================================\n');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const operator = new ethers.Wallet(OPERATOR_KEY, provider);
  const hunter = new ethers.Wallet(HUNTER_KEY, provider);
  const randomSigner = new ethers.Wallet(RANDOM_SIGNER_KEY);

  const deployedPath = path.resolve(__dirname, '../slu_deployed_chord.json');
  const deployed = JSON.parse(fs.readFileSync(deployedPath, 'utf8')).contracts;

  let currentBlock = await provider.getBlockNumber();
  console.log(`Current Block Height: #${currentBlock}`);

  // Step 1: Open Season 0 Pack Token #1 if not already
  console.log('\n--- Step 1: Ensuring Season 0 Pack Token #1 is Opened ---');
  const packArtifact = loadArtifact('collections/seasonPack/SLSeasonPack.sol/SLSeasonPack.json');
  const packContract = new ethers.Contract(deployed.Season0SeasonPack, packArtifact.abi, operator);
  
  const openTokenTx = await packContract.openToken(1);
  const openReceipt = await openTokenTx.wait();
  console.log(`  Pack Token #1 opened in block #${openReceipt.blockNumber} (tx: ${openReceipt.hash})`);

  // Step 2: Advance block height past 69 if needed (Gate 1 endBlock was 69)
  currentBlock = await provider.getBlockNumber();
  console.log(`\n--- Step 2: Advancing Block Height past EndBlock #69 (Current: #${currentBlock}) ---`);
  while (currentBlock < 70) {
    console.log(`  Advancing block #${currentBlock} -> sending step transaction...`);
    const bumpTx = await operator.sendTransaction({
      to: operator.address,
      value: 0n,
    });
    const bumpReceipt = await bumpTx.wait();
    currentBlock = bumpReceipt.blockNumber;
  }
  console.log(`✅ Current Block Height reached #${currentBlock} (Gate remaining blocks = 0)\n`);

  // Step 3: Generate 4 Random Signatures for Rank E Clear
  // E-Rank Rewards: 3 Normal Monsters, 1 Season Pack, 2 Essence Stones -> 4 random signatures required
  console.log('--- Step 3: Generating Random Signatures with RandomSigner ---');
  console.log(`  Signer: ${randomSigner.address}`);
  console.log(`  Hunter: ${hunter.address}`);
  const signatures = [];
  for (let i = 0; i < 4; i++) {
    const hash = ethers.solidityPackedKeccak256(['address', 'uint256'], [hunter.address, i]);
    const sig = await randomSigner.signMessage(ethers.getBytes(hash));
    signatures.push(sig);
    console.log(`  Sig #${i + 1}: ${sig.slice(0, 22)}... (hash: ${hash.slice(0, 18)}...)`);
  }

  // Step 4: Hunter Clears Gate (Gate ID: 1)
  console.log('\n--- Step 4: Hunter Clearing Gate #1 (Executing clearGate) ---');
  const dgArtifact = loadArtifact('dungeonGate/SLDungeonGate.sol/SLDungeonGate.json');
  const dungeonGate = new ethers.Contract(deployed.SLDungeonGate, dgArtifact.abi, hunter);

  const clearTx = await dungeonGate.clearGate(1, signatures);
  console.log(`  clearGate Tx Submitted: ${clearTx.hash}`);
  const clearReceipt = await clearTx.wait();

  console.log('\n🎉 GATE CLEARED & AIRDROP REWARD TOKENS ISSUED!');
  console.log(`   Block Height:     #${clearReceipt.blockNumber}`);
  console.log(`   Transaction Hash: ${clearReceipt.hash}`);
  console.log(`   Gas Used:         ${clearReceipt.gasUsed?.toString() || 'N/A'}`);
  console.log(`   Status:           ${clearReceipt.status === 1 ? 'SUCCESS (0x1)' : 'FAILED'}`);

  // Summary
  console.log('\n========================================================================');
  console.log('📦 Airdropped Reward Summary to Hunter:');
  console.log(`   Hunter:           ${hunter.address}`);
  console.log(`   Monster NFTs:     3x E-Rank Monsters (Collection: ${deployed.SLNormalMonster})`);
  console.log(`   Season Pack NFTs: 1x Season 0 Pack   (Collection: ${deployed.Season0SeasonPack})`);
  console.log(`   Essence Stones:   2x Essence Stones  (Collection: ${deployed.SLEssenceStone})`);
  console.log('========================================================================\n');

  // Save clearGateTx to slu_deployed_chord.json
  const prevSummary = JSON.parse(fs.readFileSync(deployedPath, 'utf8'));
  prevSummary.clearGateTx = clearReceipt.hash;
  prevSummary.clearGateBlock = clearReceipt.blockNumber;
  fs.writeFileSync(deployedPath, JSON.stringify(prevSummary, null, 2));
  console.log(`💾 Updated ${deployedPath} with clearGateTx`);
}

main().catch((err) => {
  console.error('\n❌ Execution failed:', err);
  process.exit(1);
});
