import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId, isAdmin } from "@/lib/auth";
import { register } from "@/app/auth/actions";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await getCurrentUserId();
  const adminLoggedIn = await isAdmin();
  if (userId || adminLoggedIn) {
    redirect("/dashboard");
  }

  const query = await searchParams;
  const error = query.error || "";

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: "460px" }}>
        <Link href="/" className="brand" aria-label="חזרה לדף הבית">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>LEGO Wishlist</strong><small>הרשמת הורים</small></span>
        </Link>
        <h1>יצירת רשימה לילד</h1>
        <p>צרו חשבון בחינם, הזינו את ערכות הלגו שהילדים רוצים, ושתפו קישור מעוצב עם המשפחה לקראת החגים וימי ההולדת!</p>

        {error ? <div className="flash error">{error}</div> : null}

        <form action={register}>
          <div className="field">
            <label htmlFor="name">שם ההורה</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="למשל: איתי לוי"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="email">כתובת אימייל</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="itay@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">סיסמה (לפחות 6 תווים)</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <div className="field" style={{ marginTop: "12px", background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
            <label htmlFor="childName">שם הילד/ה הראשון (אופציונלי):</label>
            <input
              id="childName"
              name="childName"
              type="text"
              placeholder="למשל: אריאל או נועה"
            />
            <small style={{ color: "#64748b", marginTop: "4px" }}>
              תוכלו להוסיף ילדים נוספים בכל עת מתוך הדשבורד.
            </small>
          </div>

          <button type="submit" className="primary-button" style={{ marginTop: "20px" }}>
            הרשמה ויצירת רשימה בחינם
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "14px", color: "#64748b" }}>
          כבר יש לכם חשבון?{" "}
          <Link href="/login" style={{ color: "var(--blue)", fontWeight: "bold" }}>
            להתחברות ←
          </Link>
        </div>

        <Link href="/" className="back-link">
          ← חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
