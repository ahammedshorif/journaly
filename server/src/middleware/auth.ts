import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/http-error";

export interface AuthUser {
  id: string;
  email: string;
}

interface SupabaseClaims extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

// Asymmetric signing keys (RS256 / ES256) — Supabase publishes them here.
const jwks = createRemoteJWKSet(new URL(`${env.supabaseIssuer}/.well-known/jwks.json`));
const hsSecret = env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET) : null;

async function verifySupabaseToken(token: string): Promise<SupabaseClaims> {
  const { alg } = decodeProtectedHeader(token);
  const options = { issuer: env.supabaseIssuer, audience: "authenticated" };

  if (alg === "HS256") {
    if (!hsSecret) throw HttpError.unauthorized("HS256 token received but SUPABASE_JWT_SECRET is not set");
    const { payload } = await jwtVerify<SupabaseClaims>(token, hsSecret, { ...options, algorithms: ["HS256"] });
    return payload;
  }

  const { payload } = await jwtVerify<SupabaseClaims>(token, jwks, { ...options, algorithms: ["RS256", "ES256"] });
  return payload;
}

/**
 * Small in-memory cache so we don't upsert the user row on every single request.
 * Entries expire after 5 minutes; a restart simply re-upserts.
 */
const SYNC_TTL_MS = 5 * 60 * 1000;
const syncedUsers = new Map<string, number>();

async function ensureUser(claims: SupabaseClaims): Promise<AuthUser> {
  const email = claims.email ?? "";
  const lastSync = syncedUsers.get(claims.sub);
  if (lastSync && Date.now() - lastSync < SYNC_TTL_MS) return { id: claims.sub, email };

  const meta = claims.user_metadata ?? {};
  await prisma.user.upsert({
    where: { id: claims.sub },
    // Only set name/avatar on first sign-in so profile edits aren't overwritten by Google data.
    create: {
      id: claims.sub,
      email,
      name: meta.full_name ?? meta.name ?? null,
      avatarUrl: meta.avatar_url ?? meta.picture ?? null,
    },
    update: { email },
  });

  syncedUsers.set(claims.sub, Date.now());
  if (syncedUsers.size > 10_000) syncedUsers.clear();
  return { id: claims.sub, email };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(HttpError.unauthorized("Missing bearer token"));

  const token = header.slice("Bearer ".length).trim();
  let claims: SupabaseClaims;
  try {
    claims = await verifySupabaseToken(token);
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    return next(HttpError.unauthorized("Invalid or expired token"));
  }

  if (!claims.sub || claims.role !== "authenticated") {
    return next(HttpError.unauthorized("Invalid token subject"));
  }

  req.user = await ensureUser(claims);
  next();
}

/** Returns the authenticated user or throws — use inside controllers behind requireAuth. */
export function getUser(req: Request): AuthUser {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}
