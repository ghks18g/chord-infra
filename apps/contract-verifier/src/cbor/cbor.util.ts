/**
 * EVM 바이트코드 표준 CBOR 메타데이터 트렁케이트 유틸리티
 */

export interface BytecodeComparisonResult {
  matches: boolean;
  diff?: string;
  cleanOnChainBytecode: string;
  cleanCompiledBytecode: string;
}

export function normalizeBytecode(bytecode: string): string {
  let hex = bytecode.trim().toLowerCase();
  if (hex.startsWith('0x')) {
    hex = hex.slice(2);
  }
  return hex;
}

export function stripCborMetadata(bytecode: string): string {
  const hex = normalizeBytecode(bytecode);

  if (hex.length < 4) {
    return `0x${hex}`;
  }

  const lengthHex = hex.slice(-4);
  const cborLength = parseInt(lengthHex, 16);

  if (isNaN(cborLength) || cborLength <= 0) {
    return `0x${hex}`;
  }

  const totalMetadataHexLength = (cborLength + 2) * 2;

  if (hex.length >= totalMetadataHexLength) {
    const cleanHex = hex.slice(0, -totalMetadataHexLength);
    return `0x${cleanHex}`;
  }

  return `0x${hex}`;
}

export function extractCborMetadata(bytecode: string): {
  cborLength: number;
  metadataHex: string;
  cleanBytecode: string;
} | null {
  const hex = normalizeBytecode(bytecode);

  if (hex.length < 4) {
    return null;
  }

  const lengthHex = hex.slice(-4);
  const cborLength = parseInt(lengthHex, 16);

  if (isNaN(cborLength) || cborLength <= 0) {
    return null;
  }

  const totalMetadataHexLength = (cborLength + 2) * 2;
  if (hex.length < totalMetadataHexLength) {
    return null;
  }

  const metadataHex = hex.slice(-totalMetadataHexLength);
  const cleanHex = hex.slice(0, -totalMetadataHexLength);

  return {
    cborLength,
    metadataHex: `0x${metadataHex}`,
    cleanBytecode: `0x${cleanHex}`,
  };
}

export function compareBytecodes(
  onChainBytecode: string,
  compiledBytecode: string,
): BytecodeComparisonResult {
  const cleanOnChain = stripCborMetadata(onChainBytecode);
  const cleanCompiled = stripCborMetadata(compiledBytecode);

  if (cleanOnChain === cleanCompiled) {
    return {
      matches: true,
      cleanOnChainBytecode: cleanOnChain,
      cleanCompiledBytecode: cleanCompiled,
    };
  }

  const onChainLen = cleanOnChain.length;
  const compiledLen = cleanCompiled.length;
  const minLen = Math.min(onChainLen, compiledLen);

  let mismatchIndex = -1;
  for (let i = 0; i < minLen; i++) {
    if (cleanOnChain[i] !== cleanCompiled[i]) {
      mismatchIndex = i;
      break;
    }
  }

  if (mismatchIndex === -1 && onChainLen !== compiledLen) {
    mismatchIndex = minLen;
  }

  const start = Math.max(0, mismatchIndex - 20);
  const onChainSnippet = cleanOnChain.slice(start, mismatchIndex + 40);
  const compiledSnippet = cleanCompiled.slice(start, mismatchIndex + 40);

  const diff = [
    `Bytecode length mismatch: on-chain=${(onChainLen - 2) / 2} bytes (${onChainLen} hex), compiled=${(compiledLen - 2) / 2} bytes (${compiledLen} hex)`,
    `First mismatch at character index ${mismatchIndex} (byte offset: ~${Math.floor((mismatchIndex - 2) / 2)})`,
    `On-chain : ...${onChainSnippet}...`,
    `Compiled : ...${compiledSnippet}...`,
  ].join('\n');

  return {
    matches: false,
    diff,
    cleanOnChainBytecode: cleanOnChain,
    cleanCompiledBytecode: cleanCompiled,
  };
}
