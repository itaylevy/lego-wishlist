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
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={set.imageUrl} alt={`ערכת לגו ${set.name}`} className="set-image" />
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

const STORES = [
  {
    name: "חנויות לגו רשמיות",
    details: "סניפי ביג אשדוד / סינמה סיטי",
    tag: "חנות רשמית",
    color: "red",
    icon: "👑",
  },
  {
    name: "שופרסל / יוניברס",
    details: "סניפי רשת שופרסל ויוניברס",
    tag: "סופרמרקטים",
    color: "blue",
    icon: "🛒",
  },
  {
    name: "עידן 2000",
    details: "רשת חנויות הצעצועים",
    tag: "רשת צעצועים",
    color: "yellow",
    icon: "🧸",
  },
  {
    name: "KSP",
    details: "בהזמנה מראש (סניפים / אונליין)",
    tag: "הזמנה מראש",
    color: "green",
    icon: "📦",
  },
  {
    name: "אושר עד",
    details: "סניפי ראשון לציון / אשדוד / כנות",
    tag: "סניפים נבחרים",
    color: "pink",
    icon: "🏬",
  },
  {
    name: "סופר-פארם אונליין",
    details: "באתר האינטרנט של סופר-פארם",
    tag: "קנייה ברשת",
    color: "purple",
    icon: "🌐",
  },
];

function StoresSection() {
  return (
    <section className="stores-section" aria-labelledby="stores-title">
      <div className="section-heading">
        <div>
          <span className="mini-label yellow-label">איפה קונים?</span>
          <h2 id="stores-title">איפה ניתן למצוא לגו?</h2>
        </div>
        <p>מקומות וחנויות מומלצות שבהם תוכלו למצוא את הערכות שאריאל רוצה:</p>
      </div>
      <div className="stores-grid">
        {STORES.map((store, i) => (
          <div key={i} className={`store-card ${store.color}`}>
            <span className="store-icon" aria-hidden="true">{store.icon}</span>
            <div className="store-info">
              <span className="store-tag">{store.tag}</span>
              <h3>{store.name}</h3>
              <p>{store.details}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SearchResultCard({
  query,
  found,
  apiSet,
}: {
  query: string;
  found?: LegoSet;
  apiSet?: { name: string; imageUrl: string | null; year: number | null; pieceCount: number | null; legoUrl: string } | null;
}) {
  if (found) {
    const isOwned = found.status === "owned";
    return (
      <div className={`search-preview-card ${isOwned ? "status-owned" : "status-wanted"}`} role="status">
        <div className="preview-badge-row">
          <span className={`status-pill ${isOwned ? "pill-owned" : "pill-wanted"}`}>
            {isOwned ? "✓ אריאל כבר מחזיק בערכה זו!" : `★ נמצא ברשימת המשאלות של אריאל! (עדיפות #${found.wishlistRank})`}
          </span>
        </div>
        <div className="preview-body">
          <div className="preview-image-wrap">
            {found.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={found.imageUrl} alt={found.name} className="preview-image" />
            ) : (
              <div className="preview-placeholder">🧩</div>
            )}
          </div>
          <div className="preview-info">
            <span className="preview-sku">ערכה {found.sku.replace(/-1$/, "")}</span>
            <h3>{found.name}</h3>
            <div className="preview-meta">
              {found.year ? <span>שנת {found.year}</span> : null}
              {found.pieceCount ? <span>{found.pieceCount.toLocaleString()} חלקים</span> : null}
            </div>
            <p className="preview-desc">
              {isOwned
                ? "אריאל כבר קיבל ובנה את הערכה הזו — אין צורך לקנות אותה שוב."
                : "מתנה מעולה! הערכה הזו מופיעה ברשימת המשאלות שאריאל הכי רוצה לקבל."}
            </p>
            <a href={found.legoUrl} target="_blank" rel="noreferrer" className="preview-link">
              צפייה ב-LEGO.com <span aria-hidden="true">↖</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="search-preview-card status-missing" role="status">
      <div className="preview-badge-row">
        <span className="status-pill pill-missing">
          🎁 לא מופיע ברשימות של אריאל — רעיון מעולה למתנה!
        </span>
      </div>
      <div className="preview-body">
        <div className="preview-image-wrap">
          {apiSet?.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={apiSet.imageUrl} alt={apiSet.name} className="preview-image" />
          ) : (
            <div className="preview-placeholder">🎁</div>
          )}
        </div>
        <div className="preview-info">
          <span className="preview-sku">ערכה {query.replace(/-1$/, "")}</span>
          <h3>{apiSet ? apiSet.name : `ערכה מספר ${query}`}</h3>
          <div className="preview-meta">
            {apiSet?.year ? <span>שנת {apiSet.year}</span> : null}
            {apiSet?.pieceCount ? <span>{apiSet.pieceCount.toLocaleString()} חלקים</span> : null}
          </div>
          <p className="preview-desc">
            ערכה זו אינה מופיעה באוסף של אריאל וגם לא ברשימת המשאלות. זוהי אפשרות מצוינת להפתיע אותו במתנה חדשה!
          </p>
          {apiSet?.legoUrl ? (
            <a href={apiSet.legoUrl} target="_blank" rel="noreferrer" className="preview-link">
              צפייה ב-LEGO.com <span aria-hidden="true">↖</span>
            </a>
          ) : null}
        </div>
      </div>
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

  let searchedApiSet: { name: string; imageUrl: string | null; year: number | null; pieceCount: number | null; legoUrl: string } | null = null;
  if (query && !found && process.env.REBRICKABLE_API_KEY) {
    try {
      const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(normalizedQuery)}/`, {
        headers: { Authorization: `key ${process.env.REBRICKABLE_API_KEY}` },
        cache: "force-cache",
      });
      if (res.ok) {
        const data = await res.json();
        searchedApiSet = {
          name: data.name,
          imageUrl: data.set_img_url,
          year: data.year,
          pieceCount: data.num_parts,
          legoUrl: `https://www.lego.com/en-il/search?q=${encodeURIComponent(query.replace(/-1$/, ""))}`,
        };
      }
    } catch {
      // fallback
    }
  }

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
        {query ? <SearchResultCard query={query} found={found} apiSet={searchedApiSet} /> : null}
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

      <StoresSection />

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



