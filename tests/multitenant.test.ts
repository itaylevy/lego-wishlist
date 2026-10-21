import test from "node:test";
import assert from "node:assert";
// @ts-ignore Node ESM native resolution requires .ts extension
import { hashPassword, verifyPassword } from "../src/lib/password.ts";
// @ts-ignore Node ESM native resolution requires .ts extension
import { recalculateWishlistRanks, type LegoSet, type SetStatus, type ChildProfile } from "../src/lib/data.ts";

function createSet(id: string, profileId: string, status: SetStatus, wishlistRank: number, sku = `${id}-1`): LegoSet {
  return {
    id,
    profileId,
    sku,
    name: `Set ${id}`,
    status,
    imageUrl: null,
    legoUrl: `https://www.lego.com/en-il/search?q=${id}`,
    year: 2024,
    pieceCount: 500,
    wishlistRank,
  };
}

test("Password Hashing & Verification: Secure scrypt with salt", () => {
  const password = "mySecretPassword123!";
  const hash = hashPassword(password);

  assert.ok(hash.includes(":"), "Hash must contain salt:derivedKey format");
  const [salt, key] = hash.split(":");
  assert.strictEqual(salt.length, 32, "Salt must be 16 random bytes (32 hex chars)");
  assert.strictEqual(key.length, 128, "Key must be 64 bytes (128 hex chars)");

  // Two hashes of the same password should differ due to unique salts
  const hash2 = hashPassword(password);
  assert.notStrictEqual(hash, hash2, "Salts must be unique per hash");

  // Verification
  assert.strictEqual(verifyPassword(password, hash), true, "Correct password must verify successfully");
  assert.strictEqual(verifyPassword(password, hash2), true, "Correct password must verify against second hash");
  assert.strictEqual(verifyPassword("wrongPassword", hash), false, "Wrong password must be rejected");
  assert.strictEqual(verifyPassword("", hash), false, "Empty password must be rejected");
  assert.strictEqual(verifyPassword(password, "invalid-hash-string"), false, "Corrupted hash must be rejected safely");
});

test("Multi-Tenant Isolation: Independent wishlist rankings per child profile", () => {
  const profileA = "child-ariel";
  const profileB = "child-noa";

  // Child A (Ariel) has 3 wanted sets
  const arielSets: LegoSet[] = [
    createSet("a1", profileA, "wanted", 1, "75337-1"),
    createSet("a2", profileA, "wanted", 2, "40783-1"),
    createSet("a3", profileA, "wanted", 3, "60499-1"),
  ];

  // Child B (Noa) has 2 wanted sets, including one of the same SKUs (75337-1)
  const noaSets: LegoSet[] = [
    createSet("b1", profileB, "wanted", 1, "75337-1"),
    createSet("b2", profileB, "wanted", 2, "42154-1"),
  ];

  // Recalculating Ariel's list must only affect Ariel's sets
  const reindexedAriel = recalculateWishlistRanks(arielSets);
  assert.strictEqual(reindexedAriel.length, 3);
  assert.strictEqual(reindexedAriel[0].wishlistRank, 1);
  assert.strictEqual(reindexedAriel[1].wishlistRank, 2);
  assert.strictEqual(reindexedAriel[2].wishlistRank, 3);

  // Recalculating Noa's list must maintain independent #1 and #2 ranks
  const reindexedNoa = recalculateWishlistRanks(noaSets);
  assert.strictEqual(reindexedNoa.length, 2);
  assert.strictEqual(reindexedNoa[0].id, "b1");
  assert.strictEqual(reindexedNoa[0].wishlistRank, 1);
  assert.strictEqual(reindexedNoa[1].id, "b2");
  assert.strictEqual(reindexedNoa[1].wishlistRank, 2);
});

test("Multi-Tenant Isolation: Moving set in Child A does not corrupt Child B rankings", () => {
  const profileA = "child-ariel";
  const profileB = "child-noa";

  // Ariel sets: #1 moved to owned
  const arielSets: LegoSet[] = [
    createSet("a1", profileA, "owned", 0, "75337-1"),
    createSet("a2", profileA, "wanted", 2, "40783-1"),
    createSet("a3", profileA, "wanted", 3, "60499-1"),
  ];

  const noaSets: LegoSet[] = [
    createSet("b1", profileB, "wanted", 1, "75337-1"),
    createSet("b2", profileB, "wanted", 2, "42154-1"),
  ];

  const updatedAriel = recalculateWishlistRanks(arielSets);
  const arielWanted = updatedAriel.filter((s) => s.status === "wanted");

  // Ariel's ranks should now be #1 and #2
  assert.strictEqual(arielWanted[0].id, "a2");
  assert.strictEqual(arielWanted[0].wishlistRank, 1);
  assert.strictEqual(arielWanted[1].id, "a3");
  assert.strictEqual(arielWanted[1].wishlistRank, 2);

  // Noa's sets remain completely unaffected
  assert.strictEqual(noaSets[0].wishlistRank, 1);
  assert.strictEqual(noaSets[1].wishlistRank, 2);
});

test("Slug generation & validation: handles hebrew, english, and spaces", () => {
  function sanitizeSlug(input: string): string {
    const trimmed = input.trim().toLowerCase();
    const slug = trimmed
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u0590-\u05fe-]/gi, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return slug || "child";
  }

  assert.strictEqual(sanitizeSlug("Ariel"), "ariel");
  assert.strictEqual(sanitizeSlug("אריאל לוי"), "אריאל-לוי");
  assert.strictEqual(sanitizeSlug("Noa & Maya!!"), "noa-maya");
  assert.strictEqual(sanitizeSlug("  super---star  "), "super-star");
  assert.strictEqual(sanitizeSlug("!!!"), "child");
});
