"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Error caught by error boundary:", error);
  }, [error]);

  return (
    <div className="login-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <div className="login-card" style={{ maxWidth: "540px", textAlign: "center" }}>
        <Link href="/" className="brand" style={{ justifyContent: "center", marginBottom: "20px" }}>
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>LEGO Wishlist</strong><small>הודעת מערכת</small></span>
        </Link>

        <div style={{ fontSize: "52px", margin: "10px 0" }} aria-hidden="true">
          🧩
        </div>

        <h1 style={{ fontSize: "28px", margin: "0 0 12px", color: "var(--ink)" }}>
          אופס! משהו השתבש בטעינת העמוד
        </h1>

        <p style={{ color: "#64748b", fontSize: "15px", lineHeight: "1.6", margin: "0 0 20px" }}>
          אירעה שגיאה זמנית בעיבוד הבקשה. שום מידע או ערכה לא נפגעו.
          ייתכן שמסד הנתונים מתאתחל או שישנה בעיית תקשורת זמנית.
        </p>

        {error.message ? (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "13px",
              textAlign: "right",
              direction: "ltr",
              fontFamily: "monospace",
              marginBottom: "20px",
              wordBreak: "break-word",
            }}
          >
            {error.message}
            {error.digest ? <div style={{ fontSize: "11px", color: "#b91c1c", marginTop: "4px" }}>Digest: {error.digest}</div> : null}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => reset()}
            className="primary-button"
            style={{ padding: "0 22px", height: "46px" }}
          >
            🔄 נסו לטעון מחדש
          </button>
          <Link
            href="/"
            className="small-button"
            style={{ height: "46px", display: "inline-flex", alignItems: "center", padding: "0 18px", fontSize: "14px" }}
          >
            🏠 חזרה לדף הבית
          </Link>
          <Link
            href="/login"
            className="small-button"
            style={{ height: "46px", display: "inline-flex", alignItems: "center", padding: "0 18px", fontSize: "14px" }}
          >
            🔑 התחברות
          </Link>
        </div>
      </div>
    </div>
  );
}
