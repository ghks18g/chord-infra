import assert from 'node:assert';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { SolcCompilerService } from '../src/verifier/solc-compiler.service';
import {
  stripCborMetadata,
  extractCborMetadata,
  compareBytecodes,
  normalizeBytecode,
} from '../src/verifier/cbor.util';
import { ContractVerifierService } from '../src/verifier/contract-verifier.service';
import { ContractRepository, ContractVerificationRepository, AddressTagRepository } from '@chordscan/database';
import { ContractVerificationDTO } from '@chordscan/types';

const dummyTagRepo = {
  upsertTag: async () => {},
} as unknown as AddressTagRepository;


// ERC-20 표준 컨트랙트 샘플
const ERC20_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ERC20Token {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply * (10 ** uint256(decimals));
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }
}
`;

// Ownable 관리자 컨트랙트 샘플
const OWNABLE_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
`;

async function runTests() {
  console.log('====================================================');
  console.log('🚀 ChordScan 스마트 컨트랙트 검증 엔진 테스트 시작');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

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

  const compilerService = new SolcCompilerService();

  // ------------------------------------------------------------------
  // 1. SolcCompilerService 단위 테스트
  // ------------------------------------------------------------------
  console.log('▶ [1] solc 컴파일러 엔진 메모리 격리 컴파일 검증');

  await test('ERC20Token 실제 Solidity 컴파일 및 ABI/Bytecode 추출', async () => {
    const res = await compilerService.compile({
      sourceCode: ERC20_SOURCE,
      contractName: 'ERC20Token',
      optimizerEnabled: true,
      optimizerRuns: 200,
    });

    assert.strictEqual(res.contractName, 'ERC20Token');
    assert.ok(Array.isArray(res.abi), 'ABI는 배열이어야 함');
    assert.ok(res.abi.length > 5, 'ERC-20 함수 및 이벤트 ABI가 존재해야 함');
    assert.ok(res.deployedBytecode.startsWith('0x'), 'deployedBytecode는 0x로 시작해야 함');
    assert.ok(res.bytecode.startsWith('0x'), 'creation bytecode는 0x로 시작해야 함');
    assert.ok(res.deployedBytecode.length > 100, '런타임 바이트코드가 유효해야 함');
    assert.ok(res.bytecode.length > res.deployedBytecode.length, 'Creation 바이트코드가 더 커야 함');

    // ABI에 필수 함수들이 포함되어 있는지 검증
    const functionNames = (res.abi as { type: string; name?: string }[])
      .filter((item) => item.type === 'function')
      .map((item) => item.name);
    assert.ok(functionNames.includes('transfer'));
    assert.ok(functionNames.includes('balanceOf'));
    assert.ok(functionNames.includes('approve'));
  });

  await test('Ownable 컨트랙트 컴파일 및 EVM 설정 검증', async () => {
    const res = await compilerService.compile({
      sourceCode: OWNABLE_SOURCE,
      contractName: 'Ownable',
      optimizerEnabled: false,
    });

    assert.strictEqual(res.contractName, 'Ownable');
    assert.ok(res.deployedBytecode.length > 0);
  });

  await test('존재하지 않는 컨트랙트 명칭 요청 시 명확한 에러 발생', async () => {
    await assert.rejects(
      async () => {
        await compilerService.compile({
          sourceCode: OWNABLE_SOURCE,
          contractName: 'NonExistentContract',
        });
      },
      (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('not found in compilation artifacts'));
        return true;
      },
    );
  });

  await test('Solidity 문법 오류 시 컴파일러 에러 메시지 포맷팅 검증', async () => {
    const badSource = `pragma solidity ^0.8.20; contract Broken { syntax_error_here }`;
    await assert.rejects(
      async () => {
        await compilerService.compile({
          sourceCode: badSource,
          contractName: 'Broken',
        });
      },
      (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('Solidity compilation error'));
        return true;
      },
    );
  });

  // ------------------------------------------------------------------
  // 2. EVM 표준 CBOR 메타데이터 트렁케이트 알고리즘 검증
  // ------------------------------------------------------------------
  console.log('\n▶ [2] EVM 표준 CBOR 메타데이터 트렁케이트 규격 검증');

  await test('solc 실제 생성 바이트코드의 2바이트 CBOR 빅엔디안 파싱 및 제거', async () => {
    const compiled = await compilerService.compile({
      sourceCode: OWNABLE_SOURCE,
      contractName: 'Ownable',
    });

    const rawHex = normalizeBytecode(compiled.deployedBytecode);
    const meta = extractCborMetadata(compiled.deployedBytecode);

    assert.ok(meta !== null, 'CBOR 메타데이터가 정상 추출되어야 함');
    assert.ok(meta.cborLength > 0, 'CBOR 길이는 0보다 커야 함');

    // 메타데이터 전체 hex 길이 = (cborLength + 2) * 2
    const expectedMetaHexLen = (meta.cborLength + 2) * 2;
    assert.strictEqual(meta.metadataHex.length, expectedMetaHexLen + 2); // '0x' 포함

    // stripCborMetadata 결과 확인
    const clean = stripCborMetadata(compiled.deployedBytecode);
    assert.strictEqual(clean, meta.cleanBytecode);
    assert.strictEqual(normalizeBytecode(clean).length, rawHex.length - expectedMetaHexLen);

    // 원본 바이트코드 끝부분에 파싱된 길이가 정확히 일치하는지 확인
    const end2Bytes = rawHex.slice(-4);
    assert.strictEqual(parseInt(end2Bytes, 16), meta.cborLength);
  });

  await test('메타데이터가 상이한 두 동일 소스코드의 cleanBytecode 100% 일치 검증', async () => {
    // 공백/주석 변경 시 metadata의 IPFS 해시는 달라지나 실행 바이트코드는 100% 동일
    const sourceWithComment1 = OWNABLE_SOURCE + '\n// Comment variation 1';
    const sourceWithComment2 = OWNABLE_SOURCE + '\n// Different comment variation 2';

    const comp1 = await compilerService.compile({
      sourceCode: sourceWithComment1,
      contractName: 'Ownable',
    });
    const comp2 = await compilerService.compile({
      sourceCode: sourceWithComment2,
      contractName: 'Ownable',
    });

    // 원본은 메타데이터(IPFS 해시) 때문에 다름
    assert.notStrictEqual(comp1.deployedBytecode, comp2.deployedBytecode);

    // 그러나 CBOR 트렁케이트 후에는 100% 일치해야 함!
    const compResult = compareBytecodes(comp1.deployedBytecode, comp2.deployedBytecode);
    assert.strictEqual(compResult.matches, true, 'CBOR 트렁케이트 후 바이트코드는 100% 일치해야 함');
    assert.strictEqual(compResult.cleanOnChainBytecode, compResult.cleanCompiledBytecode);
  });

  await test('실제 바이트코드 변조 시 compareBytecodes의 상세 Diff 검출 검증', async () => {
    const comp = await compilerService.compile({
      sourceCode: OWNABLE_SOURCE,
      contractName: 'Ownable',
    });

    // 바이트코드 일부 변조 (clean[30]은 'f'이므로 'aa'로 변경 시 index 30에서 불일치 발생)
    const clean = stripCborMetadata(comp.deployedBytecode);
    const tampered = clean.slice(0, 30) + 'aa' + clean.slice(32);

    const compResult = compareBytecodes(tampered, comp.deployedBytecode);
    assert.strictEqual(compResult.matches, false);
    assert.ok(compResult.diff !== undefined);
    assert.ok(compResult.diff.includes('First mismatch at character index 30'));
    assert.ok(compResult.diff.includes('On-chain'));
    assert.ok(compResult.diff.includes('Compiled'));
  });

  await test('CBOR 트렁케이트 엣지 케이스 (0x 누락, 대소문자 혼합, 짧은 바이트)', () => {
    // 0x 유무와 대소문자 무관하게 정규화
    // 끝 2바이트 0x0002 -> cborLen 2바이트 -> 총 메타데이터 (2+2)*2 = 8 hex chars (5b500002) 제거
    const sampleHex = '608060405234801561001057600080fd5b500002';
    const withPrefix = `0x${sampleHex}`;
    const upper = `0X${sampleHex.toUpperCase()}`;

    const clean1 = stripCborMetadata(withPrefix);
    const clean2 = stripCborMetadata(upper);
    assert.strictEqual(clean1, clean2);
    assert.strictEqual(clean1, '0x608060405234801561001057600080fd');

    // 너무 짧은 바이트코드
    assert.strictEqual(stripCborMetadata('0x12'), '0x12');
    assert.strictEqual(stripCborMetadata(''), '0x');
  });

  // ------------------------------------------------------------------
  // 3. 온체인 RPC 런타임 바이트코드 조회 검증
  // ------------------------------------------------------------------
  console.log('\n▶ [3] 온체인 RPC 연동 및 eth_getCode 유효성 검증');

  await test('CHORD L1 RPC (8545) 미배포 주소 조회 시 BadRequestException 발생', async () => {
    // 실제 기동 중인 CHORD-L1 RPC(http://127.0.0.1:8545) 호출 테스트
    const dummyContractRepo = {
      findOneByAddress: async () => null,
      updateVerifiedStatus: async () => {},
      createContract: async () => ({ address: '0x' }),
    } as unknown as ContractRepository;

    const dummyVerificationRepo = {
      createLog: async () => ({ id: 1 }),
    } as unknown as ContractVerificationRepository;

    const dummyDataSource = {
      transaction: async (cb: (m: EntityManager) => Promise<unknown>) => cb({} as EntityManager),
    } as unknown as DataSource;

    const verifier = new ContractVerifierService(
      dummyDataSource,
      dummyContractRepo,
      dummyVerificationRepo,
      dummyTagRepo,
      compilerService,
    );

    // 미배포 빈 주소(0x111111...) 조회 시 0x가 반환되므로 예외가 발생해야 함
    await assert.rejects(
      async () => {
        await verifier.fetchOnChainBytecode('0x1111111111111111111111111111111111111111');
      },
      (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('No on-chain runtime bytecode found'));
        return true;
      },
    );
  });

  // ------------------------------------------------------------------
  // 4. Sentinel 아키텍처 원자적 DB 트랜잭션 전파 및 verifyAndPublish 통합 검증
  // ------------------------------------------------------------------
  console.log('\n▶ [4] Sentinel 트랜잭션 전파 및 verifyAndPublish 통합 검증');

  await test('성공 케이스: 온체인 바이트코드 매칭 시 단일 트랜잭션 내에서 원자적 DB 갱신', async () => {
    // 실제 컴파일을 먼저 수행하여 예상 배포 바이트코드를 획득
    const comp = await compilerService.compile({
      sourceCode: ERC20_SOURCE,
      contractName: 'ERC20Token',
      optimizerEnabled: true,
      optimizerRuns: 200,
    });

    const mockContractAddress = '0xAbCd1234567890AbCd1234567890AbCd12345678';

    // Mock 트랜잭션 매니저 및 리포지토리 구성
    let transactionExecuted = false;
    let updateStatusCalledWithManager = false;
    let createLogCalledWithManager = false;
    let savedMatchedBytecode = '';

    const mockManager = { id: 'mock-tx-manager-token' } as unknown as EntityManager;

    const mockDataSource = {
      transaction: async (runInTx: (m: EntityManager) => Promise<unknown>) => {
        transactionExecuted = true;
        return runInTx(mockManager);
      },
    } as unknown as DataSource;

    const mockContractRepo = {
      findOneByAddress: async (address: string) => ({
        address,
        isVerified: false,
      }),
      createContract: async () => ({ address: mockContractAddress }),
      updateVerifiedStatus: async (
        address: string,
        data: { name: string; sourceCode: string; compilerVersion: string; abi: unknown },
        em?: EntityManager,
      ) => {
        assert.strictEqual(address, mockContractAddress);
        assert.strictEqual(data.name, 'ERC20Token');
        assert.strictEqual(em, mockManager);
        updateStatusCalledWithManager = true;
      },
    } as unknown as ContractRepository;

    const mockVerificationRepo = {
      createLog: async (
        dto: {
          contractAddress: string;
          status: string;
          matchedBytecode: string;
        },
        em?: EntityManager,
      ) => {
        assert.strictEqual(dto.contractAddress, mockContractAddress);
        assert.strictEqual(dto.status, 'SUCCESS');
        assert.strictEqual(em, mockManager);
        createLogCalledWithManager = true;
        savedMatchedBytecode = dto.matchedBytecode;
      },
    } as unknown as ContractVerificationRepository;

    const verifier = new ContractVerifierService(
      mockDataSource,
      mockContractRepo,
      mockVerificationRepo,
      dummyTagRepo,
      compilerService,
    );

    // 온체인 RPC 조회를 mock 바이트코드(실제 컴파일된 런타임 바이트코드)로 모킹
    verifier.fetchOnChainBytecode = async () => comp.deployedBytecode;

    const dto: ContractVerificationDTO = {
      contractAddress: mockContractAddress,
      contractName: 'ERC20Token',
      sourceCode: ERC20_SOURCE,
      compilerVersion: 'v0.8.37',
      optimizerEnabled: true,
      optimizerRuns: 200,
    };

    const result = await verifier.verifyAndPublish(dto);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.message, 'Contract verification succeeded');
    assert.strictEqual(transactionExecuted, true, 'DB 트랜잭션이 수행되어야 함');
    assert.strictEqual(updateStatusCalledWithManager, true, 'ContractRepo에 manager가 전달되어야 함');
    assert.strictEqual(createLogCalledWithManager, true, 'VerificationRepo에 manager가 전달되어야 함');
    assert.strictEqual(
      savedMatchedBytecode,
      stripCborMetadata(comp.deployedBytecode),
      '저장된 매칭 바이트코드는 CBOR 트렁케이트된 바이트코드여야 함',
    );
  });

  await test('실패 케이스: 바이트코드 불일치 시 트랜잭션 롤백 및 실패 감사 로그 기록', async () => {
    const mockContractAddress = '0xDeadDeAd12345678901234567890123456789012';

    let txExecuted = false;
    let failedLogRecorded = false;

    const mockDataSource = {
      transaction: async (runInTx: (m: EntityManager) => Promise<unknown>) => {
        txExecuted = true;
        return runInTx({} as EntityManager);
      },
    } as unknown as DataSource;

    const mockContractRepo = {
      findOneByAddress: async (address: string) => ({ address, isVerified: false }),
    } as unknown as ContractRepository;

    const mockVerificationRepo = {
      createLog: async (dto: { status: string; errorLog?: string }) => {
        if (dto.status === 'FAILED') {
          failedLogRecorded = true;
        }
      },
    } as unknown as ContractVerificationRepository;

    const verifier = new ContractVerifierService(
      mockDataSource,
      mockContractRepo,
      mockVerificationRepo,
      dummyTagRepo,
      compilerService,
    );

    // 온체인 바이트코드를 임의의 다른 바이트코드로 반환
    verifier.fetchOnChainBytecode = async () => '0x608060405234801561001057600080fd5b50000000000033';

    await assert.rejects(
      async () => {
        await verifier.verifyAndPublish({
          contractAddress: mockContractAddress,
          contractName: 'Ownable',
          sourceCode: OWNABLE_SOURCE,
          compilerVersion: 'v0.8.37',
        });
      },
      (err: Error) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('Bytecode mismatch during verification'));
        return true;
      },
    );

    assert.strictEqual(txExecuted, false, '바이트코드 불일치 시 성공 DB 트랜잭션은 실행되지 않아야 함');
    assert.strictEqual(failedLogRecorded, true, '실패 감사 로그가 기록되어야 함');
  });

  await test('이미 검증된 컨트랙트 재요청 시 early-return 처리', async () => {
    const mockContractRepo = {
      findOneByAddress: async () => ({ address: '0x123', isVerified: true }),
    } as unknown as ContractRepository;

    const verifier = new ContractVerifierService(
      {} as DataSource,
      mockContractRepo,
      {} as ContractVerificationRepository,
      dummyTagRepo,
      compilerService,
    );

    const res = await verifier.verifyAndPublish({
      contractAddress: '0x123',
      contractName: 'AlreadyVerified',
      sourceCode: '',
      compilerVersion: 'v0.8.37',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.message, 'Contract is already verified');
  });

  console.log('\n====================================================');
  console.log(`🎉 모든 테스트 완료! (${passedTests}/${totalTests} PASS)`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
