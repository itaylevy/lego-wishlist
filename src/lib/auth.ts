import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
async function getCookieStore() {
  const { cookies } = await import("next/headers");
  return await cookies();
}

const ADMIN_COOKIE_NAME = "ariel_admin";
const USER_COOKIE_NAME = "lego_user_session";

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "lego-wishlist-secure-secret-key-2026";
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Password Hashing (scrypt + random salt) ---

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, key] = storedHash.split(":");
  const keyBuffer = Buffer.from(key, "hex");
  const derivedBuffer = scryptSync(password, salt, 64);
  return timingSafeEqual(keyBuffer, derivedBuffer);
}

// --- Session Signing ---

function signPayload(payload: string): string {
  const secret = sessionSecret();
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifyPayload(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = signed.slice(0, lastDot);
  const signature = signed.slice(lastDot + 1);
  const expectedSig = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  if (!safeEqual(signature, expectedSig)) return null;
  return payload;
}

// --- User Sessions ---

export async function createUserSession(userId: string) {
  const payload = JSON.stringify({ userId, createdAt: Date.now() });
  const token = signPayload(Buffer.from(payload).toString("base64url"));
  const cookieStore = await getCookieStore();

  cookieStore.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await getCookieStore();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  const raw = verifyPayload(token);
  if (!raw) return null;

  try {
    const json = JSON.parse(Buffer.from(raw, "base64url").toString());
    return json.userId || null;
  } catch {
    return null;
  }
}

export async function clearUserSession() {
  const cookieStore = await getCookieStore();
  cookieStore.delete(USER_COOKIE_NAME);
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

// --- Legacy Admin Compatibility ---

function expectedAdminToken() {
  const secret = sessionSecret();
  return secret ? createHmac("sha256", secret).update("ariel-lego-admin-v1").digest("hex") : "";
}

export function passwordIsValid(candidate: string) {
  const password = process.env.ADMIN_PASSWORD || "";
  return Boolean(password) && safeEqual(candidate, password);
}

export async function isAdmin() {
  try {
    const cookieStore = await getCookieStore();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value || "";
    const expected = expectedAdminToken();
    return Boolean(expected) && safeEqual(token, expected);
  } catch {
    return false;
  }
}

export async function createAdminSession() {
  const cookieStore = await getCookieStore();
  cookieStore.set(ADMIN_COOKIE_NAME, expectedAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminSession() {
  const cookieStore = await getCookieStore();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
