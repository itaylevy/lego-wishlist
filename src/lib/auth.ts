import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export { hashPassword, verifyPassword } from "./password";

const ADMIN_COOKIE_NAME = "ariel_admin";
const USER_COOKIE_NAME = "lego_user_session";

function sessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "lego-wishlist-secure-secret-key-2026";
}

function safeEqual(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  try {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
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
  try {
    const payload = JSON.stringify({ userId, createdAt: Date.now() });
    const token = signPayload(Buffer.from(payload).toString("base64url"));
    const cookieStore = await cookies();

    cookieStore.set(USER_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  } catch (err) {
    console.warn("Could not set user session cookie:", err);
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USER_COOKIE_NAME)?.value;
    if (!token) return null;

    const raw = verifyPayload(token);
    if (!raw) return null;

    const json = JSON.parse(Buffer.from(raw, "base64url").toString());
    return json.userId || null;
  } catch {
    return null;
  }
}

export async function clearUserSession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(USER_COOKIE_NAME);
    cookieStore.delete(ADMIN_COOKIE_NAME);
  } catch (err) {
    console.warn("Could not clear user session cookies:", err);
  }
}

// --- Legacy Admin Compatibility ---

function expectedAdminToken() {
  const secret = sessionSecret();
  return secret ? createHmac("sha256", secret).update("ariel-lego-admin-v1").digest("hex") : "";
}

export function passwordIsValid(candidate?: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD || "";
  return Boolean(password) && safeEqual(candidate, password);
}

export async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value || "";
    const expected = expectedAdminToken();
    return Boolean(expected) && safeEqual(token, expected);
  } catch {
    return false;
  }
}

export async function createAdminSession() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, expectedAdminToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch (err) {
    console.warn("Could not set admin session cookie:", err);
  }
}

export async function clearAdminSession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_COOKIE_NAME);
  } catch (err) {
    console.warn("Could not clear admin session cookie:", err);
  }
}
