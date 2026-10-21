import test from "node:test";
import assert from "node:assert";
// @ts-ignore Node ESM native resolution requires .ts extension
import { recalculateWishlistRanks, changeStatus, deleteSetById, moveWanted, reindexWishlist, type LegoSet, type SetStatus } from "../src/lib/data.ts";

function createSet(id: string, status: SetStatus, wishlistRank: number, name = `Set ${id}`): LegoSet {
  return {
    id,
    sku: `${id}-1`,
    name,
    status,
    imageUrl: null,
    legoUrl: `https://www.lego.com/en-il/search?q=${id}`,
    year: 2024,
    pieceCount: 500,
    wishlistRank,
  };
}

test("recalculateWishlistRanks: preserves consecutive ranks when no status changed", () => {
  const sets: LegoSet[] = [
    createSet("1", "wanted", 1),
    createSet("2", "wanted", 2),
    createSet("3", "wanted", 3),
    createSet("4", "owned", 0),
  ];

  const result = recalculateWishlistRanks(sets);
  const wanted = result.filter((s) => s.status === "wanted");
  const owned = result.filter((s) => s.status === "owned");

  assert.strictEqual(wanted.length, 3);
  assert.strictEqual(wanted[0].id, "1");
  assert.strictEqual(wanted[0].wishlistRank, 1);
  assert.strictEqual(wanted[1].id, "2");
  assert.strictEqual(wanted[1].wishlistRank, 2);
  assert.strictEqual(wanted[2].id, "3");
  assert.strictEqual(wanted[2].wishlistRank, 3);

  assert.strictEqual(owned.length, 1);
  assert.strictEqual(owned[0].wishlistRank, 0);
});

test("BUG REPRODUCTION & FIX: Moving top-ranked wanted set (#1) to owned updates remaining ranks to #1, #2", () => {
  // Ariel had 3 wanted sets:
  // Set 1 (#1), Set 2 (#2), Set 3 (#3)
  const set1 = createSet("1", "wanted", 1);
  const set2 = createSet("2", "wanted", 2);
  const set3 = createSet("3", "wanted", 3);

  // Set 1 is purchased and moved to "owned"
  const movedSet1: LegoSet = { ...set1, status: "owned", wishlistRank: 0 };
  const updatedList = [movedSet1, set2, set3];

  const result = recalculateWishlistRanks(updatedList);
  const wanted = result.filter((s) => s.status === "wanted");
  const owned = result.filter((s) => s.status === "owned");

  // Verify wanted sets are now re-ranked without gap!
  assert.strictEqual(wanted.length, 2);
  assert.strictEqual(wanted[0].id, "2");
  assert.strictEqual(wanted[0].wishlistRank, 1, "Set 2 should now be #1");
  assert.strictEqual(wanted[1].id, "3");
  assert.strictEqual(wanted[1].wishlistRank, 2, "Set 3 should now be #2");

  // Verify owned set rank is 0
  assert.strictEqual(owned.length, 1);
  assert.strictEqual(owned[0].id, "1");
  assert.strictEqual(owned[0].wishlistRank, 0);
});

test("BUG REPRODUCTION & FIX: Moving middle wanted set (#2) to owned updates subsequent ranks", () => {
  const set1 = createSet("1", "wanted", 1);
  const set2 = createSet("2", "wanted", 2);
  const set3 = createSet("3", "wanted", 3);
  const set4 = createSet("4", "wanted", 4);

  // Set 2 is moved to "owned"
  const movedSet2: LegoSet = { ...set2, status: "owned", wishlistRank: 0 };
  const updatedList = [set1, movedSet2, set3, set4];

  const result = recalculateWishlistRanks(updatedList);
  const wanted = result.filter((s) => s.status === "wanted");

  assert.strictEqual(wanted.length, 3);
  assert.strictEqual(wanted[0].id, "1");
  assert.strictEqual(wanted[0].wishlistRank, 1, "Set 1 remains #1");
  assert.strictEqual(wanted[1].id, "3");
  assert.strictEqual(wanted[1].wishlistRank, 2, "Set 3 moves from #3 to #2");
  assert.strictEqual(wanted[2].id, "4");
  assert.strictEqual(wanted[2].wishlistRank, 3, "Set 4 moves from #4 to #3");
});

