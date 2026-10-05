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
}

function mapRow(row: DbRow): LegoSet {
  return { id: row.id, sku: row.sku, name: row.name, status: row.status, imageUrl: row.image_url,
    legoUrl: row.lego_url, year: row.year, pieceCount: row.piece_count, wishlistRank: row.wishlist_rank };
}
export function normalizeSku(value: string) { const trimmed = value.trim(); return trimmed.includes("-") ? trimmed : `${trimmed}-1`; }

export async function getCollection(): Promise<{ sets: LegoSet[]; configured: boolean }> {
  const sql = database();
  if (!sql) return { sets: [], configured: false };
  await ensureSchema(sql);
  const rows = await sql`SELECT id, sku, name, status, image_url, lego_url, year, piece_count, wishlist_rank FROM lego_sets ORDER BY status DESC, wishlist_rank ASC, created_at DESC`;
  return { sets: (rows as DbRow[]).map(mapRow), configured: true };
}

export async function saveSet(set: Omit<LegoSet, "id" | "wishlistRank">) {
  const sql = database(); if (!sql) throw new Error("DATABASE_URL is not configured."); await ensureSchema(sql);
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
      wishlist_rank = CASE WHEN EXCLUDED.status = 'wanted' AND lego_sets.status != 'wanted' THEN ${nextRank} ELSE lego_sets.wishlist_rank END,
      updated_at = NOW()`;
}

export async function changeStatus(id: string, status: SetStatus) {
  const sql = database(); if (!sql) throw new Error("DATABASE_URL is not configured."); await ensureSchema(sql);
  if (status === "wanted") await sql`UPDATE lego_sets SET status = 'wanted', wishlist_rank = (SELECT COALESCE(MAX(wishlist_rank), 0) + 1 FROM lego_sets WHERE status = 'wanted'), updated_at = NOW() WHERE id = ${id}`;
  else await sql`UPDATE lego_sets SET status = 'owned', wishlist_rank = 0, updated_at = NOW() WHERE id = ${id}`;
}
export async function deleteSetById(id: string) {
  const sql = database(); if (!sql) throw new Error("DATABASE_URL is not configured."); await ensureSchema(sql); await sql`DELETE FROM lego_sets WHERE id = ${id}`;
}
export async function moveWanted(id: string, direction: "up" | "down") {
  const sql = database(); if (!sql) throw new Error("DATABASE_URL is not configured."); await ensureSchema(sql);
  const currentRows = await sql`SELECT id, wishlist_rank FROM lego_sets WHERE id = ${id} AND status = 'wanted'`;
  const current = currentRows[0] as { id: string; wishlist_rank: number } | undefined; if (!current) return;
  const neighborRows = direction === "up"
    ? await sql`SELECT id, wishlist_rank FROM lego_sets WHERE status = 'wanted' AND wishlist_rank < ${current.wishlist_rank} ORDER BY wishlist_rank DESC LIMIT 1`
    : await sql`SELECT id, wishlist_rank FROM lego_sets WHERE status = 'wanted' AND wishlist_rank > ${current.wishlist_rank} ORDER BY wishlist_rank ASC LIMIT 1`;
  const neighbor = neighborRows[0] as { id: string; wishlist_rank: number } | undefined; if (!neighbor) return;
  await sql`UPDATE lego_sets SET wishlist_rank = CASE WHEN id = ${current.id} THEN ${neighbor.wishlist_rank} WHEN id = ${neighbor.id} THEN ${current.wishlist_rank} ELSE wishlist_rank END, updated_at = NOW() WHERE id IN (${current.id}, ${neighbor.id})`;
}
