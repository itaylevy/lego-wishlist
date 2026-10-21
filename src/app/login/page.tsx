import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId, isAdmin } from "@/lib/auth";
import { login } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const userId = await getCurrentUserId();
  const adminLoggedIn = await isAdmin();
  if (userId || adminLoggedIn) {
    redirect("/dashboard");
  }

  const query = await searchParams;
  const error = query.error || "";
  const success = query.success || "";

  return (
    <div className="login-page">
      <div className="login-card">
        <Link href="/" className="brand" aria-label="חזרה לדף הבית">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>LEGO Wishlist</strong><small>התחברות הורים</small></span>
        </Link>
        <h1>ברוכים השבים!</h1>
        <p>התחברו כדי לנהל את רשימות הלגו של ילדיכם, לעדכן משאלות ולשתף עם המשפחה.</p>

        {error ? <div className="flash error">{error}</div> : null}
        {success ? <div className="flash success">{success}</div> : null}

        <form action={login}>
          <div className="field">
            <label htmlFor="email">כתובת אימייל</label>
            <input
              id="email"
              name="email"
              type="text"
              placeholder="parent@example.com"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">סיסמה</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="primary-button" style={{ marginTop: "16px" }}>
            התחברות לחשבון
          </button>
        </form>

        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "#64748b" }}>
          עדיין אין לכם חשבון?{" "}
          <Link href="/register" style={{ color: "var(--blue)", fontWeight: "bold" }}>
            פתיחת רשימה בחינם ←
          </Link>
        </div>

        <Link href="/" className="back-link">
          ← חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
