// Global in-memory cache for mapping standard Ethereum raw transaction hashes (keccak256)
// to internal CHORD node transaction hashes (sha256).
// Using globalThis ensures persistence across Next.js API route invocations in the Node process.

export interface CachedTxMeta {
  from?: string;
  to?: string | null;
  value?: string;
  data?: string;
  nonce?: number;
  hash?: string;
  timestamp?: number;
}

const globalForTx = globalThis as unknown as {
  chordTxAliases?: Map<string, string>;
  chordTxMeta?: Map<string, CachedTxMeta>;
};

export const txHashAliases =
  globalForTx.chordTxAliases || new Map<string, string>();

if (!globalForTx.chordTxAliases) {
  globalForTx.chordTxAliases = txHashAliases;
}

export const txMetaMap =
  globalForTx.chordTxMeta || new Map<string, CachedTxMeta>();

if (!globalForTx.chordTxMeta) {
  globalForTx.chordTxMeta = txMetaMap;
}
