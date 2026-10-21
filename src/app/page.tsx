import Link from "next/link";
import { getCurrentUserId, isAdmin } from "@/lib/auth";
import {
  getChildProfileBySlug,
  getSetsForProfile,
  normalizeSku,
  DEFAULT_ARIEL_SLUG,
  type LegoSet,
} from "@/lib/data";
import { getStorePricesForSku, type StorePriceResult } from "@/lib/prices";

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function StorePricesWidget({ prices, title = "מחירים ברשתות:" }: { prices?: StorePriceResult[]; title?: string }) {
  if (!prices || prices.length === 0) return null;

  const validPrices = prices.filter((p) => p.price !== null).map((p) => p.price as number);
  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

  return (
    <div className="store-prices-widget">
      <div className="store-prices-title">
        <span>🏷️ {title}</span>
      </div>
      <div className="store-prices-list">
        {prices.map((st) => {
          const isLowest = lowestPrice !== null && st.price === lowestPrice && validPrices.length > 1;
          return (
            <div key={st.storeId} className={`store-price-row ${st.color}`}>
              <div className="store-price-info">
                <span className="store-price-icon" aria-hidden="true">{st.storeIcon}</span>
                <span className="store-name">{st.storeName}</span>
              </div>
              <div className="store-price-action">
                {st.price !== null ? (
                  <span className="store-price-val">
                    {st.formattedPrice}
                    {isLowest ? <span className="store-price-tag">הזול ביותר!</span> : null}
                  </span>
                ) : null}
                <a
                  href={st.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="store-price-link"
                  title={`צפייה בערכה באתר ${st.storeName}`}
                >
                  {st.price !== null ? "לרכישה ↖" : (st.storeId === 'ksp' ? "צפה ב-KSP ↖" : "בדוק באתר ↖")}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STORES = [
  { name: "חנויות לגו רשמיות", details: "סניפי ביג אשדוד / סינמה סיטי", tag: "חנות רשמית", color: "red", icon: "👑" },
  { name: "שופרסל / יוניברס", details: "סניפי רשת שופרסל ויוניברס", tag: "סופרמרקטים", color: "blue", icon: "🛒" },
  { name: "עידן 2000", details: "רשת חנויות הצעצועים", tag: "רשת צעצועים", color: "yellow", icon: "🧸" },
  { name: "KSP", details: "בהזמנה מראש (סניפים / אונליין)", tag: "הזמנה מראש", color: "green", icon: "📦" },
  { name: "אושר עד", details: "סניפי ראשון לציון / אשדוד / כנות", tag: "סניפים נבחרים", color: "pink", icon: "🏬" },
  { name: "סופר-פארם אונליין", details: "באתר האינטרנט של סופר-פארם", tag: "קנייה ברשת", color: "purple", icon: "🌐" },
];

function StoresSection() {
  return (
    <section className="stores-section" aria-labelledby="stores-title">
      <div className="section-heading">
        <div>
          <span className="mini-label yellow-label">איפה קונים בישראל?</span>
          <h2 id="stores-title">רשתות מומלצות לרכישת לגו</h2>
        </div>
        <p>הרשתות והחנויות המובילות בישראל בהן המערכת משווה מחירים ומציגה הצעות:</p>
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  let userId: string | null = null;
  let adminLoggedIn = false;
  try {
    userId = await getCurrentUserId();
    adminLoggedIn = await isAdmin();
  } catch {
    // Auth check fallback
  }
  const isLoggedIn = Boolean(userId || adminLoggedIn);

  const queryValue = (await searchParams).q;
  const query = typeof queryValue === "string" ? queryValue.trim() : "";

  // Ariel's showcase profile
  let arielProfile = null;
  let arielSets: LegoSet[] = [];
  try {
    arielProfile = await getChildProfileBySlug(DEFAULT_ARIEL_SLUG);
    if (arielProfile) {
      arielSets = await getSetsForProfile(arielProfile.id);
    }
  } catch (err) {
    console.error("Error loading Ariel showcase sets:", err);
  }
  const arielWanted = arielSets.filter((s) => s.status === "wanted").sort((a, b) => a.wishlistRank - b.wishlistRank);
  const arielOwned = arielSets.filter((s) => s.status === "owned");

  // Quick checker state
  let searchedSet: { name: string; imageUrl: string | null; year: number | null; pieceCount: number | null; legoUrl: string } | null = null;
  let searchedPrices: StorePriceResult[] = [];

  if (query) {
    const normalized = normalizeSku(query);
    if (process.env.REBRICKABLE_API_KEY) {
      try {
        const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(normalized)}/`, {
          headers: { Authorization: `key ${process.env.REBRICKABLE_API_KEY}` },
          cache: "force-cache",
        });
        if (res.ok) {
          const data = await res.json();
          searchedSet = {
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
    searchedPrices = await getStorePricesForSku(query);
  }

  return (
    <main>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="LEGO Wishlist - דף הבית">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>LEGO Wishlist</strong><small>רשימת משאלות לילדים</small></span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link href="/ariel" className="admin-link" style={{ background: "#fff", color: "var(--ink)" }}>
            הרשימה של אריאל 🎁
          </Link>
          {isLoggedIn ? (
            <Link href="/dashboard" className="admin-link">
              הדשבורד שלי 🚀
            </Link>
          ) : (
            <>
              <Link href="/login" className="admin-link" style={{ background: "transparent", color: "var(--ink)", border: "none" }}>
                התחברות
              </Link>
              <Link href="/register" className="admin-link">
                פתיחת רשימה בחינם ✨
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">הפלטפורמה להורים וילדים חובבי לגו 🧱</span>
          <h1>
            רשימת המשאלות המושלמת.<br />
            <em>ללא כפילויות. עם השוואת מחירים.</em>
          </h1>
          <p>
            צרו פרופיל אישי לכל ילד במשפחה, רכזו את ערכות הלגו שהם הכי חולמים עליהן ואת הערכות שכבר נבנו,
            ושתפו קישור מעוצב בוואטסאפ עם סבא, סבתא והדודים — כולל השוואת מחירים בזמן אמת ברשתות בישראל!
          </p>
          <div className="hero-cta-group">
            {isLoggedIn ? (
              <Link href="/dashboard" className="hero-btn-primary">
                לדשבורד הניהול האישי שלכם ←
              </Link>
            ) : (
              <Link href="/register" className="hero-btn-primary">
                פתחו רשימה בחינם לילדכם ←
              </Link>
            )}
            <Link href="/ariel" className="hero-btn-secondary">
              צפו ברשימה לדוגמה (אריאל) ✨
            </Link>
          </div>
        </div>
        <div className="brick-scene" aria-hidden="true">
          <span className="brick red b1"><i /><i /><i /><i /></span>
          <span className="brick yellow b2"><i /><i /></span>
          <span className="brick blue b3"><i /><i /><i /><i /></span>
          <span className="brick green b4"><i /><i /></span>
        </div>
      </section>

      {/* Live SKU Quick Check Tool */}
      <section className="search-section" aria-labelledby="quick-check-title" style={{ marginTop: "-20px" }}>
        <div>
          <span className="mini-label">כלי בדיקה מהיר</span>
          <h2 id="quick-check-title">רוצים לבדוק ערכת לגו ולהשוות מחירים?</h2>
        </div>
        <form className="search-form" action="/" method="get">
          <SearchIcon />
          <label className="sr-only" htmlFor="sku-search">מספר ערכת לגו</label>
          <input
            id="sku-search"
            name="q"
            defaultValue={query}
            placeholder="הכניסו מספר ערכה, למשל 40783, 75337, 60499..."
            inputMode="numeric"
          />
          <button type="submit">בדוק מחירים עכשיו</button>
        </form>

        {query ? (
          <div className="search-preview-card status-missing" style={{ marginTop: "20px" }}>
            <div className="preview-badge-row">
              <span className="status-pill pill-missing">
                🔍 תוצאת בדיקה לערכה {query.replace(/-1$/, "")}
              </span>
            </div>
            <div className="preview-body">
              <div className="preview-image-wrap">
                {searchedSet?.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={searchedSet.imageUrl} alt={searchedSet.name} className="preview-image" />
                ) : (
                  <div className="preview-placeholder">🎁</div>
                )}
              </div>
              <div className="preview-info">
                <span className="preview-sku">ערכה {query.replace(/-1$/, "")}</span>
                <h3>{searchedSet?.name || `ערכת לגו מספר ${query}`}</h3>
                <div className="preview-meta">
                  {searchedSet?.year ? <span>שנת {searchedSet.year}</span> : null}
                  {searchedSet?.pieceCount ? <span>{searchedSet.pieceCount.toLocaleString()} חלקים</span> : null}
                </div>
                <p className="preview-desc">
                  ערכה זו זמינה לבדיקה והשוואת מחירים חיה ברשתות המובילות בישראל. תוכלו להוסיף אותה לרשימת הילד שלכם בלחיצה אחת מתוך הדשבורד!
                </p>

                {searchedPrices.length > 0 ? (
                  <StorePricesWidget prices={searchedPrices} title="מחירי ערכה זו ברשתות (LEGO, KSP, שופרסל, סופר-פארם):" />
                ) : null}

                {searchedSet?.legoUrl ? (
                  <a href={searchedSet.legoUrl} target="_blank" rel="noreferrer" className="preview-link">
                    צפייה ב-LEGO.com <span aria-hidden="true">↖</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Feature Value Props */}
      <section className="features-section" aria-labelledby="features-title">
        <div className="section-heading">
          <div>
            <span className="mini-label blue-label">למה LEGO Wishlist?</span>
            <h2 id="features-title">כל היתרונות במקום אחד</h2>
          </div>
          <p>הדרך המושלמת להורים, משפחות וילדים לנהל את עולם הלגו בקלות ובכיף.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon" style={{ background: "#fee2e2" }}>🎁</div>
            <h3>מניעת מתנות כפולות</h3>
            <p>הסבים והדודים יכולים לבדוק בעצמם לפני הקנייה אם הערכה כבר קיימת באוסף הילד, ולדעת מה עדיפות הרכישה.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: "#fef9c3" }}>🏷️</div>
            <h3>השוואת מחירים בזמן אמת</h3>
            <p>המערכת בודקת ומשווה מחירים ברשתות הגדולות בישראל (חנות לגו רשמית, KSP, שופרסל וסופר-פארם) ישירות בעמוד הרשימה.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: "#dbeafe" }}>👶</div>
            <h3>ריבוי ילדים בחשבון אחד</h3>
            <p>יש לכם יותר מילד אחד שאוהב לגו? נהלו פרופילים נפרדים עם שמות, תיאור וצבעי עיצוב ייחודיים לכל אחד.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: "#dcfce7" }}>💬</div>
            <h3>שיתוף מיידי בוואטסאפ</h3>
            <p>בלחיצה אחת שולחים קישור אישי מעוצב ומותאם לנייד לקרובים עם כל התמונות, החלקים ומספרי הערכות.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: "#f3e8ff" }}>⚡</div>
            <h3>שליפת נתונים אוטומטית</h3>
            <p>רק מקלידים את מספר הערכה (למשל 75337) — התמונה הרשמית, השם, השנה וכמות החלקים נטענים אוטומטית.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: "#e0f2fe" }}>🛡️</div>
            <h3>פרטי, בטוח ו-100% חינם</h3>
            <p>ללא מודעות מעצבנות, ללא ספאם, ושליטה מלאה של ההורים על עדכון והסרת ערכות בכל עת.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="steps-section" aria-labelledby="steps-title">
        <div className="steps-inner">
          <div className="section-heading">
            <div>
              <span className="mini-label yellow-label">פשוט ומהיר</span>
              <h2 id="steps-title">איך זה עובד? ב-3 שלבים</h2>
            </div>
            <p>בתוך שתי דקות תהיה לכם רשימת משאלות מוכנה לשיתוף עם המשפחה.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>פותחים חשבון ופרופיל</h3>
              <p>נרשמים עם אימייל וסיסמה ויוצרים פרופיל לילד/ה עם שם, כינוי אישי לקישור וצבע נושא אהוב.</p>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <h3>מזינים מספרי ערכות</h3>
              <p>מקלידים את מספר הערכה — המערכת שולפת תמונה ומפרט, ומאפשרת לסדר את דירוג העדיפות (עדיפות #1, #2 וכו').</p>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <h3>משתפים בוואטסאפ</h3>
              <p>לוחצים על &apos;שתף בוואטסאפ&apos; ושולחים לקרובים. כולם מקבלים עמוד מעוצב עם השוואת מחירים בלייב!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Ariel's Original List */}
      <div className="showcase-banner">
        <div className="showcase-inner">
          <div className="showcase-content">
            <span className="mini-label pink">הרשימה שהתחילה את הכל ⭐</span>
            <h3>הכירו את רשימת הלגו של אריאל</h3>
            <p>
              האתר נולד במקור עבור אריאל, כדי שסבא וסבתא ידעו בדיוק אילו ערכות לגו הוא חולם לבנות.
              היום הרשימה של אריאל כוללת {arielWanted.length} ערכות מבוקשות ו-{arielOwned.length} ערכות שכבר נבנו באוסף!
            </p>
          </div>
          <Link href="/ariel" className="hero-btn-primary" style={{ whiteSpace: "nowrap" }}>
            צפייה ברשימה המלאה של אריאל 🎁
          </Link>
        </div>
      </div>

      {/* Stores Section */}
      <StoresSection />

      {/* CTA Bottom Banner */}
      <section className="cta-banner" aria-labelledby="cta-bottom-title">
        <div className="cta-banner-inner">
          <h2 id="cta-bottom-title">מוכנים לסדר את עולם הלגו של הילדים?</h2>
          <p>הצטרפו בחינם, צרו רשימת משאלות מעוצבת, והבטיחו שכל מתנה תהיה בול מה שהילד רצה!</p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            {isLoggedIn ? (
              <Link href="/dashboard" className="hero-btn-primary">
                מעבר לדשבורד הורים ←
              </Link>
            ) : (
              <>
                <Link href="/register" className="hero-btn-primary">
                  פתיחת רשימה בחינם עכשיו ←
                </Link>
                <Link href="/login" className="hero-btn-secondary">
                  כניסה לחשבון קיים
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-bricks" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
        <p>פותח באהבה עבור משפחות וילדים חובבי לגו <span>♥</span></p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", margin: "14px 0", fontSize: "14px", flexWrap: "wrap" }}>
          <Link href="/ariel" style={{ color: "#fef08a", fontWeight: "bold" }}>
            הרשימה של אריאל
          </Link>
          <Link href="/login" style={{ color: "#cbd5e1" }}>
            התחברות הורים
          </Link>
          <Link href="/register" style={{ color: "#cbd5e1" }}>
            יצירת רשימה חדשה
          </Link>
          <Link href="/dashboard" style={{ color: "#cbd5e1" }}>
            דשבורד
          </Link>
          <Link href="/admin" style={{ color: "#94a3b8" }}>
            ניהול מנהל (Admin)
          </Link>
        </div>
        <small>זהו אתר משפחתי פרטי ואינו קשור לקבוצת LEGO הרשמית.</small>
      </footer>
    </main>
  );
}
