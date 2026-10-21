import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId, isAdmin } from "@/lib/auth";
import { getChildProfilesForUser, getUserById, getChildProfileById, DEFAULT_ARIEL_PROFILE_ID, type ChildProfile } from "@/lib/data";
import { logout } from "@/app/auth/actions";
import { addProfile, removeProfile } from "@/app/dashboard/actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  let userId: string | null = null;
  let adminLoggedIn = false;

  try {
    userId = await getCurrentUserId();
    adminLoggedIn = await isAdmin();
  } catch (authErr) {
    console.warn("Auth check error in dashboard:", authErr);
    redirect("/login");
  }

  if (!userId && !adminLoggedIn) {
    redirect("/login");
  }

  const query = await searchParams;
  let error = query?.error || "";
  const success = query?.success || "";

  let user = null;
  let profiles: ChildProfile[] = [];

  try {
    if (userId) {
      user = await getUserById(userId);
      profiles = await getChildProfilesForUser(userId);
    }
  } catch (dbErr: any) {
    console.error("Dashboard database error:", dbErr);
    error = error || "שגיאה בטעינת נתונים ממסד הנתונים: " + (dbErr?.message || "בעיית תקשורת זמנית");
  }

  // If admin is logged in, ensure Ariel's profile is accessible
  if (adminLoggedIn && !profiles.some((p) => p.id === DEFAULT_ARIEL_PROFILE_ID)) {
    try {
      const arielProfile = await getChildProfileById(DEFAULT_ARIEL_PROFILE_ID);
      if (arielProfile) {
        profiles.unshift(arielProfile);
      }
    } catch (e) {
      console.warn("Could not load Ariel profile for admin:", e);
    }
  }

  const parentName = user ? user.name : "הורה יקר";

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
            <span><strong>LEGO Wishlist</strong><small>דשבורד הורים</small></span>
          </Link>
          <nav>
            <Link href="/" style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>
              דף הבית הראשי
            </Link>
            <form action={logout}>
              <button className="ghost-button">התנתקות</button>
            </form>
          </nav>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-title">
          <h1>שלום, {parentName}! 👋</h1>
          <p>כאן תוכלו לנהל את פרופילי הלגו של כל הילדים, להוסיף ערכות ולשתף קישור מעוצב עם המשפחה.</p>
        </div>

        {error ? <div className="flash error">{error}</div> : null}
        {success ? <div className="flash success">{success}</div> : null}

        <section className="panel">
          <h2>הוספת פרופיל לילד/ה חדש/ה</h2>
          <form className="add-form" action={addProfile} style={{ gridTemplateColumns: "1fr 1fr 140px auto" }}>
            <div className="field">
              <label htmlFor="name">שם הילד/ה</label>
              <input id="name" name="name" placeholder="למשל: אריאל" required />
            </div>
            <div className="field">
              <label htmlFor="slug">כינוי לקישור (אנגלית/עברית)</label>
              <input id="slug" name="slug" placeholder="למשל: ariel" />
            </div>
            <div className="field">
              <label htmlFor="themeColor">צבע עיצוב</label>
              <select id="themeColor" name="themeColor" defaultValue="yellow">
                <option value="yellow">צהוב לגו ⭐</option>
                <option value="blue">כחול לגו 🌊</option>
                <option value="red">אדום לגו 🔥</option>
                <option value="green">ירוק לגו 🌿</option>
                <option value="purple">סגול לגו 🔮</option>
              </select>
            </div>
            <button type="submit" className="primary-button">
              + צור פרופיל
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>הפרופילים שלכם ({profiles.length})</h2>

          {profiles.length === 0 ? (
            <div className="empty-admin" style={{ padding: "40px 20px" }}>
              <h3>עדיין לא יצרתם פרופיל ילד.</h3>
              <p>השתמשו בטופס שלמעלה כדי ליצור את פרופיל הלגו הראשון שלכם!</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
              {profiles.map((p) => {
                const total = p.setCounts?.total ?? 0;
                const wanted = p.setCounts?.wanted ?? 0;
                const owned = p.setCounts?.owned ?? 0;
                const publicUrl = `/${p.slug}`;
                const shareText = encodeURIComponent(`היי! זו רשימת הלגו ש${p.name} הכי רוצה לקבל 🎁: ${typeof window !== 'undefined' ? window.location.origin : ''}/${p.slug}`);

                return (
                  <div
                    key={p.id}
                    style={{
                      background: "#fff",
                      border: "2px solid var(--ink)",
                      borderRadius: "14px",
                      padding: "22px",
                      boxShadow: "5px 5px 0 var(--ink)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "18px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                          {p.name}
                        </h3>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 900,
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: p.themeColor === "red" ? "#fee2e2" : p.themeColor === "blue" ? "#dbeafe" : p.themeColor === "green" ? "#dcfce7" : p.themeColor === "purple" ? "#f3e8ff" : "#fef9c3",
                            color: "#1e293b",
                          }}
                        >
                          /{p.slug}
                        </span>
                      </div>

                      {p.bio ? (
                        <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: "14px", lineHeight: "1.4" }}>
                          {p.bio}
                        </p>
                      ) : null}

                      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                        <div style={{ flex: 1, background: "#fffdf5", border: "1px solid #fef08a", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                          <span style={{ display: "block", fontSize: "18px", fontWeight: 900, color: "#854d0e" }}>{wanted}</span>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#a16207" }}>הכי רוצה 🎁</span>
                        </div>
                        <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                          <span style={{ display: "block", fontSize: "18px", fontWeight: 900, color: "#166534" }}>{owned}</span>
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#15803d" }}>כבר באוסף ✓</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <Link
                        href={`/dashboard/${p.id}`}
                        className="primary-button"
                        style={{
                          textAlign: "center",
                          display: "block",
                          lineHeight: "44px",
                          padding: "0 16px",
                          textDecoration: "none",
                        }}
                      >
                        ניהול ערכות של {p.name} ←
                      </Link>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <Link
                          href={publicUrl}
                          target="_blank"
                          className="small-button"
                          style={{
                            flex: 1,
                            textAlign: "center",
                            padding: "9px 10px",
                            fontWeight: 800,
                            display: "block",
                            background: "#f8fafc",
                          }}
                        >
                          צפייה ברשימה ↗
                        </Link>

                        <a
                          href={`https://api.whatsapp.com/send?text=${shareText}`}
                          target="_blank"
                          rel="noreferrer"
                          className="small-button"
                          style={{
                            background: "#25D366",
                            color: "#fff",
                            border: "none",
                            padding: "9px 12px",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          title="שתף בוואטסאפ"
                        >
                          שתף 💬
                        </a>

                        {p.id !== DEFAULT_ARIEL_PROFILE_ID ? (
                          <form action={removeProfile} style={{ display: "inline" }}>
                            <input type="hidden" name="profileId" value={p.id} />
                            <button
                              type="submit"
                              className="small-button danger"
                              title="מחיקת פרופיל"
                              onClick={(e) => {
                                // eslint-disable-next-line no-alert
                                if (!confirm(`למחוק את הפרופיל של ${p.name}? פעולה זו תמחק גם את הערכות ברשימה שלו.`)) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              🗑️
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
