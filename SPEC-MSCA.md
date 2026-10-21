# Specification: chordscan (infra) MSCA & UserOperations Observability

> [!CAUTION]
> **아키텍처 경계 및 불변 원칙 (Architecture Boundary & Isolation Rule)**
> 1. **`apps/gas-relayer` 절대 수정 금지 (DO NOT TOUCH):**
>    - 기존 `gas-relayer`는 EIP-712 / EIP-2771 (`ChordForwarder.sol`) 메타트랜잭션을 처리하는 독립된 큐/릴레이어 인프라입니다.
>    - ERC-4337 MSCA용 Paymaster와 Bundler는 신규 레포지토리인 **`chord-msca`에 별도 구축**되며, 기존 `gas-relayer`와 일절 혼용하거나 수정하지 않습니다.
> 2. **`chordscan`의 단일 책임: 순수 관측 및 조회 (Read-Only Observability):**
>    - `chordscan`의 역할은 블록체인에 발생한 `UserOperationEvent`를 **수집(Index)하고 조회(API/UI)하는 탐색기 기능에만 엄격히 한정**됩니다.
>    - `apps/contract-verifier` 등 기존 다른 앱도 일절 수정하지 않습니다.

---

## 1. 개요 및 목적 (Overview & Goals)
- **대상 레포지토리:** `/Users/freddie/Documents/freddie/chordscan`
- **수정 대상 디렉터리 (오직 4곳으로 엄격히 한정):**
  1. `packages/database`: `UserOperation` 엔티티 추가
  2. `apps/indexer-api`: 태그 시딩(`0x100`, `EntryPoint`) 및 `UserOperationEvent` 로그 파싱/저장
  3. `apps/scan-api`: UserOperation 조회용 읽기 전용 REST API 추가
  4. `apps/web`: 탐색기 화면에 프리컴파일 배지 및 트랜잭션 내 UserOperation 카드 노출
- **목적:** 기존 서비스 간 결합도(Spaghetti) 없이, 온체인에서 발생한 4337 계정 추상화 이벤트와 프리컴파일 주소를 탐색기에서 정합성 있게 관측할 수 있도록 지원.

---

## 2. 개발 환경 및 필수 설정 (Environment & Toolchain)
- **패키지 매니저:** Node.js (v20+), npm, Turborepo
- **빌드 명령어:** `npm run build` (Turborepo 10개 패키지 빌드)
- **주의사항:** 기존 `@chordscan/gas-relayer`, `@chordscan/contract-verifier` 빌드에 영향이 없어야 함.

---

## 3. 세부 작업 항목 (Implementation Tasks)

### Task 1. Database 엔티티 정의 (`packages/database`)
1. **`UserOperation` 엔티티 생성 (`packages/database/src/entities/user-operation.entity.ts`):**
   - 순수 온체인 이벤트 로그 저장용 읽기 엔티티:
     - `userOpHash` (PrimaryColumn, varchar 66)
     - `txHash` (varchar 66, Index)
     - `blockHeight` (bigint, Index)
     - `sender` (varchar 42, Index: 스마트 계정 주소)
     - `paymaster` (varchar 42, nullable: 4337 가스비 스폰서 주소)
     - `nonce` (varchar 78)
     - `success` (boolean, default: true)
     - `actualGasCost` (varchar 78, default: '0')
     - `actualGasUsed` (varchar 78, default: '0')
     - `createdAt` (CreateDateColumn, timestamptz)
2. **Export 및 DataSource 등록:**
   - `packages/database/src/index.ts`에 `UserOperation` export.
   - `packages/database/src/data-source.ts`의 `entities` 배열에 `UserOperation` 추가.

### Task 2. Genesis Address Tags 시딩 (`apps/indexer-api/src/indexer/indexer.service.ts`)
`seedGenesisTags()` 메서드에 시스템 태그 2건만 추가 (기존 태그 로직 유지):
1. **RIP-7212 프리컴파일:**
   - `address`: `'0x0000000000000000000000000000000000000100'`
   - `nameTag`: `'Precompile: RIP-7212 (P256VERIFY)'`
   - `category`: `'Precompile'`
   - `description`: `'NIST P-256 (secp256r1) signature verification for WebAuthn/Passkey'`
   - `source`: `'system'`, `isOfficial`: `true`
