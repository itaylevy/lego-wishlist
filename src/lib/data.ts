import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type SetStatus = "owned" | "wanted";
export type LegoSet = {
  id: string; sku: string; name: string; status: SetStatus; imageUrl: string | null;
  legoUrl: string; year: number | null; pieceCount: number | null; wishlistRank: number;
};
type DbRow = {
  id: string; sku: string; name: string; status: SetStatus; image_url: string | null;
  lego_url: string; year: number | null; piece_count: number | null; wishlist_rank: number;
};

let schemaReady = false;
function database(): NeonQueryFunction<false, false> | null { return process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null; }

async function ensureSchema(sql: NeonQueryFunction<false, false>) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS lego_sets (
      id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('owned', 'wanted')), image_url TEXT,
      lego_url TEXT NOT NULL, year INTEGER, piece_count INTEGER,
      wishlist_rank INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  schemaReady = true;
  await reindexWishlist(sql);
}

function mapRow(row: DbRow): LegoSet {
  return { id: row.id, sku: row.sku, name: row.name, status: row.status, imageUrl: row.image_url,
    legoUrl: row.lego_url, year: row.year, pieceCount: row.piece_count, wishlistRank: row.wishlist_rank };
}
export function normalizeSku(value: string) { const trimmed = value.trim(); return trimmed.includes("-") ? trimmed : `${trimmed}-1`; }

/**
 * Normalizes and recalculates wishlist ranks for a list of sets.
 * All wanted sets are sorted by their current wishlistRank and assigned consecutive ranks: 1, 2, 3, ...
 * All owned sets are assigned wishlistRank = 0.
 */
export function recalculateWishlistRanks<T extends { id: string; status: SetStatus; wishlistRank: number }>(
  sets: T[]
): T[] {
  const wanted = sets
    .filter((s) => s.status === "wanted")
    .sort((a, b) => a.wishlistRank - b.wishlistRank);

  const owned = sets.filter((s) => s.status === "owned");

  const rankedWanted = wanted.map((set, index) => ({
    ...set,
    wishlistRank: index + 1,
  }));

  const rankedOwned = owned.map((set) => ({
    ...set,
    wishlistRank: 0,
  }));

  return [...rankedWanted, ...rankedOwned];
}

/**
 * Re-indexes all sets in the database to ensure:
 * 1. All wanted sets have consecutive ranks: 1, 2, 3, ... with no gaps or duplicates.
 * 2. All owned sets have wishlist_rank = 0.
 */
export async function reindexWishlist(client?: NeonQueryFunction<false, false>) {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");

  // 1. Reset owned sets wishlist_rank to 0 if any were non-zero
  await sql`UPDATE lego_sets SET wishlist_rank = 0, updated_at = NOW() WHERE status = 'owned' AND wishlist_rank != 0`;

  // 2. Renumber wanted sets consecutively starting from 1 with no gaps
  await sql`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY wishlist_rank ASC, created_at ASC, id ASC) AS new_rank
      FROM lego_sets
      WHERE status = 'wanted'
    )
    UPDATE lego_sets
    SET wishlist_rank = ranked.new_rank, updated_at = NOW()
    FROM ranked
    WHERE lego_sets.id = ranked.id AND lego_sets.wishlist_rank != ranked.new_rank
  `;
}

export async function getCollection(client?: NeonQueryFunction<false, false>): Promise<{ sets: LegoSet[]; configured: boolean }> {
  const sql = client ?? database();
  if (!sql) return { sets: [], configured: false };
  await ensureSchema(sql);
  const rows = await sql`SELECT id, sku, name, status, image_url, lego_url, year, piece_count, wishlist_rank FROM lego_sets ORDER BY status DESC, wishlist_rank ASC, created_at DESC`;
  const sets = (rows as DbRow[]).map(mapRow);
  return { sets: recalculateWishlistRanks(sets), configured: true };
}

