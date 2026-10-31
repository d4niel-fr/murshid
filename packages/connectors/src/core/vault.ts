import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';

/**
 * Tokens never go in the database. The DB `connections.token_ref` column holds
 * an opaque reference like `vault:google_classroom:7c1e...`; the secret lives in
 * a TokenVault (Supabase Vault / KMS-backed store in production).
 */
export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  id_token?: string;
  /** epoch ms */
  expires_at?: number;
  /** Provider specific, non-secret extras (tenant id, school host, person urn...). */
  meta?: Record<string, string>;
}

export interface TokenVault {
  put(provider: string, tokens: TokenSet): Promise<string>;
  get(tokenRef: string): Promise<TokenSet>;
  update(tokenRef: string, tokens: TokenSet): Promise<void>;
  delete(tokenRef: string): Promise<void>;
}

export function newTokenRef(provider: string): string {
  return `vault:${provider}:${randomUUID()}`;
}

/** Test / local-dev vault. Not for production. */
export class InMemoryTokenVault implements TokenVault {
  private readonly store = new Map<string, TokenSet>();

  async put(provider: string, tokens: TokenSet): Promise<string> {
    const ref = newTokenRef(provider);
    this.store.set(ref, structuredClone(tokens));
    return ref;
  }
  async get(tokenRef: string): Promise<TokenSet> {
    const t = this.store.get(tokenRef);
    if (!t) throw new Error(`Unknown token_ref ${tokenRef}`);
    return structuredClone(t);
  }
  async update(tokenRef: string, tokens: TokenSet): Promise<void> {
    if (!this.store.has(tokenRef)) throw new Error(`Unknown token_ref ${tokenRef}`);
    this.store.set(tokenRef, structuredClone(tokens));
  }
  async delete(tokenRef: string): Promise<void> {
    this.store.delete(tokenRef);
  }
  /** test helper */
  size(): number {
    return this.store.size;
  }
}

/** Minimal key/value backend the encrypted vault writes ciphertext into. */
export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * AES-256-GCM envelope over any KeyValueStore. Key comes from env
 * `CONNECTORS_VAULT_KEY` (32 bytes, base64). Even if the KV is a DB table, it
 * only ever contains ciphertext.
 */
export class EncryptedTokenVault implements TokenVault {
  private readonly key: Buffer;

  constructor(private readonly kv: KeyValueStore, base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) throw new Error('CONNECTORS_VAULT_KEY must be 32 bytes, base64-encoded');
  }

  private encrypt(tokens: TokenSet): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
  }

  private decrypt(blob: string): TokenSet {
    const [v, iv, tag, ct] = blob.split('.');
    if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Corrupt vault entry');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]);
    return JSON.parse(pt.toString('utf8')) as TokenSet;
  }

  async put(provider: string, tokens: TokenSet): Promise<string> {
    const ref = newTokenRef(provider);
    await this.kv.set(ref, this.encrypt(tokens));
    return ref;
  }
  async get(tokenRef: string): Promise<TokenSet> {
    const blob = await this.kv.get(tokenRef);
    if (!blob) throw new Error(`Unknown token_ref ${tokenRef}`);
    return this.decrypt(blob);
  }
  async update(tokenRef: string, tokens: TokenSet): Promise<void> {
    await this.kv.set(tokenRef, this.encrypt(tokens));
  }
  async delete(tokenRef: string): Promise<void> {
    await this.kv.delete(tokenRef);
  }
}

export class InMemoryKeyValueStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  async get(k: string) {
    return this.data.get(k);
  }
  async set(k: string, v: string) {
    this.data.set(k, v);
  }
  async delete(k: string) {
    this.data.delete(k);
  }
}
