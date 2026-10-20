import { Interface, AbiCoder, getAddress } from 'ethers';

export interface DecodedParam {
  name: string;
  type: string;
  value: string;
  indexed?: boolean;
}

export interface DecodedMethod {
  name: string;
  signature: string;
  methodId: string;
  isVerified: boolean;
  isStandard?: boolean;
  standardType?: 'ERC-20' | 'ERC-721' | 'ERC-1155' | 'EIP-2771' | 'Faucet Standard';
  unverifiedNotice?: string;
  params: DecodedParam[];
}

export interface DecodedLog {
  logIndex: number;
  address: string;
  contractName?: string;
  isVerified: boolean;
  isStandard?: boolean;
  standardType?: 'ERC-20' | 'ERC-721' | 'ERC-1155' | 'EIP-2771' | 'Faucet Standard';
  eventName: string;
  signature: string;
  topics: string[];
  data: string;
  decodedArgs?: DecodedParam[];
}

export interface TokenTransferItem {
  type: 'NATIVE' | 'ERC-20' | 'ERC-721' | 'ERC-1155';
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  from: string;
  to: string;
  value?: string;
  formattedValue?: string;
  tokenId?: string;
  logIndex?: number;
}

// Global EIP Standard Event Topics
export const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const ERC20_APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
export const ERC1155_SINGLE_TOPIC = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
export const ERC1155_BATCH_TOPIC = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';
export const APPROVAL_FOR_ALL_TOPIC = '0x17307eab39ac6107b30323b449b40973673c00992738ec25d9dc4073829a3423';

// Standard EIP Interfaces for fallback decoding of verified token contracts
const EIP_STANDARD_FUNCTION_IFACE = new Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
  'function setApprovalForAll(address operator, bool approved)',
]);

function getAddressFromTopic(topicHex: string): string {
  if (!topicHex) return '0x0000000000000000000000000000000000000000';
  const clean = topicHex.replace(/^0x/, '');
  const addr20 = clean.slice(-40);
  try {
    return getAddress('0x' + addr20);
  } catch {
    return '0x' + addr20;
  }
}

function formatTokenAmount(val: bigint): string {
  if (val === 0n) return '0';
  const dec = 18n;
  const divisor = 10n ** dec;
  const integerPart = val / divisor;
  const remainder = val % divisor;

  if (remainder === 0n) {
    return integerPart.toLocaleString();
  }
  const fracStr = remainder.toString(10).padStart(18, '0').slice(0, 4).replace(/0+$/, '');
  return `${integerPart.toLocaleString()}.${fracStr}`;
}

