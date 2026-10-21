import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type SetStatus = "owned" | "wanted";

export type LegoSet = {
  id: string;
  profileId?: string;
  sku: string;
  name: string;
  status: SetStatus;
  imageUrl: string | null;
  legoUrl: string;
  year: number | null;
  pieceCount: number | null;
  wishlistRank: number;
  createdAt?: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type ChildProfile = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  themeColor: string;
  bio: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  setCounts?: {
    total: number;
    wanted: number;
    owned: number;
  };
};

type DbSetRow = {
  id: string;
  profile_id?: string;
  sku: string;
  name: string;
  status: SetStatus;
  image_url: string | null;
  lego_url: string;
  year: number | null;
  piece_count: number | null;
  wishlist_rank: number;
  created_at?: string;
};

type DbUserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
};

type DbProfileRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  theme_color: string;
  bio: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_ARIEL_PROFILE_ID = "ariel-profile-default";
export const DEFAULT_ARIEL_SLUG = "ariel";

let schemaReady = false;
function database(): NeonQueryFunction<false, false> | null {
  return process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
}

/**
 * Ensures schema existence and performs zero-loss auto-migration for multi-tenancy.
 */
export async function ensureSchema(sql: NeonQueryFunction<false, false>) {
  if (schemaReady) return;

  // 1. Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 2. Child Profiles table
  await sql`
    CREATE TABLE IF NOT EXISTS child_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      theme_color TEXT NOT NULL DEFAULT 'yellow',
      bio TEXT,
      is_public BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 3. Lego Sets table
  await sql`
    CREATE TABLE IF NOT EXISTS lego_sets (
      id TEXT PRIMARY KEY,
      profile_id TEXT,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('owned', 'wanted')),
      image_url TEXT,
      lego_url TEXT NOT NULL,
      year INTEGER,
      piece_count INTEGER,
      wishlist_rank INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 4. Migration: Ensure profile_id column exists
  try {
    await sql`ALTER TABLE lego_sets ADD COLUMN IF NOT EXISTS profile_id TEXT`;
  } catch {
    // Column might already exist
  }

  // 5. Create default admin and Ariel profile if they don't exist
  const defaultAdminId = "admin-user-default";
  try {
    await sql`
      INSERT INTO users (id, email, password_hash, name)
      VALUES (${defaultAdminId}, 'admin@ariel-lego.local', 'builtin-admin', 'מנהל')
      ON CONFLICT DO NOTHING
    `;
  } catch (err) {
    console.warn("Could not seed default admin user:", err);
  }

  try {
    await sql`
      INSERT INTO child_profiles (id, user_id, name, slug, theme_color, bio)
      VALUES (${DEFAULT_ARIEL_PROFILE_ID}, ${defaultAdminId}, 'אריאל', ${DEFAULT_ARIEL_SLUG}, 'yellow', 'הרפתקה לבנה אחר לבנה - הערכות שאריאל הכי רוצה לבנות!')
      ON CONFLICT DO NOTHING
    `;
  } catch (err) {
    console.warn("Could not seed default Ariel profile:", err);
  }

  // 6. Migrate any legacy unassigned sets to Ariel's profile
  try {
    await sql`
      UPDATE lego_sets
      SET profile_id = ${DEFAULT_ARIEL_PROFILE_ID}
      WHERE profile_id IS NULL OR profile_id = ''
    `;
  } catch (err) {
    console.warn("Could not update legacy unassigned sets:", err);
  }

  // 7. Ensure unique constraint is scoped to (profile_id, sku)
  try {
    await sql`ALTER TABLE lego_sets DROP CONSTRAINT IF EXISTS lego_sets_sku_key`;
  } catch {}
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS lego_sets_profile_sku_idx ON lego_sets (profile_id, sku)`;
  } catch {}

  schemaReady = true;

  // 8. Re-index Ariel's wishlist
  try {
    await reindexWishlistForProfile(DEFAULT_ARIEL_PROFILE_ID, sql);
  } catch (err) {
    console.warn("Could not reindex default Ariel wishlist:", err);
  }
}

function mapSetRow(row: DbSetRow): LegoSet {
  return {
    id: row.id,
    profileId: row.profile_id,
    sku: row.sku,
    name: row.name,
    status: row.status,
    imageUrl: row.image_url,
    legoUrl: row.lego_url,
    year: row.year,
    pieceCount: row.piece_count,
    wishlistRank: row.wishlist_rank,
    createdAt: row.created_at,
  };
}

export function normalizeSku(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("-") ? trimmed : `${trimmed}-1`;
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\u0590-\u05fe-]+/g, "-") // Allow Hebrew, alphanumeric, and dashes
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalizes and recalculates wishlist ranks for a list of sets.
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

// ==========================================
// USER OPERATIONS
// ==========================================

export async function createUser(
  data: { email: string; passwordHash: string; name: string },
  client?: NeonQueryFunction<false, false>
): Promise<User> {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureSchema(sql);

  const id = crypto.randomUUID();
  const normalizedEmail = data.email.trim().toLowerCase();

  const rows = await sql`
    INSERT INTO users (id, email, password_hash, name)
    VALUES (${id}, ${normalizedEmail}, ${data.passwordHash}, ${data.name.trim()})
    RETURNING id, email, name, created_at
  `;

  const row = rows[0] as DbUserRow;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

export async function getUserByEmail(
  email: string,
  client?: NeonQueryFunction<false, false>
): Promise<(User & { passwordHash: string }) | null> {
  const sql = client ?? database();
  if (!sql) return null;
  await ensureSchema(sql);

  const normalizedEmail = email.trim().toLowerCase();
  const rows = await sql`
    SELECT id, email, password_hash, name, created_at
    FROM users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;

  if (!rows.length) return null;
  const row = rows[0] as DbUserRow;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export async function getUserById(
  id: string,
  client?: NeonQueryFunction<false, false>
): Promise<User | null> {
  const sql = client ?? database();
  if (!sql) return null;
  await ensureSchema(sql);

  const rows = await sql`
    SELECT id, email, name, created_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!rows.length) return null;
  const row = rows[0] as DbUserRow;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

// ==========================================
// CHILD PROFILE OPERATIONS
// ==========================================

export async function createChildProfile(
  userId: string,
  data: { name: string; slug: string; themeColor?: string; bio?: string },
  client?: NeonQueryFunction<false, false>
): Promise<ChildProfile> {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureSchema(sql);

  const id = crypto.randomUUID();
  const cleanSlug = sanitizeSlug(data.slug || data.name);
  const color = data.themeColor || "yellow";

  const rows = await sql`
    INSERT INTO child_profiles (id, user_id, name, slug, theme_color, bio)
    VALUES (${id}, ${userId}, ${data.name.trim()}, ${cleanSlug}, ${color}, ${data.bio?.trim() || null})
    RETURNING id, user_id, name, slug, theme_color, bio, is_public, created_at, updated_at
  `;

  const row = rows[0] as DbProfileRow;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    themeColor: row.theme_color,
    bio: row.bio,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getChildProfilesForUser(
  userId: string,
  client?: NeonQueryFunction<false, false>
): Promise<ChildProfile[]> {
  const sql = client ?? database();
  if (!sql) return [];
  await ensureSchema(sql);

  const rows = await sql`
    SELECT p.id, p.user_id, p.name, p.slug, p.theme_color, p.bio, p.is_public, p.created_at, p.updated_at,
           COUNT(s.id) AS total_sets,
           COUNT(CASE WHEN s.status = 'wanted' THEN 1 END) AS wanted_sets,
           COUNT(CASE WHEN s.status = 'owned' THEN 1 END) AS owned_sets
    FROM child_profiles p
    LEFT JOIN lego_sets s ON s.profile_id = p.id
    WHERE p.user_id = ${userId}
    GROUP BY p.id
    ORDER BY p.created_at ASC
  `;

  return rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    slug: r.slug,
    themeColor: r.theme_color,
    bio: r.bio,
    isPublic: r.is_public,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    setCounts: {
      total: Number(r.total_sets || 0),
      wanted: Number(r.wanted_sets || 0),
      owned: Number(r.owned_sets || 0),
    },
  }));
}

export async function getChildProfileBySlug(
  slug: string,
  client?: NeonQueryFunction<false, false>
): Promise<ChildProfile | null> {
  const sql = client ?? database();
  if (!sql) return null;
  await ensureSchema(sql);

  const cleanSlug = sanitizeSlug(slug);
  const rows = await sql`
    SELECT id, user_id, name, slug, theme_color, bio, is_public, created_at, updated_at
    FROM child_profiles
    WHERE slug = ${cleanSlug}
    LIMIT 1
  `;

  if (!rows.length) return null;
  const row = rows[0] as DbProfileRow;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    themeColor: row.theme_color,
    bio: row.bio,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getChildProfileById(
  id: string,
  client?: NeonQueryFunction<false, false>
): Promise<ChildProfile | null> {
  const sql = client ?? database();
  if (!sql) return null;
  await ensureSchema(sql);

  const rows = await sql`
    SELECT id, user_id, name, slug, theme_color, bio, is_public, created_at, updated_at
    FROM child_profiles
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!rows.length) return null;
  const row = rows[0] as DbProfileRow;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    themeColor: row.theme_color,
    bio: row.bio,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateChildProfile(
  userId: string,
  profileId: string,
  data: { name: string; slug: string; themeColor?: string; bio?: string },
  client?: NeonQueryFunction<false, false>
) {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureSchema(sql);

  const cleanSlug = sanitizeSlug(data.slug || data.name);
  const color = data.themeColor || "yellow";

  await sql`
    UPDATE child_profiles
    SET name = ${data.name.trim()},
        slug = ${cleanSlug},
        theme_color = ${color},
        bio = ${data.bio?.trim() || null},
        updated_at = NOW()
    WHERE id = ${profileId} AND user_id = ${userId}
  `;
}

export async function deleteChildProfile(
  userId: string,
  profileId: string,
  client?: NeonQueryFunction<false, false>
) {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureSchema(sql);

  await sql`
    DELETE FROM child_profiles
    WHERE id = ${profileId} AND user_id = ${userId}
  `;
}

// ==========================================
// SCOPED LEGO SETS OPERATIONS
// ==========================================

export async function reindexWishlistForProfile(
  profileId: string,
  client?: NeonQueryFunction<false, false>
) {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");

  // 1. Reset owned sets wishlist_rank to 0
  await sql`
    UPDATE lego_sets
    SET wishlist_rank = 0, updated_at = NOW()
    WHERE profile_id = ${profileId} AND status = 'owned' AND wishlist_rank != 0
  `;

  // 2. Renumber wanted sets consecutively starting from 1 with no gaps
  await sql`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY wishlist_rank ASC, created_at ASC, id ASC) AS new_rank
      FROM lego_sets
      WHERE profile_id = ${profileId} AND status = 'wanted'
    )
    UPDATE lego_sets
    SET wishlist_rank = ranked.new_rank, updated_at = NOW()
    FROM ranked
    WHERE lego_sets.id = ranked.id AND lego_sets.wishlist_rank != ranked.new_rank
  `;
}

export async function getSetsForProfile(
  profileId: string,
  client?: NeonQueryFunction<false, false>
): Promise<LegoSet[]> {
  const sql = client ?? database();
  if (!sql) return [];
  await ensureSchema(sql);

  const rows = await sql`
    SELECT id, profile_id, sku, name, status, image_url, lego_url, year, piece_count, wishlist_rank, created_at
    FROM lego_sets
    WHERE profile_id = ${profileId}
    ORDER BY status DESC, wishlist_rank ASC, created_at DESC
  `;

  const sets = (rows as DbSetRow[]).map(mapSetRow);
  return recalculateWishlistRanks(sets);
}

export async function saveSetForProfile(
  profileId: string,
  set: Omit<LegoSet, "id" | "wishlistRank">,
  client?: NeonQueryFunction<false, false>
) {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureSchema(sql);

  const nextRankRows = set.status === "wanted"
    ? await sql`SELECT COALESCE(MAX(wishlist_rank), 0) + 1 AS next_rank FROM lego_sets WHERE profile_id = ${profileId} AND status = 'wanted'`
    : [{ next_rank: 0 }];
  const nextRank = Number((nextRankRows[0] as { next_rank: number }).next_rank);

  await sql`
    INSERT INTO lego_sets (id, profile_id, sku, name, status, image_url, lego_url, year, piece_count, wishlist_rank)
    VALUES (${crypto.randomUUID()}, ${profileId}, ${set.sku}, ${set.name}, ${set.status}, ${set.imageUrl}, ${set.legoUrl}, ${set.year}, ${set.pieceCount}, ${nextRank})
    ON CONFLICT (profile_id, sku) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      image_url = EXCLUDED.image_url,
      lego_url = EXCLUDED.lego_url,
      year = EXCLUDED.year,
      piece_count = EXCLUDED.piece_count,
      wishlist_rank = CASE
        WHEN EXCLUDED.status = 'wanted' AND lego_sets.status != 'wanted' THEN ${nextRank}
        WHEN EXCLUDED.status = 'owned' THEN 0
        ELSE lego_sets.wishlist_rank
      END,
      updated_at = NOW()
  `;

  await reindexWishlistForProfile(profileId, sql);
}

export async function changeStatusForProfile(
  profileId: string,
  setId: string,
  status: SetStatus,
  client?: NeonQueryFunction<false, false>
) {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureSchema(sql);

  if (status === "wanted") {
    const nextRankRows = await sql`
      SELECT COALESCE(MAX(wishlist_rank), 0) + 1 AS next_rank
      FROM lego_sets
      WHERE profile_id = ${profileId} AND status = 'wanted'
    `;
    const nextRank = Number((nextRankRows[0] as { next_rank: number }).next_rank);
    await sql`
      UPDATE lego_sets
      SET status = 'wanted', wishlist_rank = ${nextRank}, updated_at = NOW()
      WHERE id = ${setId} AND profile_id = ${profileId}
    `;
  } else {
    await sql`
      UPDATE lego_sets
      SET status = 'owned', wishlist_rank = 0, updated_at = NOW()
      WHERE id = ${setId} AND profile_id = ${profileId}
    `;
  }

  await reindexWishlistForProfile(profileId, sql);
}

export async function deleteSetForProfile(
  profileId: string,
  setId: string,
  client?: NeonQueryFunction<false, false>
) {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureSchema(sql);

  await sql`
    DELETE FROM lego_sets
    WHERE id = ${setId} AND profile_id = ${profileId}
  `;

  await reindexWishlistForProfile(profileId, sql);
}

export async function moveWantedForProfile(
  profileId: string,
  setId: string,
  direction: "up" | "down",
  client?: NeonQueryFunction<false, false>
) {
  const sql = client ?? database();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  await ensureSchema(sql);

  await reindexWishlistForProfile(profileId, sql);

  const currentRows = await sql`
    SELECT id, wishlist_rank
    FROM lego_sets
    WHERE id = ${setId} AND profile_id = ${profileId} AND status = 'wanted'
  `;
  const current = currentRows[0] as { id: string; wishlist_rank: number } | undefined;
  if (!current) return;

  const neighborRows = direction === "up"
    ? await sql`
        SELECT id, wishlist_rank
        FROM lego_sets
        WHERE profile_id = ${profileId} AND status = 'wanted' AND wishlist_rank < ${current.wishlist_rank}
        ORDER BY wishlist_rank DESC LIMIT 1
      `
    : await sql`
        SELECT id, wishlist_rank
        FROM lego_sets
        WHERE profile_id = ${profileId} AND status = 'wanted' AND wishlist_rank > ${current.wishlist_rank}
        ORDER BY wishlist_rank ASC LIMIT 1
      `;
  const neighbor = neighborRows[0] as { id: string; wishlist_rank: number } | undefined;
  if (!neighbor) return;

  await sql`
    UPDATE lego_sets
    SET wishlist_rank = CASE
      WHEN id = ${current.id} THEN ${neighbor.wishlist_rank}
      WHEN id = ${neighbor.id} THEN ${current.wishlist_rank}
      ELSE wishlist_rank
    END,
    updated_at = NOW()
    WHERE id IN (${current.id}, ${neighbor.id}) AND profile_id = ${profileId}
  `;
}

// ==========================================
// BACKWARD COMPATIBILITY HELPERS (Default to Ariel)
// ==========================================

export async function getCollection(
  client?: NeonQueryFunction<false, false>
): Promise<{ sets: LegoSet[]; configured: boolean }> {
  const sql = client ?? database();
  if (!sql) return { sets: [], configured: false };
  await ensureSchema(sql);
  const sets = await getSetsForProfile(DEFAULT_ARIEL_PROFILE_ID, sql);
  return { sets, configured: true };
}

export async function saveSet(
  set: Omit<LegoSet, "id" | "wishlistRank">,
  client?: NeonQueryFunction<false, false>
) {
  return saveSetForProfile(DEFAULT_ARIEL_PROFILE_ID, set, client);
}

export async function changeStatus(
  id: string,
  status: SetStatus,
  client?: NeonQueryFunction<false, false>
) {
  return changeStatusForProfile(DEFAULT_ARIEL_PROFILE_ID, id, status, client);
}

export async function deleteSetById(
  id: string,
  client?: NeonQueryFunction<false, false>
) {
  return deleteSetForProfile(DEFAULT_ARIEL_PROFILE_ID, id, client);
}

export async function moveWanted(
  id: string,
  direction: "up" | "down",
  client?: NeonQueryFunction<false, false>
) {
  return moveWantedForProfile(DEFAULT_ARIEL_PROFILE_ID, id, direction, client);
}

export async function reindexWishlist(
  client?: NeonQueryFunction<false, false>
) {
  return reindexWishlistForProfile(DEFAULT_ARIEL_PROFILE_ID, client);
}
