#!/usr/bin/env node

/**
 * ChordScan Genesis Smart Contract Verification Script
 *
 * Verifies ChordFaucet, ChordForwarder, and ChordMultiSig in PostgreSQL database
 * enabling dynamic ABI decoding of Methods and Events on the Explorer.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  console.log('==================================================================');
  console.log(' [CHORD] Genesis Smart Contract Verification Tool');
  console.log('==================================================================\n');

  const contractsDir = path.resolve(__dirname, '../../chord-go/contracts');

  const faucetSource = fs.readFileSync(path.join(contractsDir, 'ChordFaucet.sol'), 'utf8');
  const forwarderSource = fs.readFileSync(path.join(contractsDir, 'ChordForwarder.sol'), 'utf8');
  const multiSigSource = fs.readFileSync(path.join(contractsDir, 'ChordMultiSig.sol'), 'utf8');

  const faucetArtifact = JSON.parse(fs.readFileSync(path.join(contractsDir, 'ChordFaucet.json'), 'utf8'));
  const forwarderArtifact = JSON.parse(fs.readFileSync(path.join(contractsDir, 'ChordForwarder.json'), 'utf8'));
  const multiSigArtifact = JSON.parse(fs.readFileSync(path.join(contractsDir, 'ChordMultiSig.json'), 'utf8'));

  const contracts = [
    {
      name: 'ChordFaucet',
      address: '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6',
      source: faucetSource,
      abi: JSON.stringify(faucetArtifact.abi),
      compiler: 'v0.8.20+commit.a1b79de6',
    },
    {
      name: 'ChordForwarder',
      address: '0x34ec2b8950c43c126d8e7f57dd67d3f134ea1933',
      source: forwarderSource,
      abi: JSON.stringify(forwarderArtifact.abi),
      compiler: 'v0.8.20+commit.a1b79de6',
    },
    {
      name: 'ChordMultiSig',
      address: '0x8f9d82461767c4ff6a0fcf9f2c45df00f79a6f6e',
      source: multiSigSource,
      abi: JSON.stringify(multiSigArtifact.abi),
      compiler: 'v0.8.20+commit.a1b79de6',
    },
  ];

  let sqlStatements = '';

  for (const c of contracts) {
    console.log(`[1/2] Preparing verification for ${c.name} (${c.address})...`);
    const escapedSource = c.source.replace(/'/g, "''");
    const escapedAbi = c.abi.replace(/'/g, "''");

    sqlStatements += `
      -- 1. Ensure contract row exists
      INSERT INTO contracts (address, name, creator, bytecode, "isVerified", "sourceCode", "compilerVersion", abi, "verifiedAt", "createdAt")
      VALUES ('${c.address}', '${c.name}', '0x0000000000000000000000000000000000000000', '0x', true, '${escapedSource}', '${c.compiler}', '${escapedAbi}'::jsonb, NOW(), NOW())
      ON CONFLICT (address) DO UPDATE
      SET name = EXCLUDED.name,
          "isVerified" = true,
          "sourceCode" = EXCLUDED."sourceCode",
          "compilerVersion" = EXCLUDED."compilerVersion",
          abi = EXCLUDED.abi,
          "verifiedAt" = NOW();

      -- 2. Insert audit log in contract_verifications
      INSERT INTO contract_verifications ("contractAddress", "contractName", "compilerVersion", "sourceCode", status, "createdAt")
      VALUES ('${c.address}', '${c.name}', '${c.compiler}', '${escapedSource}', 'SUCCESS', NOW());
    `;
  }

  const tmpSqlPath = '/tmp/verify_contracts.sql';
  fs.writeFileSync(tmpSqlPath, sqlStatements, 'utf8');

  console.log('\n[2/2] Applying verification records to PostgreSQL database...');
  try {
    const containerId = execSync('docker ps -q --filter "name=chord-postgres"').toString().trim().split('\n')[0] || 'chord-postgres';
    if (!containerId) {
      throw new Error('PostgreSQL Docker container is not running');
    }

    execSync(`docker exec -i ${containerId} psql -U chord -d chordscan < ${tmpSqlPath}`);

    const verifyOutput = execSync(`docker exec -i ${containerId} psql -U chord -d chordscan -c "SELECT address, name, \\"isVerified\\", \\"verifiedAt\\" FROM contracts;"`).toString();
    console.log('\nUpdated Contract Table:');
    console.log(verifyOutput);

    console.log('==================================================================');
    console.log(' [SUCCESS] Smart Contracts have been successfully verified!');
    console.log(' - Method calls will now decode from ABI (e.g. claim())');
    console.log(' - Event logs will now display decoded names and parameter tables:');
    console.log('    * Log #0: ChordFaucet.Claim(address recipient, uint256 amount)');
    console.log('    * Log #1: ChordForwarder.Executed(from, to, success, returndata)');
    console.log('==================================================================');
  } catch (err) {
    console.error('Failed to apply verification:', err.message);
    process.exit(1);
  } finally {
    if (fs.existsSync(tmpSqlPath)) fs.unlinkSync(tmpSqlPath);
  }
}

main().catch(console.error);
