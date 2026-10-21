import test from "node:test";
import assert from "node:assert";
// @ts-ignore Node ESM native resolution requires .ts extension
import { getStorePricesForSku, type StorePriceResult } from "../src/lib/prices.ts";

test("getStorePricesForSku: includes superpharm in store list for SKU 60499", async () => {
  const prices = await getStorePricesForSku("60499");

  assert.ok(Array.isArray(prices), "Prices should be an array");
  const storeIds = prices.map((p) => p.storeId);
  assert.ok(storeIds.includes("superpharm"), "Prices must include superpharm");
  assert.ok(storeIds.includes("lego"), "Prices must include lego");
  assert.ok(storeIds.includes("ksp"), "Prices must include ksp");
  assert.ok(storeIds.includes("shufersal"), "Prices must include shufersal");

  const sp = prices.find((p) => p.storeId === "superpharm")!;
  assert.strictEqual(sp.storeName, "סופר-פארם אונליין");
  assert.strictEqual(sp.color, "purple");
  assert.strictEqual(sp.storeIcon, "🌐");
  assert.ok(sp.searchUrl.includes("60499"), "searchUrl must include SKU 60499");

  // In live test, Super-Pharm price for 60499 is 244 NIS
  if (sp.price !== null) {
    assert.strictEqual(sp.price, 244, "Super-Pharm price for 60499 should be 244");
    assert.strictEqual(sp.formattedPrice, "₪244");
    assert.ok(sp.productUrl?.includes("mp-00572691"), "productUrl should point to product page");
  }
});

test("getStorePricesForSku: handles sets not found in Super-Pharm gracefully", async () => {
  const prices = await getStorePricesForSku("9999999");
  const sp = prices.find((p) => p.storeId === "superpharm");
  assert.ok(sp, "Super-Pharm result should exist even for non-existent set");
  assert.strictEqual(sp.price, null);
  assert.ok(sp.searchUrl.includes("9999999"));
});
