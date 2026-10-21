"use server";

import { redirect } from "next/navigation";
import { createUser, getUserByEmail, createChildProfile, DEFAULT_ARIEL_PROFILE_ID } from "@/lib/data";
import { createUserSession, clearUserSession, hashPassword, verifyPassword, passwordIsValid, createAdminSession } from "@/lib/auth";

export async function register(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  const childName = String(formData.get("childName") || "").trim();

  if (!email || !email.includes("@")) {
    redirect("/register?error=" + encodeURIComponent("כתובת אימייל אינה תקינה."));
  }
  if (!password || password.length < 6) {
    redirect("/register?error=" + encodeURIComponent("הסיסמה חייבת להכיל לפחות 6 תווים."));
  }
  if (!name) {
    redirect("/register?error=" + encodeURIComponent("נא להזין שם הורה מלא."));
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    redirect("/register?error=" + encodeURIComponent("כתובת אימייל זו כבר רשומה במערכת."));
  }

  const passwordHash = hashPassword(password);
  const user = await createUser({ email, passwordHash, name });

  // If a child name was provided during registration, create their first profile immediately!
  if (childName) {
    try {
      await createChildProfile(user.id, {
        name: childName,
        slug: childName,
        themeColor: "yellow",
      });
    } catch {
      // If slug conflict, profile creation will be handled in dashboard
    }
  }

  await createUserSession(user.id);
  redirect("/dashboard");
}

export async function login(formData: FormData) {
  const emailOrAdmin = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  // Check if this is the legacy master admin password login
  if (process.env.ADMIN_PASSWORD && passwordIsValid(password)) {
    await createAdminSession();
    // Also check if admin user exists in DB
    const adminUser = await getUserByEmail("admin@ariel-lego.local");
    if (adminUser) {
      await createUserSession(adminUser.id);
    }
    redirect("/dashboard");
  }

  if (!emailOrAdmin || !password) {
    redirect("/login?error=" + encodeURIComponent("נא להזין אימייל וסיסמה."));
  }

  const user = await getUserByEmail(emailOrAdmin);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=" + encodeURIComponent("אימייל או סיסמה שגויים."));
  }

  await createUserSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await clearUserSession();
  redirect("/login");
}
