const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({ connectionString: 'postgresql://chord:chordpass@127.0.0.1:5432/chordscan' });
const artDir = '/Users/freddie/Documents/otherworld/slu/packages/evm-contracts/artifacts/contracts';

const proxyPairs = [
  {
    name: 'SLProject',
    proxies: ['0xd7f19e00877c864090bb369e6a1f76207159ea52', '0xe700bc63da2aa4e973b1325a1761de9a614673bf'],
    impl: '0x285e9e13c4d251b1f48d72ff94b0ea6a0103051f',
    art: 'project/SLProject.sol/SLProject.json',
  },
  {
    name: 'SLMonsterFactory',
    proxies: ['0xb00344431dda847a92ea6ad63d863cbaa3c1fc04', '0x4cb22a5f56700efe87732184401c2df70f4d4a9e'],
    impl: '0x7874c5098acbb79838ea95749ce90a2436b45816',
    art: 'monsterFactory/SLMonsterFactory.sol/SLMonsterFactory.json',
  },
  {
    name: 'SLSeason',
    proxies: ['0x1c48895f8e8718738c6f1ab357f1cff0665408ed', '0x08f9213880ded0194fd0bad8fc7b588fba8012b0'],
    impl: '0xcfd0140a346a2907db94f4f53d66a26c56c0d609',
    art: 'season/SLSeason.sol/SLSeason.json',
  },
  {
    name: 'SLRandom',
    proxies: ['0x8042f3b9b7a13ba31f3bf8aa61290d19f530b5ad', '0x377247bdc6e242c55ff0de3215aad8dfa3b15fa1'],
    impl: '0x73afdbf3782428c666cb45bd7ec376eb19079374',
    art: 'random/SLRandom.sol/SLRandom.json',
  },
  {
    name: 'SLShop',
    proxies: ['0xfb45e6dec2ac35418e3684244d29299b013ecc44', '0xbf0a3f1825f9711e340c01c52643692bc2b64e3b'],
    impl: '0x0c1d16ae27baf7de86fe1e46a9e3c30fc9251e06',
    art: 'shop/SLShop.sol/SLShop.json',
  },
  {
    name: 'SLDungeonGate',
    proxies: ['0x25b9ac4529a69ae0e004bfeb7b0e7d3df1cb3fc2', '0xaab18750b49e65439c32f6c76db7a63d71a577bb'],
    impl: '0x61af3252969533eed3a800464b7a2726e123a348',
    art: 'dungeonGate/SLDungeonGate.sol/SLDungeonGate.json',
  },
  {
    name: 'SLEssenceStone',
    proxies: ['0xd1ec8cd9f2c8907b25c8e003005d21f111070009', '0x08ffee2e7439363517d312d8fee3aee5508bb630'],
    impl: '0x2721314662912a02a0c1fdd95b0febd7abb939c1',
    art: 'collections/essenceStone/SLTestEssenceStone.sol/SLTestEssenceStone.json',
  },
  {
    name: 'SLNormalMonster',
    proxies: ['0xdcfe988a81d8a6f08410cd76dF4cBE8b8612bb4C'.toLowerCase(), '0xfada2bde4f4bacc93ff3435839ab0cd29e9513c1'],
    impl: '0x549313d584a66683136f9f3fb888043baecfbc1d',
    art: 'collections/monster/testMonster/SLTestMonster.sol/SLTestMonster.json',
  },
  {
    name: 'SLShadowMonster',
    proxies: ['0x7b0e802ce689eeb61cb039acf083fbce63e58979', '0xfe0dd7fff50b12346a3790e2db06ea043a6762dc'],
    impl: '0xf5ff43ebae43524f128fd75a7ffb167d8b3fed45',
    art: 'collections/monster/testMonster/SLTestMonster.sol/SLTestMonster.json',
  },
  {
    name: 'SLGateKey',
    proxies: ['0x70f61025027fc6286d6f30a0ce37ad217a0ad7c2', '0x98a7fd13cba9cc2703d7db0fdf82df13a0f128d8'],
    impl: '0x98301b05a2b4a58d86a9791a97b432fb65f3380a',
    art: 'collections/gateKey/SLGateKey.sol/SLGateKey.json',
  },
];

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL');

  for (const pair of proxyPairs) {
    const art = JSON.parse(fs.readFileSync(path.join(artDir, pair.art), 'utf8'));
    const implAddr = pair.impl.toLowerCase();

    // 1. Verify Implementation contract
    await client.query(
      `INSERT INTO contracts (address, creator, bytecode, name, "isVerified", "isProxy", abi, "compilerVersion", "verifiedAt", "createdAt")
       VALUES ($1, $2, $3, $4, true, false, $5, $6, NOW(), NOW())
       ON CONFLICT (address) DO UPDATE SET
         name = $4,
         "isVerified" = true,
         "isProxy" = false,
         abi = $5,
         "compilerVersion" = $6,
         "verifiedAt" = NOW()`,
      [
        implAddr,
        '0x0c04a109f5ce34f079ad52b0f5b6e38a55eccee7',
        art.deployedBytecode,
        `${pair.name} (Implementation)`,
        JSON.stringify(art.abi),
        'v0.8.9+commit.e5eed63a',
      ]
    );
    console.log(`Verified Implementation: ${pair.name} (Implementation) at ${implAddr}`);

    // 2. Link each Proxy address to implementation
    for (const pAddr of pair.proxies) {
      const lowerProxy = pAddr.toLowerCase();
      await client.query(
        `INSERT INTO contracts (address, creator, bytecode, name, "isVerified", "isProxy", "proxyType", "implementationAddress", abi, "compilerVersion", "verifiedAt", "createdAt")
         VALUES ($1, $2, $3, $4, true, true, $5, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (address) DO UPDATE SET
           name = $4,
           "isVerified" = true,
           "isProxy" = true,
           "proxyType" = $5,
           "implementationAddress" = $6,
           abi = $7,
           "compilerVersion" = $8,
           "verifiedAt" = NOW()`,
        [
          lowerProxy,
          '0x0c04a109f5ce34f079ad52b0f5b6e38a55eccee7',
          art.bytecode,
          `${pair.name}`,
          'UUPS / ERC-1967',
          implAddr,
          JSON.stringify(art.abi),
          'v0.8.9+commit.e5eed63a',
        ]
      );
      console.log(`  Linked Proxy: ${pair.name} (${lowerProxy}) -> Impl (${implAddr})`);
    }
  }

  await client.end();
  console.log('Finished updating proxy and implementation records in database.');
}

main().catch(console.error);
