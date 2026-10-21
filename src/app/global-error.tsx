"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./globals.css";

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
      <body className="min-h-full flex flex-col font-sans">
        <div className="login-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <div className="login-card" style={{ maxWidth: "540px", textAlign: "center" }}>
            <div style={{ fontSize: "52px", margin: "10px 0" }} aria-hidden="true">
              🧱
            </div>
            <h1 style={{ fontSize: "28px", margin: "0 0 12px", color: "var(--ink)" }}>
              אופס! שגיאת שרת
            </h1>
            <p style={{ color: "#64748b", fontSize: "15px", lineHeight: "1.6", margin: "0 0 20px" }}>
              אירעה שגיאה בשרת. ניתן לנסות לטעון שוב או לחזור לדף הבית.
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
                }}
              >
                {error.message}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => reset()}
                className="primary-button"
                style={{ padding: "0 22px", height: "46px" }}
              >
                🔄 נסו שוב
              </button>
              <a
                href="/"
                className="small-button"
                style={{ height: "46px", display: "inline-flex", alignItems: "center", padding: "0 18px", fontSize: "14px" }}
              >
                🏠 לדף הבית
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
