import Image from "next/image";
import Link from "next/link";
import { getCollection, normalizeSku, type LegoSet } from "@/lib/data";

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SetCard({ set, wanted = false }: { set: LegoSet; wanted?: boolean }) {
  return (
    <article className="set-card">
      {wanted && set.wishlistRank > 0 ? (
        <span className="rank-badge" aria-label={`עדיפות ברשימה ${set.wishlistRank}`}>
          #{set.wishlistRank}
        </span>
      ) : null}
      <div className="set-image-wrap">
        {set.imageUrl ? (
          <Image src={set.imageUrl} alt={`ערכת לגו ${set.name}`} width={560} height={420} className="set-image" />
        ) : (
          <div className="image-placeholder" aria-hidden="true">
            <span>●</span><span>●</span><span>●</span><span>●</span>
          </div>
        )}
      </div>
      <div className="set-card-body">
        <div className="sku">ערכה {set.sku.replace(/-1$/, "")}</div>
        <h3>{set.name}</h3>
        <div className="set-meta">
          {set.year ? <span>שנת {set.year}</span> : null}
          {set.pieceCount ? <span>{set.pieceCount.toLocaleString()} חלקים</span> : null}
        </div>
        <a className="lego-link" href={set.legoUrl} target="_blank" rel="noreferrer">
          צפייה ב-LEGO.com <span aria-hidden="true">↖</span>
        </a>
      </div>
    </article>
  );
}

function EmptyShelf({ kind }: { kind: "owned" | "wanted" }) {
  return (
    <div className="empty-shelf">
      <div className="empty-bricks" aria-hidden="true"><span /><span /><span /></div>
      <h3>{kind === "owned" ? "מדף האוסף מוכן" : "מדף המשאלות מוכן"}</h3>
      <p>ניתן להוסיף את הערכה הראשונה דרך פאנל הניהול.</p>
    </div>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const queryValue = (await searchParams).q;
  const query = typeof queryValue === "string" ? queryValue.trim() : "";
  const { sets, configured } = await getCollection();
  const owned = sets.filter((set) => set.status === "owned");
  const wanted = sets.filter((set) => set.status === "wanted").sort((a, b) => a.wishlistRank - b.wishlistRank);
  const normalizedQuery = query ? normalizeSku(query) : "";
  const found = normalizedQuery
    ? sets.find((set) => set.sku === normalizedQuery || set.sku.replace(/-1$/, "") === query.replace(/-1$/, ""))
    : undefined;

  return (
    <main>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="רשימת הלגו של אריאל - דף הבית">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>אריאל</strong><small>רשימת LEGO</small></span>
        </Link>
        <Link href="/admin" className="admin-link">ניהול ערכות <span aria-hidden="true">←</span></Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">הרפתקה לבנה אחר לבנה</span>
          <h1>הערכות שאריאל<br /><em>הכי רוצה לבנות.</em></h1>
          <p>מחפשים באוסף של אריאל, מגלים את הערכות בראש הרשימה, ובוחרים את המתנה המושלמת.</p>
        </div>
        <div className="brick-scene" aria-hidden="true">
          <span className="brick red b1"><i /><i /><i /><i /></span>
          <span className="brick yellow b2"><i /><i /></span>
          <span className="brick blue b3"><i /><i /><i /><i /></span>
          <span className="brick green b4"><i /><i /></span>
        </div>
      </section>

      <section className="search-section" aria-labelledby="search-title">
        <div><span className="mini-label">בדיקה מהירה</span><h2 id="search-title">יש כבר לאריאל?</h2></div>
        <form className="search-form" action="/" method="get">
          <SearchIcon />
          <label className="sr-only" htmlFor="set-search">מספר ערכת לגו</label>
          <input id="set-search" name="q" defaultValue={query} placeholder="הכניסו מספר ערכה, למשל 40783" inputMode="numeric" />
          <button type="submit">בדיקת ערכה</button>
        </form>
        {query ? (
          <div className={`search-result ${found ? found.status : "missing"}`} role="status">
            <span className="result-icon">{found ? (found.status === "owned" ? "✓" : "★") : "?"}</span>
            <div>
              {found ? (
                <><strong>{found.name}</strong><p>{found.status === "owned" ? "אריאל כבר מחזיק בערכה זו!" : "ערכה זו נמצאת ברשימת המשאלות של אריאל!"}</p></>
              ) : (
                <><strong>ערכה {query} אינה מופיעה באף רשימה</strong><p>אפשרות מצוינת למתנה חדשה!</p></>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {!configured ? (
        <aside className="setup-note"><strong>מוכן לאוסף שלכם.</strong> יש לחבר מסד נתונים (DATABASE_URL) ולהגדיר את מפתחות הסביבה, ולאחר מכן להשתמש בפאנל הניהול כדי להוסיף ערכות.</aside>
      ) : null}

      <section className="collection-section wanted-section" aria-labelledby="wanted-title">
        <div className="section-heading">
          <div><span className="mini-label pink">הכי מבוקש</span><h2 id="wanted-title">הכי רוצה</h2></div>
          <p>הערכות שנמצאות בראש הרשימה של אריאל.</p>
        </div>
        {wanted.length ? <div className="set-grid">{wanted.map((set) => <SetCard key={set.id} set={set} wanted />)}</div> : <EmptyShelf kind="wanted" />}
      </section>

      <section className="collection-section" aria-labelledby="owned-title">
        <div className="section-heading">
          <div><span className="mini-label blue-label">האוסף שלי</span><h2 id="owned-title">כבר נבנו ואהובים</h2></div>
          <div className="count-pill">{owned.length} {owned.length === 1 ? "ערכה" : "ערכות"}</div>
        </div>
        {owned.length ? <div className="set-grid">{owned.map((set) => <SetCard key={set.id} set={set} />)}</div> : <EmptyShelf kind="owned" />}
      </section>

      <footer>
        <div className="footer-bricks" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <p>נבנה באהבה עבור אריאל <span>♥</span></p>
        <small>זהו אתר משאלות משפחתי פרטי ואינו קשור לקבוצת LEGO.</small>
      </footer>
    </main>
  );
}

