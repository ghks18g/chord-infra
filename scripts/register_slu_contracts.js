const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const deployedData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../slu_deployed_chord.json'), 'utf8'));
const client = new Client({ connectionString: 'postgresql://chord:chordpass@127.0.0.1:5432/chordscan' });

const contractMeta = {
  SLRoleWallet: { file: 'wallet/SLRoleWallet.sol/SLRoleWallet.json', name: 'SLRoleWallet' },
  SLProject: { file: 'project/SLProject.sol/SLProject.json', name: 'SLProject' },
  SLMonsterFactory: { file: 'monsterFactory/SLMonsterFactory.sol/SLMonsterFactory.json', name: 'SLMonsterFactory' },
  SLSeason: { file: 'season/SLSeason.sol/SLSeason.json', name: 'SLSeason' },
  SLRandom: { file: 'random/SLRandom.sol/SLRandom.json', name: 'SLRandom' },
  TestUSDC: { file: 'shop/TestUSDC.sol/TestUSDC.json', name: 'TestUSDC' },
  SLShop: { file: 'shop/SLShop.sol/SLShop.json', name: 'SLShop' },
  SLDungeonGate: { file: 'dungeonGate/SLDungeonGate.sol/SLDungeonGate.json', name: 'SLDungeonGate' },
  SLEssenceStone: { file: 'collections/essenceStone/SLTestEssenceStone.sol/SLTestEssenceStone.json', name: 'SLEssenceStone' },
  SLNormalMonster: { file: 'collections/monster/testMonster/SLTestMonster.sol/SLTestMonster.json', name: 'SLNormalMonster' },
  SLShadowMonster: { file: 'collections/monster/testMonster/SLTestMonster.sol/SLTestMonster.json', name: 'SLShadowMonster' },
  Season0HunterRank: { file: 'collections/hunterRank/SLTestHunterRank.sol/SLTestHunterRank.json', name: 'Season0HunterRank' },
  Season1HunterRank: { file: 'collections/hunterRank/SLTestHunterRank.sol/SLTestHunterRank.json', name: 'Season1HunterRank' },
  Season0SeasonPack: { file: 'collections/seasonPack/SLSeasonPack.sol/SLSeasonPack.json', name: 'Season0SeasonPack' },
  Season1SeasonPack: { file: 'collections/seasonPack/SLSeasonPack.sol/SLSeasonPack.json', name: 'Season1SeasonPack' },
  SLGateKey: { file: 'collections/gateKey/SLGateKey.sol/SLGateKey.json', name: 'SLGateKey' },
};

const artifactBase = '/Users/freddie/Documents/otherworld/slu/packages/evm-contracts/artifacts/contracts/';

async function main() {
  await client.connect();
  console.log('Connected to DB');

  for (const [key, addr] of Object.entries(deployedData.contracts)) {
    const meta = contractMeta[key];
    if (!meta) continue;
    const art = JSON.parse(fs.readFileSync(artifactBase + meta.file, 'utf8'));
    const lowerAddr = addr.toLowerCase();

    const existing = await client.query('SELECT address FROM contracts WHERE address = $1', [lowerAddr]);
    if (existing.rows.length === 0) {
      await client.query(
        'INSERT INTO contracts (address, creator, bytecode, name, "isVerified", abi, "compilerVersion", "verifiedAt", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())',
        [lowerAddr, '0x0c04a109f5ce34f079ad52b0f5b6e38a55eccee7', art.bytecode, meta.name, true, JSON.stringify(art.abi), 'v0.8.9+commit.e5eed63a']
      );
    } else {
      await client.query(
        'UPDATE contracts SET name = $1, "isVerified" = true, abi = $2, "compilerVersion" = $3, "verifiedAt" = NOW() WHERE address = $4',
        [meta.name, JSON.stringify(art.abi), 'v0.8.9+commit.e5eed63a', lowerAddr]
      );
    }
    console.log(`Registered ${meta.name} (${lowerAddr})`);
  }

  await client.end();
  console.log('Finished registering SLU contracts in ChordScan database.');
}

main().catch(console.error);
