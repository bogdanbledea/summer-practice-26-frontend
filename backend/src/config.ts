import "dotenv/config";

function required(name: string, hint = ""): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}${hint ? `. ${hint}` : ""}`,
    );
  }
  return value;
}

function seconds(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a whole number of seconds.`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  // Anyone holding this can mint a token for any account, so it is required
  // rather than defaulted: a fallback baked into the repo is not a secret.
  jwtSecret: required(
    "JWT_SECRET",
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  ),
  // Short on purpose. An access token cannot be revoked, so its lifetime is
  // the only thing bounding the damage. Set 60 for the classroom demo.
  accessTokenTtl: seconds("ACCESS_TOKEN_TTL", 900),
  refreshTokenTtl: seconds("REFRESH_TOKEN_TTL", 60 * 60 * 24 * 30),
  // Comma-separated list, or "*" to allow any origin.
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
