import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ariel_admin";
function sessionSecret() { return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || ""; }
function expectedToken() { const secret = sessionSecret(); return secret ? createHmac("sha256", secret).update("ariel-lego-admin-v1").digest("hex") : ""; }
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b);
}
export function passwordIsValid(candidate: string) { const password = process.env.ADMIN_PASSWORD || ""; return Boolean(password) && safeEqual(candidate, password); }
export async function isAdmin() { const token = (await cookies()).get(COOKIE_NAME)?.value || ""; const expected = expectedToken(); return Boolean(expected) && safeEqual(token, expected); }
export async function createAdminSession() {
  (await cookies()).set(COOKIE_NAME, expectedToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function clearAdminSession() { (await cookies()).delete(COOKIE_NAME); }
