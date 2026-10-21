"use server";

import { redirect } from "next/navigation";
import { createUser, getUserByEmail, createChildProfile } from "@/lib/data";
import { createUserSession, clearUserSession, hashPassword, verifyPassword, passwordIsValid, createAdminSession } from "@/lib/auth";

function isNextRedirect(err: any): boolean {
  return Boolean(
    err &&
      (err.digest?.startsWith?.("NEXT_REDIRECT") ||
        err.message === "NEXT_REDIRECT" ||
        err.__proto__?.constructor?.name === "RedirectError")
  );
}

export async function register(formData: FormData) {
  try {
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
      } catch (err: any) {
        console.warn("Could not create initial child profile:", err?.message);
        // If slug conflict, profile creation will be handled in dashboard
      }
    }

    await createUserSession(user.id);
    redirect("/dashboard");
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Registration error:", err);
    let msg = "אירעה שגיאה בעת ההרשמה. אנא נסו שוב.";
    if (err?.message?.includes("duplicate") || err?.code === "23505" || err?.message?.includes("unique")) {
      msg = "כתובת אימייל זו כבר רשומה במערכת.";
    } else if (err?.message?.includes("DATABASE_URL")) {
      msg = "חיבור מסד הנתונים אינו מוגדר או שאינו זמין כרגע. אנא ודאו ש-DATABASE_URL מוגדר בשרת.";
    } else if (err?.message) {
      msg = `שגיאה בהרשמה: ${err.message}`;
    }
    redirect("/register?error=" + encodeURIComponent(msg));
  }
}

export async function login(formData: FormData) {
  try {
    const emailOrAdmin = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    // Check if this is the legacy master admin password login
    if (process.env.ADMIN_PASSWORD && passwordIsValid(password)) {
      await createAdminSession();
      try {
        const adminUser = await getUserByEmail("admin@ariel-lego.local");
        if (adminUser) {
          await createUserSession(adminUser.id);
        }
      } catch (e) {
        console.warn("Could not attach admin user session:", e);
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
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Login error:", err);
    let msg = "אירעה שגיאה בעת ההתחברות. אנא נסו שוב.";
    if (err?.message?.includes("DATABASE_URL") || !process.env.DATABASE_URL) {
      msg = "חיבור מסד הנתונים אינו מוגדר או שאינו זמין כרגע.";
    } else if (err?.message) {
      msg = `שגיאה בהתחברות: ${err.message}`;
    }
    redirect("/login?error=" + encodeURIComponent(msg));
  }
}

export async function logout() {
  try {
    await clearUserSession();
  } catch (e) {
    console.warn("Error clearing user session:", e);
  }
  redirect("/login");
}