test("BUG REPRODUCTION & FIX: Moving last wanted set to owned preserves preceding ranks", () => {
  const set1 = createSet("1", "wanted", 1);
  const set2 = createSet("2", "wanted", 2);
  const set3 = createSet("3", "wanted", 3);

  // Set 3 is moved to "owned"
  const movedSet3: LegoSet = { ...set3, status: "owned", wishlistRank: 0 };
  const updatedList = [set1, set2, movedSet3];

  const result = recalculateWishlistRanks(updatedList);
  const wanted = result.filter((s) => s.status === "wanted");

  assert.strictEqual(wanted.length, 2);
  assert.strictEqual(wanted[0].id, "1");
  assert.strictEqual(wanted[0].wishlistRank, 1);
  assert.strictEqual(wanted[1].id, "2");
  assert.strictEqual(wanted[1].wishlistRank, 2);
});

test("Moving multiple sets sequentially maintains strict contiguous ranking", () => {
  let list: LegoSet[] = [
    createSet("1", "wanted", 1),
    createSet("2", "wanted", 2),
    createSet("3", "wanted", 3),
    createSet("4", "wanted", 4),
    createSet("5", "wanted", 5),
  ];

  // Move #1 to owned
  list = list.map((s) => (s.id === "1" ? { ...s, status: "owned" as SetStatus, wishlistRank: 0 } : s));
  list = recalculateWishlistRanks(list);

  let wanted = list.filter((s) => s.status === "wanted");
  assert.deepStrictEqual(
    wanted.map((s) => ({ id: s.id, rank: s.wishlistRank })),
    [
      { id: "2", rank: 1 },
      { id: "3", rank: 2 },
      { id: "4", rank: 3 },
      { id: "5", rank: 4 },
    ]
  );

  // Next, move the newly ranked #2 (which is Set 3) to owned
  list = list.map((s) => (s.id === "3" ? { ...s, status: "owned" as SetStatus, wishlistRank: 0 } : s));
  list = recalculateWishlistRanks(list);

  wanted = list.filter((s) => s.status === "wanted");
  assert.deepStrictEqual(
    wanted.map((s) => ({ id: s.id, rank: s.wishlistRank })),
    [
      { id: "2", rank: 1 },
      { id: "4", rank: 2 },
      { id: "5", rank: 3 },
    ]
  );
});

test("Moving an owned set back to wanted appends it at the end", () => {
  const set1 = createSet("1", "wanted", 1);
  const set2 = createSet("2", "wanted", 2);
  const set3 = createSet("3", "owned", 0);

  // Move set3 to wanted with higher initial rank
  const movedSet3: LegoSet = { ...set3, status: "wanted", wishlistRank: 99 };
  const result = recalculateWishlistRanks([set1, set2, movedSet3]);

  const wanted = result.filter((s) => s.status === "wanted");
  assert.strictEqual(wanted.length, 3);
  assert.strictEqual(wanted[0].id, "1");
  assert.strictEqual(wanted[0].wishlistRank, 1);
  assert.strictEqual(wanted[1].id, "2");
  assert.strictEqual(wanted[1].wishlistRank, 2);
  assert.strictEqual(wanted[2].id, "3");
  assert.strictEqual(wanted[2].wishlistRank, 3, "Moved set becomes #3");
});

test("Self-healing: resolves gaps and duplicates in wishlist ranks", () => {
  const messySets: LegoSet[] = [
    createSet("1", "wanted", 4),
    createSet("2", "wanted", 10),
    createSet("3", "wanted", 10),
    createSet("4", "wanted", 25),
    createSet("5", "owned", 7), // owned set mistakenly having rank > 0
  ];

  const result = recalculateWishlistRanks(messySets);
  const wanted = result.filter((s) => s.status === "wanted");
  const owned = result.filter((s) => s.status === "owned");

  assert.strictEqual(wanted.length, 4);
  assert.strictEqual(wanted[0].wishlistRank, 1);
  assert.strictEqual(wanted[1].wishlistRank, 2);
  assert.strictEqual(wanted[2].wishlistRank, 3);
  assert.strictEqual(wanted[3].wishlistRank, 4);

  assert.strictEqual(owned[0].wishlistRank, 0, "Owned set rank fixed to 0");
});

