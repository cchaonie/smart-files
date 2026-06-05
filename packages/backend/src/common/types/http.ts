import { Readable, Writable } from 'stream';

/**
 * Minimal subset of Express Request that this project actually uses.
 * Avoids a direct dependency on @types/express at the import site.
 */
export interface RequestLike extends Readable {
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

/**
 * Minimal subset of Express Response that this project actually uses.
 * Avoids a direct dependency on @types/express at the import site.
 * Extends Writable so it's compatible with createReadStream().pipe().
 */
export interface ResponseLike extends Writable {
  status(code: number): this;
  setHeader(name: string, value: string | number | readonly string[]): this;
  json(body: unknown): void;
}
