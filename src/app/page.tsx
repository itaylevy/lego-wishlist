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
        <span className="rank-badge" aria-label={`Wishlist priority ${set.wishlistRank}`}>
          #{set.wishlistRank}
        </span>
      ) : null}
      <div className="set-image-wrap">
        {set.imageUrl ? (
          <Image src={set.imageUrl} alt={`${set.name} LEGO set`} width={560} height={420} className="set-image" />
        ) : (
          <div className="image-placeholder" aria-hidden="true">
            <span>●</span><span>●</span><span>●</span><span>●</span>
          </div>
        )}
      </div>
      <div className="set-card-body">
        <div className="sku">SET {set.sku.replace(/-1$/, "")}</div>
        <h3>{set.name}</h3>
        <div className="set-meta">
          {set.year ? <span>{set.year}</span> : null}
          {set.pieceCount ? <span>{set.pieceCount.toLocaleString()} pieces</span> : null}
        </div>
        <a className="lego-link" href={set.legoUrl} target="_blank" rel="noreferrer">
          View on LEGO.com <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

function EmptyShelf({ kind }: { kind: "owned" | "wanted" }) {
  return (
    <div className="empty-shelf">
      <div className="empty-bricks" aria-hidden="true"><span /><span /><span /></div>
      <h3>{kind === "owned" ? "The collection shelf is ready" : "The wish shelf is ready"}</h3>
      <p>Add the first set from the managing panel.</p>
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
        <Link href="/" className="brand" aria-label="Ariel's LEGO Wishlist home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>Ariel&apos;s</strong><small>LEGO WISHLIST</small></span>
        </Link>
        <Link href="/admin" className="admin-link">Manage sets <span aria-hidden="true">→</span></Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">A BRICK-BY-BRICK ADVENTURE</span>
          <h1>Find the next<br /><em>great build.</em></h1>
          <p>Search Ariel&apos;s collection, explore the most-wanted sets, and make every gift a perfect fit.</p>
        </div>
        <div className="brick-scene" aria-hidden="true">
          <span className="brick red b1"><i /><i /><i /><i /></span>
          <span className="brick yellow b2"><i /><i /></span>
          <span className="brick blue b3"><i /><i /><i /><i /></span>
          <span className="brick green b4"><i /><i /></span>
        </div>
      </section>

      <section className="search-section" aria-labelledby="search-title">
        <div><span className="mini-label">QUICK CHECK</span><h2 id="search-title">Does Ariel have it?</h2></div>
        <form className="search-form" action="/" method="get">
          <SearchIcon />
          <label className="sr-only" htmlFor="set-search">LEGO set number</label>
          <input id="set-search" name="q" defaultValue={query} placeholder="Enter a set number, e.g. 40783" inputMode="numeric" />
          <button type="submit">Check set</button>
        </form>
        {query ? (
          <div className={`search-result ${found ? found.status : "missing"}`} role="status">
            <span className="result-icon">{found ? (found.status === "owned" ? "✓" : "★") : "?"}</span>
            <div>
              {found ? (
                <><strong>{found.name}</strong><p>{found.status === "owned" ? "Ariel already owns this set." : "This set is on Ariel’s wishlist!"}</p></>
              ) : (
                <><strong>Set {query} is not on either list</strong><p>It may be a brand-new gift idea.</p></>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {!configured ? (
        <aside className="setup-note"><strong>Ready for your collection.</strong> Connect a database and add the deployment secrets described in the README, then use the managing panel to add sets.</aside>
      ) : null}

      <section className="collection-section wanted-section" aria-labelledby="wanted-title">
        <div className="section-heading">
          <div><span className="mini-label pink">TOP PICKS</span><h2 id="wanted-title">Most wanted</h2></div>
          <p>The sets at the very top of Ariel&apos;s list.</p>
        </div>
        {wanted.length ? <div className="set-grid">{wanted.map((set) => <SetCard key={set.id} set={set} wanted />)}</div> : <EmptyShelf kind="wanted" />}
      </section>

      <section className="collection-section" aria-labelledby="owned-title">
        <div className="section-heading">
          <div><span className="mini-label blue-label">THE COLLECTION</span><h2 id="owned-title">Already built & loved</h2></div>
          <div className="count-pill">{owned.length} {owned.length === 1 ? "set" : "sets"}</div>
        </div>
        {owned.length ? <div className="set-grid">{owned.map((set) => <SetCard key={set.id} set={set} />)}</div> : <EmptyShelf kind="owned" />}
      </section>

      <footer>
        <div className="footer-bricks" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <p>Built with love for Ariel <span>♥</span></p>
        <small>This is an unofficial family wishlist and is not affiliated with the LEGO Group.</small>
      </footer>
    </main>
  );
}
