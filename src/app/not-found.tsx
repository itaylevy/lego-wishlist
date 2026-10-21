import Link from "next/link";

export default function NotFound() {
  return (
    <div className="login-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <div className="login-card" style={{ maxWidth: "480px", textAlign: "center" }}>
        <Link href="/" className="brand" style={{ justifyContent: "center", marginBottom: "20px" }}>
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>LEGO Wishlist</strong><small>404</small></span>
        </Link>

        <div style={{ fontSize: "56px", margin: "10px 0" }} aria-hidden="true">
          🔎🧱
        </div>

        <h1 style={{ fontSize: "28px", margin: "0 0 10px" }}>
          העמוד לא נמצא
        </h1>

        <p style={{ color: "#64748b", fontSize: "15px", lineHeight: "1.6", margin: "0 0 24px" }}>
          הכתובת שחיפשתם לא קיימת או שפרופיל הילד טרם נוצר.
        </p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <Link href="/" className="primary-button" style={{ height: "46px", display: "inline-flex", alignItems: "center", padding: "0 22px" }}>
            חזרה לדף הבית ←
          </Link>
          <Link href="/ariel" className="small-button" style={{ height: "46px", display: "inline-flex", alignItems: "center", padding: "0 18px", fontSize: "14px" }}>
            הרשימה של אריאל 🎁
          </Link>
        </div>
      </div>
    </div>
  );
}
