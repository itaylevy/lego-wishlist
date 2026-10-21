"use client";

import { useEffect } from "react";

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error caught:", error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fef08a",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            background: "#fff",
            border: "3px solid #0f172a",
            borderRadius: "16px",
            padding: "36px 28px",
            textAlign: "center",
            boxShadow: "7px 7px 0 #0f172a",
          }}
        >
          <div style={{ fontSize: "56px", marginBottom: "12px" }}>🧱</div>
          <h1 style={{ fontSize: "26px", margin: "0 0 10px", color: "#0f172a" }}>
            אופס! שגיאת שרת
          </h1>
          <p style={{ color: "#64748b", fontSize: "15px", lineHeight: "1.6", margin: "0 0 24px" }}>
            אירעה שגיאה בעיבוד הבקשה. ייתכן שמסד הנתונים מתאתחל או שישנה בעיית תקשורת זמנית.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{
                height: "46px",
                padding: "0 22px",
                background: "#e11d48",
                color: "#fff",
                border: "2px solid #0f172a",
                borderRadius: "8px",
                fontWeight: 900,
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "3px 3px 0 #0f172a",
              }}
            >
              🔄 נסו שוב
            </button>
            <a
              href="/"
              style={{
                height: "46px",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 20px",
                background: "#fff",
                color: "#0f172a",
                border: "2px solid #0f172a",
                borderRadius: "8px",
                fontWeight: 800,
                fontSize: "15px",
                textDecoration: "none",
                boxShadow: "3px 3px 0 #0f172a",
              }}
            >
              🏠 חזרה לדף הבית
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