export async function saveSet(set: Omit<LegoSet, "id" | "wishlistRank">, client?: NeonQueryFunction<false, false>) {
  const sql = client ?? database(); if (!sql) throw new Error("DATABASE_URL is not configured."); await ensureSchema(sql);
  const nextRankRows = set.status === "wanted"
    ? await sql`SELECT COALESCE(MAX(wishlist_rank), 0) + 1 AS next_rank FROM lego_sets WHERE status = 'wanted'`
    : [{ next_rank: 0 }];
  const nextRank = Number((nextRankRows[0] as { next_rank: number }).next_rank);
  await sql`
    INSERT INTO lego_sets (id, sku, name, status, image_url, lego_url, year, piece_count, wishlist_rank)
    VALUES (${crypto.randomUUID()}, ${set.sku}, ${set.name}, ${set.status}, ${set.imageUrl}, ${set.legoUrl}, ${set.year}, ${set.pieceCount}, ${nextRank})
    ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status,
      image_url = EXCLUDED.image_url, lego_url = EXCLUDED.lego_url, year = EXCLUDED.year,
      piece_count = EXCLUDED.piece_count,
      wishlist_rank = CASE
        WHEN EXCLUDED.status = 'wanted' AND lego_sets.status != 'wanted' THEN ${nextRank}
        WHEN EXCLUDED.status = 'owned' THEN 0
        ELSE lego_sets.wishlist_rank
      END,
      updated_at = NOW()`;
  await reindexWishlist(sql);
}

export async function changeStatus(id: string, status: SetStatus, client?: NeonQueryFunction<false, false>) {
  const sql = client ?? database(); if (!sql) throw new Error("DATABASE_URL is not configured."); await ensureSchema(sql);
  if (status === "wanted") {
    const nextRankRows = await sql`SELECT COALESCE(MAX(wishlist_rank), 0) + 1 AS next_rank FROM lego_sets WHERE status = 'wanted'`;
    const nextRank = Number((nextRankRows[0] as { next_rank: number }).next_rank);
    await sql`UPDATE lego_sets SET status = 'wanted', wishlist_rank = ${nextRank}, updated_at = NOW() WHERE id = ${id}`;
  } else {
    await sql`UPDATE lego_sets SET status = 'owned', wishlist_rank = 0, updated_at = NOW() WHERE id = ${id}`;
  }
  await reindexWishlist(sql);
}

export async function deleteSetById(id: string, client?: NeonQueryFunction<false, false>) {
  const sql = client ?? database(); if (!sql) throw new Error("DATABASE_URL is not configured."); await ensureSchema(sql);
  await sql`DELETE FROM lego_sets WHERE id = ${id}`;
  await reindexWishlist(sql);
}

export async function moveWanted(id: string, direction: "up" | "down", client?: NeonQueryFunction<false, false>) {
  const sql = client ?? database(); if (!sql) throw new Error("DATABASE_URL is not configured."); await ensureSchema(sql);
  await reindexWishlist(sql);
  const currentRows = await sql`SELECT id, wishlist_rank FROM lego_sets WHERE id = ${id} AND status = 'wanted'`;
  const current = currentRows[0] as { id: string; wishlist_rank: number } | undefined; if (!current) return;
  const neighborRows = direction === "up"
    ? await sql`SELECT id, wishlist_rank FROM lego_sets WHERE status = 'wanted' AND wishlist_rank < ${current.wishlist_rank} ORDER BY wishlist_rank DESC LIMIT 1`
    : await sql`SELECT id, wishlist_rank FROM lego_sets WHERE status = 'wanted' AND wishlist_rank > ${current.wishlist_rank} ORDER BY wishlist_rank ASC LIMIT 1`;
  const neighbor = neighborRows[0] as { id: string; wishlist_rank: number } | undefined; if (!neighbor) return;
  await sql`UPDATE lego_sets SET wishlist_rank = CASE WHEN id = ${current.id} THEN ${neighbor.wishlist_rank} WHEN id = ${neighbor.id} THEN ${current.wishlist_rank} ELSE wishlist_rank END, updated_at = NOW() WHERE id IN (${current.id}, ${neighbor.id})`;
}

