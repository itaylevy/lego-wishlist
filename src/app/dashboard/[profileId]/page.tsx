import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId, isAdmin } from "@/lib/auth";
import {
  getChildProfileById,
  getSetsForProfile,
  DEFAULT_ARIEL_PROFILE_ID,
  type LegoSet,
  type ChildProfile,
} from "@/lib/data";
import { logout } from "@/app/auth/actions";
import {
  addSet,
  updateStatus,
  removeSet,
  reorderSet,
  editProfile,
} from "@/app/dashboard/actions";

function ProfileSetRow({
  set,
  index,
  count,
  profileId,
}: {
  set: LegoSet;
  index: number;
  count: number;
  profileId: string;
}) {
  return (
    <div className="admin-row">
      {set.imageUrl ? (
        <Image className="admin-thumb" src={set.imageUrl} alt="" width={124} height={108} />
      ) : (
        <div className="admin-thumb" />
      )}
      <div>
        <h3>{set.name}</h3>
        <p>
          ערכה {set.sku.replace(/-1$/, "")} · {set.year ? `שנת ${set.year}` : "שנה לא ידועה"}
          {set.status === "wanted" ? ` · עדיפות #${set.wishlistRank}` : ""}
        </p>
      </div>
      <div className="row-actions">
        {set.status === "wanted" ? (
          <>
            <form action={reorderSet}>
              <input type="hidden" name="profileId" value={profileId} />
              <input type="hidden" name="id" value={set.id} />
              <input type="hidden" name="direction" value="up" />
              <button className="small-button" disabled={index === 0} title="הזז למעלה">
                ↑
              </button>
            </form>
            <form action={reorderSet}>
              <input type="hidden" name="profileId" value={profileId} />
              <input type="hidden" name="id" value={set.id} />
              <input type="hidden" name="direction" value="down" />
              <button className="small-button" disabled={index === count - 1} title="הזז למטה">
                ↓
              </button>
            </form>
          </>
        ) : null}
        <form action={updateStatus}>
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="id" value={set.id} />
          <input type="hidden" name="status" value={set.status === "owned" ? "wanted" : "owned"} />
          <button className="small-button">
            העבר ל{set.status === "owned" ? "משאלות" : "באוסף"}
          </button>
        </form>
        <form action={removeSet}>
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="id" value={set.id} />
          <button className="small-button danger">מחיקה</button>
        </form>
      </div>
    </div>
  );
}

