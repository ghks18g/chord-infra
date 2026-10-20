/**
 * Deploy & Integration Test Script for SLU (Solo Leveling Unlimited) on CHORD L1
 * 
 * Target: http://127.0.0.1:8545 (Chain ID 7613)
 * Scenario:
 *  1. Deploy Operator RoleWallet & UUPS Proxies (Project, MonsterFactory, Season, Random, Shop, DungeonGate)
 *  2. Deploy Collections (EssenceStone, Monster, HunterRank, SeasonPack, GateKey)
 *  3. Register Collections on Project
 *  4. Add Season 0 on SLSeason
 *  5. Mint GateKey to Hunter
 *  6. Approve & Call enterToGate(0, RankType.E) to OPEN DUNGEON GATE on Season 0!
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';
const ARTIFACT_DIR = '/Users/freddie/Documents/otherworld/slu/packages/evm-contracts/artifacts/contracts';

// Keys from otherworld/slu/packages/evm-contracts/.env
const OPERATOR_KEY = '0x33cd645873b169b884f6f1903e0eaa6fb9a74bf8a7b4ea04399bfe3f7d0f2650'; // 0x0C04A109F5CE34F079AD52B0f5b6e38a55ecceE7
const HUNTER_KEY = '0x31187206c3974f3b313107a9520d2861702c561227666d5382786aa2d8763f10';   // 0xA552b00A6f79e7e40eFf56DC6B8C79bE1a333E60
const RANDOM_SIGNER_ADDR = '0x3246047fBdfc14f1F00C984e1c1825819c3839e7';

function loadArtifact(relPath) {
  const fullPath = path.join(ARTIFACT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Artifact not found at ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

async function main() {
  console.log('========================================================================');
  console.log('🚀 CHORD L1 - SLU (Solo Leveling Unlimited) Smart Contract Suite Deploy');
  console.log('   Target RPC:', RPC_URL);
  console.log('========================================================================\n');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const operator = new ethers.Wallet(OPERATOR_KEY, provider);
  const hunter = new ethers.Wallet(HUNTER_KEY, provider);

  const opBal = await provider.getBalance(operator.address);
  const hunterBal = await provider.getBalance(hunter.address);

  console.log(`👤 Operator: ${operator.address} | Balance: ${ethers.formatEther(opBal)} CHOR`);
  console.log(`🏹 Hunter:   ${hunter.address} | Balance: ${ethers.formatEther(hunterBal)} CHOR\n`);

  if (opBal < ethers.parseEther('100')) {
    throw new Error('Operator balance is too low for deployment.');
  }

  // Load ERC1967Proxy
  const ProxyArtifact = loadArtifact('openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json');

  // Helper for UUPS Proxy Deployment
  async function deployProxy(artifactName, artifactRelPath, initArgs, signer = operator) {
    const artifact = loadArtifact(artifactRelPath);
    console.log(`📦 Deploying ${artifactName} Implementation...`);
    const ImplFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    const impl = await ImplFactory.deploy();
    await impl.waitForDeployment();
    const implAddr = await impl.getAddress();
    console.log(`   Implementation deployed at: ${implAddr}`);

    const iface = new ethers.Interface(artifact.abi);
    const initData = iface.encodeFunctionData('initialize', initArgs);

    console.log(`   Deploying ${artifactName} ERC1967Proxy...`);
    const ProxyFactory = new ethers.ContractFactory(ProxyArtifact.abi, ProxyArtifact.bytecode, signer);
    const proxy = await ProxyFactory.deploy(implAddr, initData);
    await proxy.waitForDeployment();
    const proxyAddr = await proxy.getAddress();
    console.log(`💎 ${artifactName} Proxy deployed at: ${proxyAddr}\n`);

    return {
      contract: new ethers.Contract(proxyAddr, artifact.abi, signer),
      address: proxyAddr,
      implementation: implAddr,
      abi: artifact.abi,
    };
  }

  // Helper for Direct Contract Deployment
  async function deployDirect(artifactName, artifactRelPath, constructorArgs, signer = operator) {
    const artifact = loadArtifact(artifactRelPath);
    console.log(`📦 Deploying ${artifactName} Direct Contract...`);
    const Factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    const contract = await Factory.deploy(...constructorArgs);
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    console.log(`💎 ${artifactName} deployed at: ${addr}\n`);

    return {
      contract: new ethers.Contract(addr, artifact.abi, signer),
      address: addr,
      abi: artifact.abi,
    };
  }

  const deployed = {};

  // 1. RoleWallet
  console.log('--- Step 1: Deploying RoleWallet ---');
  const roleWallet = await deployDirect(
    'SLRoleWallet',
    'wallet/SLRoleWallet.sol/SLRoleWallet.json',
    [[operator.address], [operator.address]]
  );
  deployed.SLRoleWallet = roleWallet.address;

  // 2. Project
  console.log('--- Step 2: Deploying SLProject ---');
  const project = await deployProxy(
    'SLProject',
    'project/SLProject.sol/SLProject.json',
    [roleWallet.address]
  );
  deployed.SLProject = project.address;

  // 3. MonsterFactory
  console.log('--- Step 3: Deploying SLMonsterFactory ---');
  const monsterFactory = await deployProxy(
    'SLMonsterFactory',
    'monsterFactory/SLMonsterFactory.sol/SLMonsterFactory.json',
    [project.address]
  );
  deployed.SLMonsterFactory = monsterFactory.address;

  // 4. Season
  console.log('--- Step 4: Deploying SLSeason ---');
  const season = await deployProxy(
    'SLSeason',
    'season/SLSeason.sol/SLSeason.json',
    [project.address]
  );
  deployed.SLSeason = season.address;

  // 5. Random
  console.log('--- Step 5: Deploying SLRandom ---');
  const random = await deployProxy(
    'SLRandom',
    'random/SLRandom.sol/SLRandom.json',
    [project.address, RANDOM_SIGNER_ADDR]
  );
  deployed.SLRandom = random.address;

  // 6. TestUSDC
  console.log('--- Step 6: Deploying TestUSDC ---');
  const testUSDC = await deployDirect(
    'TestUSDC',
    'shop/TestUSDC.sol/TestUSDC.json',
    [0]
  );
  deployed.TestUSDC = testUSDC.address;

  // 7. Shop
  console.log('--- Step 7: Deploying SLShop ---');
  // initialize: (project, testUSDC, gateKeyCollectionId = 8, essenceStoneCollectionId = 1)
  const shop = await deployProxy(
    'SLShop',
    'shop/SLShop.sol/SLShop.json',
    [project.address, testUSDC.address, 8, 1]
  );
  deployed.SLShop = shop.address;

  // 8. DungeonGate
  console.log('--- Step 8: Deploying SLDungeonGate ---');
  // initialize: (project, season, random, shop, monsterFactory, essenceStoneId=1, gateKeyId=8, normalMonsterId=2)
  const dungeonGate = await deployProxy(
    'SLDungeonGate',
    'dungeonGate/SLDungeonGate.sol/SLDungeonGate.json',
    [
      project.address,
      season.address,
      random.address,
      shop.address,
      monsterFactory.address,
      1, // essenceStoneCollectionId
      8, // gateKeyCollectionId
      2, // normalMonsterCollectionId
    ]
  );
  deployed.SLDungeonGate = dungeonGate.address;

  // 9. Collections (EssenceStone, Monster, ShadowMonster, HunterRank0, HunterRank1, SeasonPack0, SeasonPack1, GateKey)
  console.log('--- Step 9: Deploying Collections ---');

  // Collection 1: EssenceStone
  const essenceStone = await deployProxy(
    'SLTestEssenceStone',
    'collections/essenceStone/SLTestEssenceStone.sol/SLTestEssenceStone.json',
    [project.address, ethers.ZeroAddress, [dungeonGate.address], 'https://api.chord.network/meta/essence/']
  );
  await (await essenceStone.contract.setProjectApprovalMode(false)).wait();
  await (await project.contract.addCollection(essenceStone.address, operator.address)).wait();
  deployed.SLEssenceStone = essenceStone.address;
  console.log('  Collection 1 Registered: EssenceStone');

  // Collection 2: NormalMonster
  const normalMonster = await deployProxy(
    'SLTestMonster',
    'collections/monster/testMonster/SLTestMonster.sol/SLTestMonster.json',
    [project.address, monsterFactory.address, ethers.ZeroAddress, [dungeonGate.address], 'https://api.chord.network/meta/monster/']
  );
  await (await normalMonster.contract.setProjectApprovalMode(false)).wait();
  await (await project.contract.addCollection(normalMonster.address, operator.address)).wait();
  deployed.SLNormalMonster = normalMonster.address;
  console.log('  Collection 2 Registered: NormalMonster');

  // Collection 3: ShadowMonster
  const shadowMonster = await deployProxy(
    'SLTestMonster',
    'collections/monster/testMonster/SLTestMonster.sol/SLTestMonster.json',
    [project.address, monsterFactory.address, ethers.ZeroAddress, [dungeonGate.address], 'https://api.chord.network/meta/shadow/']
  );
  await (await shadowMonster.contract.setProjectApprovalMode(false)).wait();
  await (await project.contract.addCollection(shadowMonster.address, operator.address)).wait();
  deployed.SLShadowMonster = shadowMonster.address;
  console.log('  Collection 3 Registered: ShadowMonster');

  // Collection 4: Season0 HunterRank
  const season0HunterRank = await deployDirect(
    'SLTestHunterRank',
    'collections/hunterRank/SLTestHunterRank.sol/SLTestHunterRank.json',
    [project.address, [season.address], 'https://api.chord.network/meta/rank0/']
  );
  await (await project.contract.addCollection(season0HunterRank.address, operator.address)).wait();
  deployed.Season0HunterRank = season0HunterRank.address;
  console.log('  Collection 4 Registered: Season0HunterRank');

  // Collection 5: Season1 HunterRank
  const season1HunterRank = await deployDirect(
    'SLTestHunterRank',
    'collections/hunterRank/SLTestHunterRank.sol/SLTestHunterRank.json',
    [project.address, [season.address], 'https://api.chord.network/meta/rank1/']
  );
  await (await project.contract.addCollection(season1HunterRank.address, operator.address)).wait();
  deployed.Season1HunterRank = season1HunterRank.address;
  console.log('  Collection 5 Registered: Season1HunterRank');

  // Collection 6: Season0 SeasonPack
  const season0SeasonPack = await deployDirect(
    'SLSeasonPack',
    'collections/seasonPack/SLSeasonPack.sol/SLSeasonPack.json',
    [project.address, ethers.ZeroAddress, [dungeonGate.address], 'https://api.chord.network/meta/pack0/']
  );
  await (await project.contract.addCollection(season0SeasonPack.address, operator.address)).wait();
  deployed.Season0SeasonPack = season0SeasonPack.address;
  console.log('  Collection 6 Registered: Season0SeasonPack');

  // Collection 7: Season1 SeasonPack
  const season1SeasonPack = await deployDirect(
    'SLSeasonPack',
    'collections/seasonPack/SLSeasonPack.sol/SLSeasonPack.json',
    [project.address, ethers.ZeroAddress, [dungeonGate.address], 'https://api.chord.network/meta/pack1/']
  );
  await (await project.contract.addCollection(season1SeasonPack.address, operator.address)).wait();
  deployed.Season1SeasonPack = season1SeasonPack.address;
  console.log('  Collection 7 Registered: Season1SeasonPack');

  // Collection 8: GateKey
  const gateKey = await deployProxy(
    'SLGateKey',
    'collections/gateKey/SLGateKey.sol/SLGateKey.json',
    [project.address, ethers.ZeroAddress, [operator.address, shop.address], 'https://api.chord.network/meta/gatekey/']
  );
  await (await gateKey.contract.setProjectApprovalMode(false)).wait();
  await (await project.contract.addCollection(gateKey.address, operator.address)).wait();
  deployed.SLGateKey = gateKey.address;
  console.log('  Collection 8 Registered: GateKey\n');

  // 10. Populate MonsterFactory
  console.log('--- Step 10: Registering Monsters in MonsterFactory ---');
  for (let r = 0; r < 6; r++) {
    const tx = await monsterFactory.contract.addMonster(r, false);
    await tx.wait();
  }
  console.log('  Monsters added for Ranks E, D, C, B, A, S.\n');

  // 11. Add Season 0
  console.log('--- Step 11: Initializing Season 0 ---');
  const currentHeight = await provider.getBlockNumber();
  console.log(`  Current Block Height: ${currentHeight}`);
  const startBlock = currentHeight;
  const endBlock = currentHeight + 100000;

  const addSeasonTx = await season.contract.addSeason(
    4, // hunterRank (collection 4)
    6, // seasonPack (collection 6)
    startBlock,
    endBlock,
    [2, 3] // season collections (normalMonster, shadowMonster)
  );
  const seasonReceipt = await addSeasonTx.wait();
  console.log(`  Season 0 successfully created in block #${seasonReceipt.blockNumber} (tx: ${seasonReceipt.hash})\n`);

  // 12. Mint GateKey to Hunter
  console.log('--- Step 12: Minting GateKey to Hunter ---');
  const mintTx = await gateKey.contract.mintKey(hunter.address, 0 /* Rank E */, 1);
  const mintReceipt = await mintTx.wait();
  console.log(`  Minted 1 E-Rank GateKey to ${hunter.address} (tx: ${mintReceipt.hash})`);

  const keyBal = await gateKey.contract.balanceOf(hunter.address, 0);
  console.log(`  Hunter GateKey Balance: ${keyBal.toString()}`);

  // 13. Hunter Approves Gate Contract
  console.log('\n--- Step 13: Hunter Approving DungeonGate ---');
  const approveTx = await gateKey.contract.connect(hunter).setApprovalForAll(dungeonGate.address, true);
  await approveTx.wait();
  console.log('  DungeonGate approved for hunter.');

  // 14. Hunter Enters Gate (OPEN GATE!)
  console.log('\n--- Step 14: Hunter Entering Gate (OPEN GATE!) ---');
  const enterTx = await dungeonGate.contract.connect(hunter).enterToGate(0 /* season 0 */, 0 /* Rank E */);
  const enterReceipt = await enterTx.wait();
  console.log(`🎉 Gate successfully opened!`);
  console.log(`   Block Height: #${enterReceipt.blockNumber}`);
  console.log(`   Transaction Hash: ${enterReceipt.hash}`);
  console.log(`   Gas Used: ${enterReceipt.gasUsed?.toString() || 'N/A'}`);

  // Parse GateCreated event from logs
  const dgIface = new ethers.Interface(dungeonGate.abi);
  for (const log of enterReceipt.logs) {
    try {
      const parsed = dgIface.parseLog(log);
      if (parsed && parsed.name === 'GateCreated') {
        console.log('\n🔥 Emitted GateCreated Event Details:');
        console.log(`   Season ID:       ${parsed.args.seasonId.toString()}`);
        console.log(`   Gate Rank:       ${parsed.args.gateRank} (E)`);
        console.log(`   Hunter:          ${parsed.args.hunter}`);
        console.log(`   Gate ID:         ${parsed.args.gateId.toString()}`);
        console.log(`   Start Block:     #${parsed.args.startBlock.toString()}`);
        console.log(`   End Block:       #${parsed.args.endBlock.toString()}`);
      }
    } catch {}
  }

  // 15. Save output summary
  const outPath = path.resolve(__dirname, '../slu_deployed_chord.json');
  fs.writeFileSync(outPath, JSON.stringify({
    deployedAt: new Date().toISOString(),
    network: 'chord',
    chainId: 7613,
    openGateTx: enterReceipt.hash,
    openGateBlock: enterReceipt.blockNumber,
    hunter: hunter.address,
    contracts: deployed,
  }, null, 2));
  console.log(`\n💾 Saved deployment summary to: ${outPath}`);
  console.log('========================================================================');
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err);
  process.exit(1);
});
