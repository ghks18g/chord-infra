import { readFile } from 'node:fs/promises';

export class SecretFileError extends Error {
  constructor(path: string, cause: unknown) {
    super(`secret file unreadable: ${path}`);
    this.name = 'SecretFileError';
    (this as any).cause = cause;
  }
}

export function maskSecret(_v: string): string {
  return '***';
}

/**
 * 평문 접근 관문: 사용 시점에 파일을 Buffer로 읽어 콜백 실행 후
 * 성공/실패 무관하게 finally에서 zero-fill 소거.
 */
export async function withSecretBuffer<T>(
  filePath: string,
  cb: (secret: Buffer) => Promise<T>,
): Promise<T> {
  let raw: Buffer;
  try {
    raw = await readFile(filePath);
  } catch (e) {
    throw new SecretFileError(filePath, e);
  }

  let end = raw.length;
  while (end > 0 && (raw[end - 1] === 0x0a || raw[end - 1] === 0x0d)) end--;
  const secret = Buffer.alloc(end);
  raw.copy(secret, 0, 0, end);
  raw.fill(0);

  try {
    return await cb(secret);
  } finally {
    secret.fill(0);
  }
}
