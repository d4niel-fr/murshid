export type Env = Record<string, string | undefined>;

export function requireEnv(env: Env, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`Missing required env var ${name} (see packages/connectors/.env.example)`);
  return v;
}

export function optionalEnv(env: Env, name: string, fallback: string): string {
  return env[name] || fallback;
}