export default async function ChildManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const userId = await getCurrentUserId();
  const adminLoggedIn = await isAdmin();
  if (!userId && !adminLoggedIn) {
    redirect("/login");
  }

  const { profileId } = await params;
  const profile = await getChildProfileById(profileId);

  if (!profile) {
    redirect("/dashboard?error=" + encodeURIComponent("פרופיל לא נמצא."));
  }

  // Security check: verify ownership
  if (profile.id !== DEFAULT_ARIEL_PROFILE_ID && profile.userId !== userId) {
    redirect("/dashboard?error=" + encodeURIComponent("אין לך הרשאה לצפות בפרופיל זה."));
  }

  const query = await searchParams;
  const error = query.error || "";
  const success = query.success || "";

  const sets = await getSetsForProfile(profile.id);
  const wanted = sets.filter((s) => s.status === "wanted").sort((a, b) => a.wishlistRank - b.wishlistRank);
  const owned = sets.filter((s) => s.status === "owned");

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
            <span><strong>{profile.name}</strong><small>ניהול ערכות לגו</small></span>
          </Link>
          <nav>
            <a
              href="/api/backup"
              className="ghost-button"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="הורד קובץ גיבוי עם כל הערכות (JSON)"
            >
              📥 גיבוי (JSON)
            </a>
            <Link
              href={`/${profile.slug}`}
              target="_blank"
              style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}
            >
              צפייה בעמוד הציבורי ↗
            </Link>
            <Link href="/dashboard" className="ghost-button">
              ← חזרה לדשבורד
            </Link>
            <form action={logout}>
              <button className="ghost-button">התנתקות</button>
            </form>
          </nav>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1>ניהול הערכות של {profile.name}</h1>
            <p>הכניסו מספר ערכה והפרטים והתמונה הראשית יישלפו באופן אוטומטי.</p>
          </div>
          <a
            href={`/${profile.slug}`}
            target="_blank"
            className="small-button"
            style={{ padding: "10px 16px", fontWeight: 900, fontSize: "14px", background: "var(--yellow)" }}
          >
            פתיחת עמוד הרשימה של {profile.name} (/{profile.slug}) ↗
          </a>
        </div>

        {error ? <div className="flash error">{error}</div> : null}
        {success ? <div className="flash success">{success}</div> : null}

        <section className="panel">
          <h2>הוספה או עדכון ערכה ל-{profile.name}</h2>
          <form className="add-form" action={addSet}>
            <input type="hidden" name="profileId" value={profile.id} />
            <div className="field">
              <label htmlFor="sku">מספר ערכת לגו (SKU)</label>
              <input id="sku" name="sku" placeholder="40783 או 75337" inputMode="numeric" required />
            </div>
            <div className="field">
              <label htmlFor="status">להוסיף ל-</label>
              <select id="status" name="status" defaultValue="wanted">
                <option value="wanted">הכי רוצה (משאלות)</option>
                <option value="owned">כבר יש (האוסף שלי)</option>
              </select>
            </div>
            <button type="submit" className="primary-button">
              אחזר והוסף ערכה
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>הכי רוצה ({wanted.length})</h2>
          <div className="admin-list">
            {wanted.length ? (
              wanted.map((set, index) => (
                <ProfileSetRow
                  key={set.id}
                  set={set}
                  index={index}
                  count={wanted.length}
                  profileId={profile.id}
                />
              ))
            ) : (
              <div className="empty-admin">עדיין אין ערכות ברשימת המשאלות.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>כבר יש באוסף ({owned.length})</h2>
          <div className="admin-list">
            {owned.length ? (
              owned.map((set, index) => (
                <ProfileSetRow
                  key={set.id}
                  set={set}
                  index={index}
                  count={owned.length}
                  profileId={profile.id}
                />
              ))
            ) : (
              <div className="empty-admin">עדיין אין ערכות באוסף.</div>
            )}
          </div>
        </section>

        <details className="panel" style={{ cursor: "pointer" }}>
          <summary style={{ fontSize: "18px", fontWeight: 900, userSelect: "none" }}>
            ⚙️ עריכת פרטי הפרופיל של {profile.name} (שם, קישור וצבע)
          </summary>
          <form action={editProfile} style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: "12px", alignItems: "end" }}>
            <input type="hidden" name="profileId" value={profile.id} />
            <div className="field">
              <label htmlFor="edit-name">שם</label>
              <input id="edit-name" name="name" defaultValue={profile.name} required />
            </div>
            <div className="field">
              <label htmlFor="edit-slug">כינוי לקישור (slug)</label>
              <input id="edit-slug" name="slug" defaultValue={profile.slug} required />
            </div>
            <div className="field">
              <label htmlFor="edit-color">צבע עיצוב</label>
              <select id="edit-color" name="themeColor" defaultValue={profile.themeColor}>
                <option value="yellow">צהוב לגו ⭐</option>
                <option value="blue">כחול לגו 🌊</option>
                <option value="red">אדום לגו 🔥</option>
                <option value="green">ירוק לגו 🌿</option>
                <option value="purple">סגול לגו 🔮</option>
              </select>
            </div>
            <button type="submit" className="small-button" style={{ height: "46px", padding: "0 18px", fontWeight: 900 }}>
              שמור שינויים
            </button>
          </form>
        </details>
      </main>
    </div>
  );
}