2. **ERC-4337 EntryPoint v0.7:**
   - `address`: `'0x0000000071727De22E5E9d8BAf0edAc6f37da032'`
   - `nameTag`: `'EntryPoint v0.7'`
   - `category`: `'Account Abstraction'`
   - `description`: `'ERC-4337 Official EntryPoint v0.7 contract'`
   - `source`: `'system'`, `isOfficial`: `true`

### Task 3. UserOperation 이벤트 수집 (`apps/indexer-api`)
- **이벤트 필터링:** 트랜잭션 Receipt의 `logs`를 순회하며 다음 토픽을 감지:
  - `Topic0`: `0x496286144a3fa0b6395488282998c6897f63a4963032fa7da333b5b10b719ae4`
  - 이벤트 시그니처: `UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)`
- **동작:**
  - 파싱된 필드를 `UserOperation` 테이블에 삽입 (기존 트랜잭션 수집 파이프라인에 영향 주지 않는 비동기 try-catch 안전 처리).

### Task 4. Scan API 조회 엔드포인트 (`apps/scan-api`)
기존 API 라우트와 격리된 신규 모듈/컨트롤러 구성:
1. **`GET /api/user-ops`**: 최근 UserOperation 목록 조회 (페이징 `limit`, `offset` 지원).
2. **`GET /api/user-ops/:userOpHash`**: 단일 UserOperation 상세 조회.
3. **`GET /api/txs/:hash` 확장:** 응답 객체에 `userOperations: UserOperation[]` 필드 첨부 (없으면 빈 배열 `[]`).
4. **`GET /api/address/:address` 확장:** 해당 주소와 연관된 UserOperation 개수 정보 첨부.

### Task 5. 탐색기 Web UI 노출 (`apps/web`)
1. **주소 상세 페이지 (`apps/web/app/address/[address]/page.tsx`):**
   - 주소가 `0x0000000000000000000000000000000000000100`인 경우:
     - 공식 배지 `Precompile: RIP-7212 (P256VERIFY)` 표시.
   - 주소가 `0x0000000071727De22E5E9d8BAf0edAc6f37da032`인 경우:
     - 공식 배지 `EntryPoint v0.7` 표시.
2. **트랜잭션 상세 페이지 (`apps/web/app/tx/[hash]/page.tsx`):**
   - 트랜잭션 데이터에 `userOperations`가 1개 이상 존재할 때만 **"UserOperations (ERC-4337)"** 카드 섹션을 렌더링:
     - UserOp Hash (단축 및 복사 기능)
     - Sender (스마트 계정 링크)
     - Paymaster (스폰서 링크 또는 `None`)
     - Status (성공/실패)
     - Gas Used / Gas Cost

---

## 4. 테스트 케이스 및 검증 기준 (Definition of Done)

### 필수 검증 항목
1. **격리성 검증 (Regression Check):**
   - `apps/gas-relayer`의 기존 EIP-712/EIP-2771 포워더 릴레이 기능에 코드 변경이 전혀 없어야 함 (`git diff apps/gas-relayer` 결과 없음).
2. **전체 모노레포 빌드:**
   - Turborepo 10개 패키지 전체 빌드 성공 (`npm run build`).
3. **Genesis Tags 시딩 검증:**
   - `indexer-api` 실행 시 `address_tags` 테이블에 `0x100`과 `EntryPoint` 태그가 성공적으로 입력되는지 확인.
4. **API 및 웹 렌더링 무결성:**
   - Next.js 웹 앱 빌드 시 타입 에러(0 Type Errors).
   - `/api/user-ops` 엔드포인트 200 OK 응답.

### 통과 기준 (Pass Condition)
```bash
cd /Users/freddie/Documents/freddie/chordscan

# 1. gas-relayer 건드리지 않았는지 diff 확인 (변경 없어야 함)
git status apps/gas-relayer packages/queue

# 2. 10개 패키지 빌드 100% 통과 (Exit code: 0)
npm run build
```
위 빌드가 오류 없이 10/10 성공으로 종료되면 작업 완료로 승인합니다.
