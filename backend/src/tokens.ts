import { createHash, randomBytes, randomUUID } from "node:crypto";
import { errors as joseErrors, jwtVerify, SignJWT } from "jose";
import { config } from "./config.js";
import { db } from "./db.js";
import { HttpError, unauthorized } from "./errors.js";

export type SessionUser = {
  id: number;
  name: string;
  username: string | null;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  /** Seconds until accessToken expires. Handy for a countdown in the UI. */
  expiresIn: number;
  tokenType: "Bearer";
};

const secret = new TextEncoder().encode(config.jwtSecret);
const ALG = "HS256";

// ---------------------------------------------------------------------------
// Access token: signed, never stored, verified with maths alone.
// ---------------------------------------------------------------------------

export async function signAccessToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, username: user.username })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${config.accessTokenTtl}s`)
    .sign(secret);
}

/** No database call on purpose: that is the entire point of the access token.
 *  The cost is that a token stays valid until it expires, even if the account
 *  is deleted a second after it was issued. */
export async function verifyAccessToken(token: string): Promise<SessionUser> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    return {
      id: Number(payload.sub),
      name: String(payload.name ?? ""),
      username: (payload.username as string | null) ?? null,
    };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      // The frontend interceptor keys off this code to decide to refresh.
      throw unauthorized("Your access token has expired.", "token_expired");
    }
    throw unauthorized("That access token is not valid.", "invalid_token");
  }
}

// ---------------------------------------------------------------------------
// Refresh token: opaque random bytes, stored hashed, therefore revocable.
// ---------------------------------------------------------------------------

/** SHA-256 with no salt is right here and wrong for passwords: this is 32
 *  bytes of randomness, so there is no guess to make and nothing to slow down. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type RefreshRow = {
  id: number;
  user_id: number;
  family_id: string;
  expires_at: string;
  revoked_at: string | null;
};

async function insertRefreshToken(
  userId: number,
  familyId: string,
): Promise<string> {
  const token = `rt_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + config.refreshTokenTtl * 1000);

  const { error } = await db.from("refresh_tokens").insert({
    user_id: userId,
    token_hash: hashToken(token),
    family_id: familyId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error(error);
    throw new HttpError(500, "Could not start a session.");
  }
  return token;
}

/** A fresh login: new family, new pair. */
export async function startSession(user: SessionUser): Promise<Session> {
  const refreshToken = await insertRefreshToken(user.id, randomUUID());
  return {
    accessToken: await signAccessToken(user),
    refreshToken,
    expiresIn: config.accessTokenTtl,
    tokenType: "Bearer",
  };
}

/** Revokes every token minted from one login. Called on logout and on replay. */
async function revokeFamily(familyId: string): Promise<void> {
  await db
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("family_id", familyId)
    .is("revoked_at", null);
}

async function loadRefreshRow(token: string): Promise<RefreshRow> {
  const { data, error } = await db
    .from("refresh_tokens")
    .select("id, user_id, family_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle<RefreshRow>();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Could not check that refresh token.");
  }
  if (!data) {
    throw unauthorized("That refresh token is not valid.", "invalid_refresh");
  }
  return data;
}

async function loadUser(id: number): Promise<SessionUser> {
  const { data, error } = await db
    .from("users")
    .select("id, name, username")
    .eq("id", id)
    .maybeSingle<SessionUser>();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Could not load that account.");
  }
  if (!data) {
    throw unauthorized("That account no longer exists.", "invalid_refresh");
  }
  return data;
}

/**
 * Trades a refresh token for a new pair, and burns the old one.
 *
 * Rotation is what turns a stolen refresh token into a detectable event: a
 * token that is presented twice can only mean a copy exists, so the whole
 * family dies and both the thief and the victim are logged out.
 */
export async function rotateRefreshToken(
  token: string,
): Promise<Session & { user: SessionUser }> {
  const row = await loadRefreshRow(token);

  if (row.revoked_at !== null) {
    await revokeFamily(row.family_id);
    throw unauthorized(
      "That refresh token was already used, so every session from that login has been ended.",
      "refresh_reused",
    );
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw unauthorized("Your session has expired. Log in again.", "refresh_expired");
  }

  // Conditional burn: `.is("revoked_at", null)` means two requests racing with
  // the same token cannot both win. The loser is treated as a replay, which is
  // exactly what a frontend missing a single-flight guard produces.
  const { data: burned, error } = await db
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("revoked_at", null)
    .select("id")
    .returns<{ id: number }[]>();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Could not rotate that refresh token.");
  }
  if (burned.length === 0) {
    await revokeFamily(row.family_id);
    throw unauthorized(
      "That refresh token was used twice at once. Refresh once and let other requests wait for it.",
      "refresh_reused",
    );
  }

  const user = await loadUser(row.user_id);
  const refreshToken = await insertRefreshToken(user.id, row.family_id);

  return {
    user,
    accessToken: await signAccessToken(user),
    refreshToken,
    expiresIn: config.accessTokenTtl,
    tokenType: "Bearer",
  };
}

/** Logout. Unknown or already-dead tokens are not an error: the caller wanted
 *  the session gone, and it is gone. */
export async function endSession(token: string): Promise<void> {
  const { data } = await db
    .from("refresh_tokens")
    .select("id, user_id, family_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle<RefreshRow>();

  if (data) {
    await revokeFamily(data.family_id);
  }
}
