import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "./storage";

const AUTH_COOKIE_NAME = "spectropy_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

declare global {
  namespace Express {
    interface Request {
      authUserId?: number;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  console.log("\nsecret keys", secret);
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_JWT_SECRET is required in production");
    }
    return "dev-secret-change-me";
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

function base64UrlEncode(input: Buffer | string): string {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(input: string, secret: string): string {
  const signature = crypto.createHmac("sha256", secret).update(input).digest();
  return base64UrlEncode(signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

type JwtPayload = {
  sub: number;
  iat: number;
  exp: number;
};

export function createSessionToken(userId: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: userId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`, JWT_SECRET);
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`, JWT_SECRET);
  if (!timingSafeEqual(signature, expected)) {
    return null;
  }
  let parsedHeader: { alg?: string } | null = null;
  let payload: JwtPayload | null = null;
  try {
    parsedHeader = JSON.parse(base64UrlDecode(header));
    payload = JSON.parse(base64UrlDecode(body));
  } catch {
    return null;
  }
  if (!parsedHeader || parsedHeader.alg !== "HS256") {
    return null;
  }
  if (!payload || typeof payload.sub !== "number" || typeof payload.exp !== "number") {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }
  return payload;
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) {
    return {};
  }
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const trimmed = part.trim();
    if (!trimmed) return acc;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return acc;
    const key = decodeURIComponent(trimmed.slice(0, eqIndex));
    const value = decodeURIComponent(trimmed.slice(eqIndex + 1));
    acc[key] = value;
    return acc;
  }, {});
}

export function getAuthTokenFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] || null;
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.cookie(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  if (req.path.startsWith("/auth")) {
    return next();
  }

  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const user = await storage.getUser(payload.sub);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.authUserId = user.id;
  return next();
}

export function getCurrentUserId(req: Request): number {
  if (!req.authUserId) {
    const err = new Error("Authentication required") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return req.authUserId;
}

export { AUTH_COOKIE_NAME };