test("Deleting a wanted set re-ranks remaining sets with no gaps", () => {
  const sets: LegoSet[] = [
    createSet("1", "wanted", 1),
    createSet("2", "wanted", 2),
    createSet("3", "wanted", 3),
  ];

  // Delete set "2"
  const remaining = sets.filter((s) => s.id !== "2");
  const result = recalculateWishlistRanks(remaining);

  const wanted = result.filter((s) => s.status === "wanted");
  assert.strictEqual(wanted.length, 2);
  assert.strictEqual(wanted[0].id, "1");
  assert.strictEqual(wanted[0].wishlistRank, 1);
  assert.strictEqual(wanted[1].id, "3");
  assert.strictEqual(wanted[1].wishlistRank, 2, "Set 3 moved from #3 to #2");
});

test("Database Mock: changeStatus to owned re-ranks database rows", async () => {
  type TableRow = {
    id: string;
    sku: string;
    name: string;
    status: SetStatus;
    wishlist_rank: number;
    created_at: string;
  };

  let rows: TableRow[] = [
    { id: "set-1", sku: "1001-1", name: "Set 1", status: "wanted", wishlist_rank: 1, created_at: "2024-01-01" },
    { id: "set-2", sku: "1002-1", name: "Set 2", status: "wanted", wishlist_rank: 2, created_at: "2024-01-02" },
    { id: "set-3", sku: "1003-1", name: "Set 3", status: "wanted", wishlist_rank: 3, created_at: "2024-01-03" },
  ];

  // Create mock Neon client
  const mockSql = (async (strings: TemplateStringsArray, ...values: any[]) => {
    const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ""), "");

    // Mock ensureSchema table check
    if (query.includes("CREATE TABLE IF NOT EXISTS")) {
      return [];
    }

    // Mock reset owned sets: UPDATE lego_sets SET wishlist_rank = 0 WHERE status = 'owned'
    if (query.includes("UPDATE lego_sets SET wishlist_rank = 0") && query.includes("status = 'owned'")) {
      rows.forEach((r) => {
        if (r.status === "owned") r.wishlist_rank = 0;
      });
      return [];
    }

    // Mock change to owned: UPDATE lego_sets SET status = 'owned', wishlist_rank = 0 ... WHERE id = $1
    if (query.includes("SET status = 'owned'") && query.includes("WHERE id = $1")) {
      const id = values[0];
      const target = rows.find((r) => r.id === id);
      if (target) {
        target.status = "owned";
        target.wishlist_rank = 0;
      }
      return [];
    }

    // Mock CTE re-ranking: WITH ranked AS (SELECT id, ROW_NUMBER() OVER ...
    if (query.includes("WITH ranked AS")) {
      const wantedRows = rows
        .filter((r) => r.status === "wanted")
        .sort((a, b) => a.wishlist_rank - b.wishlist_rank || a.created_at.localeCompare(b.created_at));

      wantedRows.forEach((r, idx) => {
        r.wishlist_rank = idx + 1;
      });
      return [];
    }

    // Mock SELECT for move or query
    if (query.includes("SELECT id, wishlist_rank FROM lego_sets WHERE id = $1 AND status = 'wanted'")) {
      const id = values[0];
      const found = rows.find((r) => r.id === id && r.status === "wanted");
      return found ? [{ id: found.id, wishlist_rank: found.wishlist_rank }] : [];
    }

    return [];
  }) as any;

  // Change Set 1 to "owned"
  await changeStatus("set-1", "owned", mockSql);

  const wanted = rows.filter((r) => r.status === "wanted").sort((a, b) => a.wishlist_rank - b.wishlist_rank);
  const owned = rows.filter((r) => r.status === "owned");

  // Verify Set 1 is owned with rank 0
  assert.strictEqual(owned.length, 1);
  assert.strictEqual(owned[0].id, "set-1");
  assert.strictEqual(owned[0].wishlist_rank, 0);

  // Verify Set 2 and Set 3 now have ranks 1 and 2!
  assert.strictEqual(wanted.length, 2);
  assert.strictEqual(wanted[0].id, "set-2");
  assert.strictEqual(wanted[0].wishlist_rank, 1, "Set 2 should be promoted to #1 in database");
  assert.strictEqual(wanted[1].id, "set-3");
  assert.strictEqual(wanted[1].wishlist_rank, 2, "Set 3 should be promoted to #2 in database");
});