function formatArgValue(val: any, type: string): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'bigint') return val.toString(10);
  if (type === 'address') {
    return String(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map((item) => formatArgValue(item, 'unknown')).join(', ')}]`;
  }
  if (typeof val === 'object' && val.toString) {
    return val.toString();
  }
  return String(val);
}

/**
 * Dynamically decodes transaction input calldata based on verified contract ABI,
 * or globally recognized EIP token standards (ERC-20/721/1155).
 * Non-standard calls to unverified contracts return raw 4-byte MethodID hex.
 */
export function decodeTransactionInput(
  data: string | undefined | null,
  value: string | undefined | null,
  isDeploy: boolean,
  contractAbi: any | null,
  contractName?: string | null,
): DecodedMethod {
  const rawData = data || '0x';
  const hasData = rawData && rawData !== '0x' && rawData !== '0x0';

  // 1. Contract Creation (Deploy)
  if (isDeploy) {
    if (contractAbi && Array.isArray(contractAbi)) {
      try {
        const iface = new Interface(contractAbi);
        const deployFragment = iface.deploy;
        if (deployFragment && deployFragment.inputs.length > 0) {
          let decodedParams: DecodedParam[] = [];
          try {
            const types = deployFragment.inputs.map((i) => i.type);
            const abiCoder = AbiCoder.defaultAbiCoder();
            const paramBytes = deployFragment.inputs.length * 32 * 2;
            if (rawData.length >= paramBytes + 2) {
              const argSlice = '0x' + rawData.slice(-paramBytes);
              const decoded = abiCoder.decode(types, argSlice);
              decodedParams = deployFragment.inputs.map((input, idx) => ({
                name: input.name || `arg${idx}`,
                type: input.type,
                value: formatArgValue(decoded[idx], input.type),
              }));
            }
          } catch {
            decodedParams = deployFragment.inputs.map((input) => ({
              name: input.name,
              type: input.type,
              value: '(Constructor parameter present)',
            }));
          }

          return {
            name: `Contract Creation (${contractName || 'Verified Contract'})`,
            signature: `constructor(${deployFragment.inputs.map((i) => `${i.type} ${i.name}`).join(', ')})`,
            methodId: '0xDEPLOY',
            isVerified: true,
            params: decodedParams,
          };
        }

        return {
          name: `Contract Creation (${contractName || 'Verified Contract'})`,
          signature: 'constructor()',
          methodId: '0xDEPLOY',
          isVerified: true,
          params: [],
        };
      } catch (e) {
        console.warn('[Decoder] Contract constructor ABI parse error:', e);
      }
    }

    return {
      name: 'Contract Creation (Unverified)',
      signature: 'Deploy Bytecode',
      methodId: '0xDEPLOY',
      isVerified: false,
      unverifiedNotice:
        'Contract source code is unverified. Bytecode and constructor parameters will be decoded after contract verification.',
      params: [],
    };
  }

  // 2. Verified Contract ABI Function Call
  if (contractAbi && Array.isArray(contractAbi) && hasData) {
    try {
      const iface = new Interface(contractAbi);
      const parsed = iface.parseTransaction({ data: rawData, value: value || '0' });
      if (parsed) {
        const params: DecodedParam[] = parsed.fragment.inputs.map((input, idx) => ({
          name: input.name || `param${idx}`,
          type: input.type,
          value: formatArgValue(parsed.args[idx], input.type),
        }));

        return {
          name: parsed.name,
          signature: parsed.signature,
          methodId: rawData.slice(0, 10),
          isVerified: true,
          params,
        };
      }
    } catch {
      // Failed to match verified ABI
    }
  }

  // 3. EIP Standard Token Functions (ERC-20 / ERC-721 / ERC-1155)
  if (hasData && rawData.length >= 10) {
    try {
      const parsed = EIP_STANDARD_FUNCTION_IFACE.parseTransaction({
        data: rawData,
        value: value || '0',
      });
      if (parsed) {
        const params: DecodedParam[] = parsed.fragment.inputs.map((input, idx) => ({
          name: input.name || `param${idx}`,
          type: input.type,
          value: formatArgValue(parsed.args[idx], input.type),
        }));

        let standardType: 'ERC-20' | 'ERC-721' | 'ERC-1155' = 'ERC-20';
        if (parsed.name.includes('Single') || parsed.name.includes('Batch')) {
          standardType = 'ERC-1155';
        } else if (parsed.name === 'safeTransferFrom' && parsed.fragment.inputs.length === 3) {
          standardType = 'ERC-721';
        }

        return {
          name: `${parsed.name} (${standardType})`,
          signature: parsed.signature,
          methodId: rawData.slice(0, 10),
          isVerified: false,
          isStandard: true,
          standardType,
          params,
        };
      }
    } catch {
      // Not a standard EIP token method
    }
  }

  // 4. Native Transfer (Empty calldata or zero data)
  if (!hasData || rawData === '0x') {
    return {
      name: 'Transfer',
      signature: 'transfer()',
      methodId: '0x',
      isVerified: true,
      params: [],
    };
  }

  // 5. Unverified Custom Contract Call: Strictly display authentic 4-byte 0x hex MethodID
  const methodId = rawData.slice(0, 10);
  return {
    name: methodId,
    signature: methodId,
    methodId,
    isVerified: false,
    unverifiedNotice:
      'Contract source code is unverified. Function signature and parameters cannot be decoded without verified ABI.',
    params: [],
  };
}

/**
 * Dynamically decodes event logs based on verified contract ABI,
 * or globally recognized EIP token standards (ERC-20, ERC-721, ERC-1155).
 * Non-standard events on unverified contracts strictly retain raw Topics and Data.
 */
export function decodeEventLog(
  log: any,
  index: number,
  contractAbi: any | null,
  contractName?: string | null,
): DecodedLog {
  const topics: string[] = log.topics || [];
  const data: string = log.data || '0x';
  const logIndex =
    typeof log.logIndex === 'string'
      ? parseInt(log.logIndex, 16) || index
      : log.logIndex ?? index;

  if (topics.length === 0) {
    return {
      logIndex,
      address: log.address,
      contractName: contractName || undefined,
      isVerified: false,
      eventName: 'Anonymous Event',
      signature: 'Anonymous()',
      topics,
      data,
    };
  }

  // 1. Try verified contract ABI
  if (contractAbi && Array.isArray(contractAbi)) {
    try {
      const iface = new Interface(contractAbi);
      const parsedLog = iface.parseLog({ topics, data });
      if (parsedLog) {
        const decodedArgs: DecodedParam[] = parsedLog.fragment.inputs.map((input, idx) => ({
          name: input.name || `arg${idx}`,
          type: input.type,
          indexed: input.indexed,
          value: formatArgValue(parsedLog.args[idx], input.type),
        }));

        return {
          logIndex,
          address: log.address,
          contractName: contractName || undefined,
          isVerified: true,
          eventName: parsedLog.name,
          signature: parsedLog.signature,
          topics,
          data,
          decodedArgs,
        };
      }
    } catch {
      // Fall through to EIP standard parser
    }
  }

  // 2. Globally Recognized EIP Standard Token Events (ERC-20 / ERC-721 / ERC-1155)
  const top0 = topics[0].toLowerCase();

  // 2-A. ERC-20 / ERC-721 Transfer
  if (top0 === ERC20_TRANSFER_TOPIC.toLowerCase()) {
    try {
      const from = getAddressFromTopic(topics[1]);
      const to = getAddressFromTopic(topics[2]);

      if (topics.length === 3) {
        // ERC-20 Transfer: from (indexed), to (indexed), value (data)
        const rawVal = BigInt(data && data !== '0x' ? data : '0');
        return {
          logIndex,
          address: log.address,
          contractName: contractName || undefined,
          isVerified: false,
          isStandard: true,
          standardType: 'ERC-20',
          eventName: 'Transfer',
          signature: 'Transfer(address indexed from, address indexed to, uint256 value)',
          topics,
          data,
          decodedArgs: [
            { name: 'from', type: 'address', value: from, indexed: true },
            { name: 'to', type: 'address', value: to, indexed: true },
            { name: 'value', type: 'uint256', value: rawVal.toString(10) },
          ],
        };
      }

      if (topics.length === 4) {
        // ERC-721 Transfer: from (indexed), to (indexed), tokenId (indexed)
        const tokenId = BigInt(topics[3] || '0').toString(10);
        return {
          logIndex,
          address: log.address,
          contractName: contractName || undefined,
          isVerified: false,
          isStandard: true,
          standardType: 'ERC-721',
          eventName: 'Transfer',
          signature: 'Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
          topics,
          data,
          decodedArgs: [
            { name: 'from', type: 'address', value: from, indexed: true },
            { name: 'to', type: 'address', value: to, indexed: true },
            { name: 'tokenId', type: 'uint256', value: tokenId, indexed: true },
          ],
        };
      }
    } catch {}
  }

  // 2-B. ERC-20 / ERC-721 Approval
  if (top0 === ERC20_APPROVAL_TOPIC.toLowerCase()) {
    try {
      const owner = getAddressFromTopic(topics[1]);
      const spender = getAddressFromTopic(topics[2]);

      if (topics.length === 3) {
        const rawVal = BigInt(data && data !== '0x' ? data : '0');
        return {
          logIndex,
          address: log.address,
          contractName: contractName || undefined,
          isVerified: false,
          isStandard: true,
          standardType: 'ERC-20',
          eventName: 'Approval',
          signature: 'Approval(address indexed owner, address indexed spender, uint256 value)',
          topics,
          data,
          decodedArgs: [
            { name: 'owner', type: 'address', value: owner, indexed: true },
            { name: 'spender', type: 'address', value: spender, indexed: true },
            { name: 'value', type: 'uint256', value: rawVal.toString(10) },
          ],
        };
      }

      if (topics.length === 4) {
        const tokenId = BigInt(topics[3] || '0').toString(10);
        return {
          logIndex,
          address: log.address,
          contractName: contractName || undefined,
          isVerified: false,
          isStandard: true,
          standardType: 'ERC-721',
          eventName: 'Approval',
          signature: 'Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
          topics,
          data,
          decodedArgs: [
            { name: 'owner', type: 'address', value: owner, indexed: true },
            { name: 'approved', type: 'address', value: spender, indexed: true },
            { name: 'tokenId', type: 'uint256', value: tokenId, indexed: true },
          ],
        };
      }
    } catch {}
  }

  // 2-C. ERC-1155 TransferSingle
  if (top0 === ERC1155_SINGLE_TOPIC.toLowerCase() && topics.length >= 4) {
    try {
      const operator = getAddressFromTopic(topics[1]);
      const from = getAddressFromTopic(topics[2]);
      const to = getAddressFromTopic(topics[3]);
      const cleanData = (data || '0x').replace(/^0x/, '');
      const id = BigInt('0x' + (cleanData.slice(0, 64) || '0')).toString(10);
      const value = BigInt('0x' + (cleanData.slice(64, 128) || '0')).toString(10);

      return {
        logIndex,
        address: log.address,
        contractName: contractName || undefined,
        isVerified: false,
        isStandard: true,
        standardType: 'ERC-1155',
        eventName: 'TransferSingle',
        signature: 'TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
        topics,
        data,
        decodedArgs: [
          { name: 'operator', type: 'address', value: operator, indexed: true },
          { name: 'from', type: 'address', value: from, indexed: true },
          { name: 'to', type: 'address', value: to, indexed: true },
          { name: 'id', type: 'uint256', value: id },
          { name: 'value', type: 'uint256', value },
        ],
      };
    } catch {}
  }

  // 2-D. ERC-1155 TransferBatch
  if (top0 === ERC1155_BATCH_TOPIC.toLowerCase() && topics.length >= 4) {
    try {
      const operator = getAddressFromTopic(topics[1]);
      const from = getAddressFromTopic(topics[2]);
      const to = getAddressFromTopic(topics[3]);
      const decoded = AbiCoder.defaultAbiCoder().decode(['uint256[]', 'uint256[]'], data);
      const ids: bigint[] = decoded[0] || [];
      const values: bigint[] = decoded[1] || [];

      return {
        logIndex,
        address: log.address,
        contractName: contractName || undefined,
        isVerified: false,
        isStandard: true,
        standardType: 'ERC-1155',
        eventName: 'TransferBatch',
        signature: 'TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
        topics,
        data,
        decodedArgs: [
          { name: 'operator', type: 'address', value: operator, indexed: true },
          { name: 'from', type: 'address', value: from, indexed: true },
          { name: 'to', type: 'address', value: to, indexed: true },
          { name: 'ids', type: 'uint256[]', value: `[${ids.map((id) => id.toString(10)).join(', ')}]` },
          { name: 'values', type: 'uint256[]', value: `[${values.map((v) => v.toString(10)).join(', ')}]` },
        ],
      };
    } catch {}
  }

  // 2-E. ERC-721 / ERC-1155 ApprovalForAll
  if (top0 === APPROVAL_FOR_ALL_TOPIC.toLowerCase() && topics.length >= 3) {
    try {
      const owner = getAddressFromTopic(topics[1]);
      const operator = getAddressFromTopic(topics[2]);
      const approved = Boolean(BigInt(data && data !== '0x' ? data : '0'));

      return {
        logIndex,
        address: log.address,
        contractName: contractName || undefined,
        isVerified: false,
        isStandard: true,
        standardType: 'ERC-721',
        eventName: 'ApprovalForAll',
        signature: 'ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
        topics,
        data,
        decodedArgs: [
          { name: 'owner', type: 'address', value: owner, indexed: true },
          { name: 'operator', type: 'address', value: operator, indexed: true },
          { name: 'approved', type: 'bool', value: String(approved) },
        ],
      };
    } catch {}
  }

  // 2-F. EIP-2771 Meta-Transaction Forwarder Executed Event
  if (top0 === '0xd86b4c50733cb4dee05f54868a1f4fa6cf9347c09642e5496c23508a04cb79ff' && topics.length >= 3) {
    try {
      const from = getAddressFromTopic(topics[1]);
      const to = getAddressFromTopic(topics[2]);
      const cleanData = (data || '0x').replace(/^0x/, '');
      const success = cleanData.length >= 64 ? BigInt('0x' + cleanData.slice(0, 64)) === 1n : true;

      return {
        logIndex,
        address: log.address,
        contractName: contractName || 'ChordForwarder',
        isVerified: false,
        isStandard: true,
        standardType: 'EIP-2771',
        eventName: 'Executed',
        signature: 'Executed(address indexed from, address indexed to, bool success, bytes returndata)',
        topics,
        data,
        decodedArgs: [
          { name: 'from', type: 'address', value: from, indexed: true },
          { name: 'to', type: 'address', value: to, indexed: true },
          { name: 'success', type: 'bool', value: String(success) },
          { name: 'returndata', type: 'bytes', value: cleanData.length > 128 ? '0x' + cleanData.slice(128) : '0x' },
        ],
      };
    } catch {}
  }

  // 2-G. Chord L1 Faucet Claim Event
  if (top0 === '0x47cee97cb7acd717b3c0aa1435d004cd5b3c8c57d70dbceb4e4458bbd60e39d4' && topics.length >= 2) {
    try {
      const recipient = getAddressFromTopic(topics[1]);
      const rawVal = BigInt(data && data !== '0x' ? data : '0');

      return {
        logIndex,
        address: log.address,
        contractName: contractName || 'ChordFaucet',
        isVerified: true,
        isStandard: true,
        standardType: 'Faucet Standard',
        eventName: 'Claim',
        signature: 'Claim(address indexed recipient, uint256 amount)',
        topics,
        data,
        decodedArgs: [
          { name: 'recipient', type: 'address', value: recipient, indexed: true },
          { name: 'amount', type: 'uint256', value: rawVal.toString(10) },
        ],
      };
    } catch {}
  }

  // 3. Fallback for Custom Unverified Events: Strictly retain raw topics and hex data
  return {
    logIndex,
    address: log.address,
    contractName: contractName || undefined,
    isVerified: false,
    isStandard: false,
    eventName: topics[0] ? `${topics[0].slice(0, 10)}...` : 'Anonymous Event',
    signature: topics[0] || 'Anonymous',
    topics,
    data,
    decodedArgs: undefined,
  };
}

function safeGetAddress(addr: string | null | undefined): string {
  if (!addr) return '0x0000000000000000000000000000000000000000';
  try {
    return getAddress(addr.toLowerCase());
  } catch {
    return addr;
  }
}

/**
 * Extracts all Native Token and EIP Standard Token Transfers (ERC-20, ERC-721, ERC-1155)
 * for high-level Etherscan-style display in the transaction Overview tab.
 */
export function extractTokenTransfers(tx: {
  from: string;
  to: string | null;
  value: string;
  logs?: Array<{ address: string; topics: string[]; data: string; logIndex: string | number }>;
}): TokenTransferItem[] {
  const transfers: TokenTransferItem[] = [];

  const normTxFrom = safeGetAddress(tx.from);
  const normTxTo = tx.to ? safeGetAddress(tx.to) : null;

  // 1. Native Token Transfer (tx.value > 0)
  try {
    const valBig = BigInt(tx.value || '0');
    if (valBig > 0n && normTxTo) {
      transfers.push({
        type: 'NATIVE',
        tokenName: 'CHOR Native Token',
        tokenSymbol: 'CHOR',
        from: normTxFrom,
        to: normTxTo,
        value: tx.value,
        formattedValue: `${(Number(valBig) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 })} CHOR`,
      });
    }
  } catch {}

  // 2. Scan Transaction Event Logs
  if (Array.isArray(tx.logs)) {
    for (const log of tx.logs) {
      const topics = log.topics || [];
      const data = log.data || '0x';
      const logIdx =
        typeof log.logIndex === 'string'
          ? parseInt(log.logIndex, 16)
          : Number(log.logIndex ?? 0);

      if (topics.length === 0) continue;
      const top0 = topics[0].toLowerCase();
      const normLogAddr = safeGetAddress(log.address);

      // ERC-20 / ERC-721 Transfer
      if (top0 === ERC20_TRANSFER_TOPIC.toLowerCase()) {
        try {
          const from = safeGetAddress(getAddressFromTopic(topics[1]));
          const to = safeGetAddress(getAddressFromTopic(topics[2]));

          if (topics.length === 3) {
            // ERC-20
            const rawVal = BigInt(data && data !== '0x' ? data : '0');
            transfers.push({
              type: 'ERC-20',
              tokenAddress: normLogAddr,
              from,
              to,
              value: rawVal.toString(10),
              formattedValue: formatTokenAmount(rawVal),
              logIndex: logIdx,
            });
          } else if (topics.length === 4) {
            // ERC-721
            const tokenId = BigInt(topics[3] || '0').toString(10);
            transfers.push({
              type: 'ERC-721',
              tokenAddress: normLogAddr,
              from,
              to,
              tokenId,
              formattedValue: `Token ID #${tokenId}`,
              logIndex: logIdx,
            });
          }
        } catch {}
      }

      // Native Faucet Claim Distribution (10 CHOR Transfer from Faucet to Recipient)
      if (top0 === '0x47cee97cb7acd717b3c0aa1435d004cd5b3c8c57d70dbceb4e4458bbd60e39d4' && topics.length >= 2) {
        try {
          const recipient = safeGetAddress(getAddressFromTopic(topics[1]));
          const rawVal = BigInt(data && data !== '0x' ? data : '0');
          const existing = transfers.find(
            (t) =>
              t.type === 'NATIVE' &&
              t.from.toLowerCase() === normLogAddr.toLowerCase() &&
              t.to.toLowerCase() === recipient.toLowerCase(),
          );
          if (existing) {
            existing.tokenName = 'CHOR Native Token (Faucet Claim)';
            existing.logIndex = logIdx;
          } else {
            transfers.push({
              type: 'NATIVE',
              tokenName: 'CHOR Native Token (Faucet Claim)',
              tokenSymbol: 'CHOR',
              from: normLogAddr,
              to: recipient,
              value: rawVal.toString(10),
              formattedValue: `${(Number(rawVal) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 })} CHOR`,
              logIndex: logIdx,
            });
          }
        } catch {}
      }

      // Native Faucet Deposit
      if (top0 === '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c' && topics.length >= 2) {
        try {
          const sender = safeGetAddress(getAddressFromTopic(topics[1]));
          const rawVal = BigInt(data && data !== '0x' ? data : '0');
          // Check if this deposit was already captured by the root tx.value transfer
          const existing = transfers.find(
            (t) =>
              t.type === 'NATIVE' &&
              t.from.toLowerCase() === sender.toLowerCase() &&
              t.to.toLowerCase() === normLogAddr.toLowerCase() &&
              t.value === rawVal.toString(10),
          );
          if (existing) {
            existing.tokenName = 'CHOR Native Token (Deposit)';
            existing.logIndex = logIdx;
          } else {
            transfers.push({
              type: 'NATIVE',
              tokenName: 'CHOR Native Token (Deposit)',
              tokenSymbol: 'CHOR',
              from: sender,
              to: normLogAddr,
              value: rawVal.toString(10),
              formattedValue: `${(Number(rawVal) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 })} CHOR`,
              logIndex: logIdx,
            });
          }
        } catch {}
      }

      // ERC-1155 TransferSingle
      if (top0 === ERC1155_SINGLE_TOPIC.toLowerCase() && topics.length >= 4) {
        try {
          const from = getAddressFromTopic(topics[2]);
          const to = getAddressFromTopic(topics[3]);
          const cleanData = (data || '0x').replace(/^0x/, '');
          const id = BigInt('0x' + (cleanData.slice(0, 64) || '0')).toString(10);
          const value = BigInt('0x' + (cleanData.slice(64, 128) || '0')).toString(10);

          transfers.push({
            type: 'ERC-1155',
            tokenAddress: log.address,
            from,
            to,
            tokenId: id,
            value,
            formattedValue: `${Number(value).toLocaleString()} (Token ID #${id})`,
            logIndex: logIdx,
          });
        } catch {}
      }

      // ERC-1155 TransferBatch
      if (top0 === ERC1155_BATCH_TOPIC.toLowerCase() && topics.length >= 4) {
        try {
          const from = getAddressFromTopic(topics[2]);
          const to = getAddressFromTopic(topics[3]);
          const decoded = AbiCoder.defaultAbiCoder().decode(['uint256[]', 'uint256[]'], data);
          const ids: bigint[] = decoded[0] || [];
          const values: bigint[] = decoded[1] || [];

          for (let i = 0; i < ids.length; i++) {
            transfers.push({
              type: 'ERC-1155',
              tokenAddress: log.address,
              from,
              to,
              tokenId: ids[i].toString(10),
              value: values[i]?.toString(10) || '0',
              formattedValue: `${Number(values[i] || 0).toLocaleString()} (Token ID #${ids[i].toString(10)})`,
              logIndex: logIdx,
            });
          }
        } catch {}
      }
    }
  }

  // Deduplicate transfers by composite key (type + from + to + value + tokenId)
  const seen = new Set<string>();
  return transfers.filter((t) => {
    const key = `${t.type}:${t.from.toLowerCase()}:${t.to.toLowerCase()}:${t.value || ''}:${t.tokenId || ''}:${t.tokenAddress?.toLowerCase() || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

