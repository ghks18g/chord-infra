import assert from 'node:assert';
import { ethers } from 'ethers';
import { BadRequestException } from '@nestjs/common';
import {
  RelayerService,
  EIP712_FORWARD_REQUEST_TYPES,
} from '../src/relayer/relayer.service';
import { RelayDispatchDTO } from '@chordscan/types';

async function rpc(method: string, params: unknown[] = []): Promise<any> {
  const res = await fetch('http://127.0.0.1:8545', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const json: any = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function runRelayerE2ETests() {
  console.log('================================================================');
  console.log('🚀 ChordChain-Infra: AvaCloud-Style Gas Station Relayer E2E Test');
  console.log('================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err: unknown) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  const relayerService = new RelayerService();

  // ------------------------------------------------------------------
  // 1. Relayer Status & Sponsor Account
  // ------------------------------------------------------------------
  console.log('▶ [1] 릴레이어 스폰서 계정 상태 및 EIP-712 도메인 설정 검증');

  await test('GET /api/relayer/status 스폰서 잔액 및 설정 확인', async () => {
    const status = await relayerService.getStatus();
    console.log(`    - 스폰서 계정: ${status.sponsorAddress}`);
    console.log(`    - 스폰서 잔액: ${status.sponsorBalance} (Hex Wei)`);
    console.log(`    - 체인 ID: ${status.chainId}`);
    console.log(`    - 도메인: ${JSON.stringify(status.domain)}`);

    assert.ok(status.sponsorAddress.startsWith('0x'));
    assert.strictEqual(status.chainId, 7613);
    assert.strictEqual(status.domain.name, 'ChordForwarder');
    assert.strictEqual(status.domain.version, '1');
    assert.ok(BigInt(status.sponsorBalance) > 0n, '스폰서 지갑 잔액이 존재해야 함');
  });

  // ------------------------------------------------------------------
  // 2. 가스비 0원인 임의 유저의 EIP-712 메타 트랜잭션 대납 E2E 검증
  // ------------------------------------------------------------------
  console.log('\n▶ [2] 가스비 0원 계정의 EIP-712 서명 기반 온체인 트랜잭션 대납 디스패치 검증');

  await test('가스 0원 테스트 계정 생성 및 잔액 0원 검증', async () => {
    const zeroGasWallet = ethers.Wallet.createRandom();
    const balance = await rpc('eth_getBalance', [zeroGasWallet.address, 'latest']);
    console.log(`    - 생성된 테스트 계정: ${zeroGasWallet.address}`);
    console.log(`    - 계정 잔액: ${balance} (0 CHOR)`);

    assert.ok(balance === '0x' || balance === '0x0', '신규 생성 계정의 잔액은 정확히 0원이어야 함');
  });

  await test('EIP-712 Typed Data 서명 및 온체인 디스패치 (가스 대납 성공 & 영수증 확인)', async () => {
    // 가스 0원 계정 생성
    const zeroGasWallet = ethers.Wallet.createRandom();
    const targetRecipient = '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6'; // Faucet 컨트랙트
    const callData = '0x4e71d92d'; // claim() selector

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1시간 유효
    const nonce = 0;

    const domain = relayerService.domain;
    const value = {
      from: zeroGasWallet.address,
      to: targetRecipient,
      value: 0n,
      gas: 100000n,
      nonce: BigInt(nonce),
      deadline: BigInt(deadline),
      data: callData,
    };

    // 유저가 EIP-712 표준 서명 생성 (개인키 전송 불필요, 가스비 0원)
    const signature = await zeroGasWallet.signTypedData(
      domain,
      EIP712_FORWARD_REQUEST_TYPES,
      value,
    );

    const dispatchDto: RelayDispatchDTO = {
      from: zeroGasWallet.address,
      to: targetRecipient,
      value: '0x0',
      gas: '0x186a0', // 100,000 gas
      nonce,
      deadline,
      data: callData,
      signature,
    };

    // 릴레이어에 디스패치 요청 (POST /api/relayer/dispatch)
    const result = await relayerService.dispatch(dispatchDto);

    console.log(`    - 디스패치 결과 성공 여부: ${result.success}`);
    console.log(`    - 생성된 On-Chain TxHash: ${result.txHash}`);
    console.log(`    - 채굴된 블록 번호: ${result.blockNumber}`);
    console.log(`    - 가스 대납 스폰서: ${result.sponsoredBy}`);

    assert.strictEqual(result.success, true, '트랜잭션이 성공적으로 온체인 처리되어야 함');
    assert.ok(result.txHash.startsWith('0x'), '유효한 트랜잭션 해시가 반환되어야 함');
    assert.strictEqual(
      result.sponsoredBy.toLowerCase(),
      (await relayerService.getStatus()).sponsorAddress.toLowerCase(),
      '가스는 스폰서 지갑에서 대납되어야 함',
    );

    // 온체인 RPC에서 실제 영수증 직접 확인
    const receipt = await rpc('eth_getTransactionReceipt', [result.txHash]);
    assert.ok(receipt !== null, '온체인에 영수증이 존재해야 함');
    assert.strictEqual(receipt.status, '0x1', '영수증 실행 상태가 성공(0x1)이어야 함');
    assert.strictEqual(
      receipt.from.toLowerCase(),
      (await relayerService.getStatus()).sponsorAddress.toLowerCase(),
      '온체인 tx.from은 스폰서 주소여야 함 (유저 지갑 잔액 차감 없음)',
    );
  });

  // ------------------------------------------------------------------
  // 3. EIP-712 보안 및 스폰서십 정책 검증
  // ------------------------------------------------------------------
  console.log('\n▶ [3] 보안 및 스폰서십 정책 방어 검증');

  await test('서명 변조 또는 서명자 불일치 시 BadRequestException 발생', async () => {
    const legitimateWallet = ethers.Wallet.createRandom();
    const maliciousWallet = ethers.Wallet.createRandom();

    const domain = relayerService.domain;
    const value = {
      from: legitimateWallet.address,
      to: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      value: 0n,
      gas: 21000n,
      nonce: 0n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      data: '0x',
    };

    // legitimateWallet 이름으로 maliciousWallet이 서명한 경우
    const badSignature = await maliciousWallet.signTypedData(
      domain,
      EIP712_FORWARD_REQUEST_TYPES,
      value,
    );

    await assert.rejects(
      async () => {
        await relayerService.dispatch({
          from: legitimateWallet.address,
          to: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          value: '0x0',
          gas: '0x5208',
          nonce: 0,
          deadline: Math.floor(Date.now() / 1000) + 3600,
          data: '0x',
          signature: badSignature,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('Invalid EIP-712 signature'));
        return true;
      },
    );
  });

  await test('만료된 Deadline 요청 시 BadRequestException 발생', async () => {
    const wallet = ethers.Wallet.createRandom();
    const domain = relayerService.domain;
    const pastDeadline = Math.floor(Date.now() / 1000) - 100; // 과거 시간

    const value = {
      from: wallet.address,
      to: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      value: 0n,
      gas: 21000n,
      nonce: 0n,
      deadline: BigInt(pastDeadline),
      data: '0x',
    };

    const sig = await wallet.signTypedData(domain, EIP712_FORWARD_REQUEST_TYPES, value);

    await assert.rejects(
      async () => {
        await relayerService.dispatch({
          from: wallet.address,
          to: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          value: '0x0',
          gas: '0x5208',
          nonce: 0,
          deadline: pastDeadline,
          data: '0x',
          signature: sig,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('deadline expired'));
        return true;
      },
    );
  });

  await test('화이트리스트에 없는 컨트랙트 호출 시 가스 대납 거절', async () => {
    // 화이트리스트를 특정 주소로 한정
    const originalWhitelist = (await relayerService.getStatus()).policies.whitelist;
    relayerService.setWhitelist(['0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6']);

    const wallet = ethers.Wallet.createRandom();
    const nonWhitelistedTarget = '0x1234567890123456789012345678901234567890';
    const domain = relayerService.domain;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const value = {
      from: wallet.address,
      to: nonWhitelistedTarget,
      value: 0n,
      gas: 21000n,
      nonce: 0n,
      deadline: BigInt(deadline),
      data: '0x',
    };

    const sig = await wallet.signTypedData(domain, EIP712_FORWARD_REQUEST_TYPES, value);

    await assert.rejects(
      async () => {
        await relayerService.dispatch({
          from: wallet.address,
          to: nonWhitelistedTarget,
          value: '0x0',
          gas: '0x5208',
          nonce: 0,
          deadline,
          data: '0x',
          signature: sig,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('not in the gas sponsorship whitelist'));
        return true;
      },
    );

    // 화이트리스트 복구
    relayerService.setWhitelist(originalWhitelist);
  });

  await test('동일 Nonce 재사용 (Replay Attack) 방어 검증', async () => {
    const wallet = ethers.Wallet.createRandom();
    const domain = relayerService.domain;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // 1차 디스패치 (Nonce 0) -> 성공
    const value0 = {
      from: wallet.address,
      to: '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6',
      value: 0n,
      gas: 21000n,
      nonce: 0n,
      deadline: BigInt(deadline),
      data: '0x',
    };
    const sig0 = await wallet.signTypedData(domain, EIP712_FORWARD_REQUEST_TYPES, value0);

    const res0 = await relayerService.dispatch({
      from: wallet.address,
      to: '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6',
      value: '0x0',
      gas: '0x5208',
      nonce: 0,
      deadline,
      data: '0x',
      signature: sig0,
    });
    assert.strictEqual(res0.success, true);

    // 2차 동일 Nonce 0 재시도 -> 실패
    await assert.rejects(
      async () => {
        await relayerService.dispatch({
          from: wallet.address,
          to: '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6',
          value: '0x0',
          gas: '0x5208',
          nonce: 0,
          deadline,
          data: '0x',
          signature: sig0,
        });
      },
      (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('Invalid nonce'));
        return true;
      },
    );
  });

  console.log('\n================================================================');
  console.log(`🎉 모든 Relayer E2E 테스트 완료! (${passedTests}/${totalTests} PASS)`);
  console.log('================================================================\n');
}

runRelayerE2ETests().catch((err) => {
  console.error('Relayer E2E test crashed:', err);
  process.exit(1);
});
