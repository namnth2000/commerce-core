import type { Env } from "./types";
import { HttpError } from "./http";

const SESSION_SECONDS = 8 * 60 * 60;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function equalSecret(a: string, b: string): Promise<boolean> {
  const digest = async (value: string) => new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );

  const [left, right] = await Promise.all([digest(a), digest(b)]);
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function login(password: string, env: Env): Promise<{ token: string; expiresAt: string }> {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    throw new HttpError(503, "ADMIN_AUTH_NOT_CONFIGURED", "Admin authentication is not configured.");
  }

  if (!await equalSecret(password, env.ADMIN_PASSWORD)) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Incorrect password.");
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = textToBase64Url(JSON.stringify({ sub: "admin", exp }));
  const signature = await hmac(payload, env.SESSION_SECRET);

  return {
    token: payload + "." + signature,
    expiresAt: new Date(exp * 1000).toISOString()
  };
}

export async function requireAdmin(request: Request, env: Env): Promise<void> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new HttpError(401, "ADMIN_AUTH_REQUIRED", "Admin authentication required.");
  }

  const token = authorization.slice(7);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) {
    throw new HttpError(401, "INVALID_SESSION", "Invalid admin session.");
  }

  const expected = await hmac(payload, env.SESSION_SECRET);
  if (!await equalSecret(signature, expected)) {
    throw new HttpError(401, "INVALID_SESSION", "Invalid admin session.");
  }

  try {
    const parsed = JSON.parse(base64UrlToText(payload)) as { sub?: string; exp?: number };
    if (parsed.sub !== "admin" || !parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error("expired");
    }
  } catch {
    throw new HttpError(401, "INVALID_SESSION", "Admin session expired or invalid.");
  }
}
