export type StorePriceResult = {
  storeId: "lego" | "ksp" | "shufersal" | "superpharm";
  storeName: string;
  storeIcon: string;
  color: string;
  searchUrl: string;
  price: number | null;
  formattedPrice: string | null;
  productUrl: string | null;
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...HEADERS,
        ...(options.headers || {}),
      },
      signal: controller.signal,
      next: { revalidate: 3600 }, // cache for 1 hour
    });
    clearTimeout(timeoutId);
    return res;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

function cleanSku(sku: string): string {
  return sku.trim().replace(/-1$/, "");
}

function formatNis(amount: number): string {
  return `₪${amount.toLocaleString("he-IL")}`;
}

/**
 * Fetch LEGO price from LEGO Certified Store Israel (legoisrael.myshopify.com / lego.certifiedstore.co.il)
 */
async function fetchLegoPrice(rawSku: string): Promise<StorePriceResult> {
  const sku = cleanSku(rawSku);
  const fallbackSearchUrl = `https://lego.certifiedstore.co.il/search?q=${encodeURIComponent(sku)}`;

  let price: number | null = null;
  let productUrl: string | null = null;

  try {
    // LEGO Israel wordTextSearch API
    const res = await fetchWithTimeout(
      "https://chat-server-test-508662106894.us-central1.run.app/api/text-search/wordTextSearch",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: "legoisrael.myshopify.com",
          searchTerms: sku,
          userId: "26018480-e607-4b29-9c7f-f7a5b5992d99",
          sessionId: "3cdab3f5-b2f8-4f69-8ef5-0fa0c0d5d9ef",
        }),
      }
    );

    if (res && res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        const item = items.find((i: { title?: string }) => i.title && i.title.includes(sku)) || items[0];
        if (item && item.link) {
          productUrl = item.link;

          // Query Shopify product .js endpoint for exact live price
          try {
            const urlObj = new URL(item.link);
            const jsonEndpoint = `${urlObj.origin}${urlObj.pathname}.js`;

            const jsonRes = await fetchWithTimeout(jsonEndpoint);
            if (jsonRes && jsonRes.ok) {
              const productData = await jsonRes.json();
              if (typeof productData.price === "number" && productData.price > 0) {
                price = productData.price / 100; // Cents to ILS
              }
            }
          } catch {
            // fallback
          }
        }
      }
    }
  } catch {
    // Ignore fetch errors
  }

  return {
    storeId: "lego",
    storeName: "חנות לגו ישראל (LEGO Certified Store)",
    storeIcon: "👑",
    color: "red",
    searchUrl: productUrl || fallbackSearchUrl,
    price,
    formattedPrice: price ? formatNis(price) : null,
    productUrl: productUrl || fallbackSearchUrl,
  };
}

/**
 * Fetch price from KSP (ksp.co.il)
 */
async function fetchKspPrice(rawSku: string): Promise<StorePriceResult> {
  const sku = cleanSku(rawSku);
  const searchUrl = `https://ksp.co.il/web/cat/?search=${encodeURIComponent(sku)}`;
  const apiUrl = `https://ksp.co.il/m_action/api/industry/description/select?q=${encodeURIComponent(sku)}`;

  let price: number | null = null;
  let productUrl: string | null = null;

  try {
    const res = await fetchWithTimeout(apiUrl);
    if (res && res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        const item = data.items.find((i: { name?: string; uin?: string }) => 
          (i.name && i.name.includes(sku)) || (i.uin && String(i.uin) === sku)
        ) || data.items[0];

        if (item) {
          const itemPrice = item.price || item.price_nis || item.price_ils || item.nis;
          if (typeof itemPrice === "number" && itemPrice > 0) {
            price = itemPrice;
          } else if (typeof itemPrice === "string") {
            const parsed = parseFloat(itemPrice.replace(/[^\d.]/g, ""));
            if (!isNaN(parsed) && parsed > 0) price = parsed;
          }
          if (item.uin) {
            productUrl = `https://ksp.co.il/web/item/${item.uin}`;
          }
        }
      }
    }
  } catch {
    // Ignore fetch errors
  }

  return {
    storeId: "ksp",
    storeName: "KSP",
    storeIcon: "📦",
    color: "green",
    searchUrl: productUrl || searchUrl,
    price,
    formattedPrice: price ? formatNis(price) : null,
    productUrl: productUrl || searchUrl,
  };
}

/**
 * Fetch price from Shufersal / Universal (shufersal.co.il)
 */
async function fetchShufersalPrice(rawSku: string): Promise<StorePriceResult> {
  const sku = cleanSku(rawSku);
  const searchUrl = `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(sku)}`;

  let price: number | null = null;
  let productUrl: string | null = null;

  try {
    const res = await fetchWithTimeout(searchUrl);
    if (res && res.ok) {
      const html = await res.text();

      const priceMatch =
        html.match(/class="number"[^>]*>\s*([\d\.]+)/) ||
        html.match(/data-price="([\d\.]+)"/) ||
        html.match(/"price":\s*"?([\d\.]+)"?/) ||
        html.match(/₪\s*([\d,]+(?:\.\d+)?)/);

      if (priceMatch && priceMatch[1]) {
        const parsed = parseFloat(priceMatch[1].replace(/,/g, ""));
        if (!isNaN(parsed) && parsed > 0) price = parsed;
      }

      const linkMatch = html.match(/href="(\/online\/he\/A-p-[0-9]+)"/);
      if (linkMatch && linkMatch[1]) {
        productUrl = `https://www.shufersal.co.il${linkMatch[1]}`;
      }
    }
  } catch {
    // Ignore fetch errors
  }

  return {
    storeId: "shufersal",
    storeName: "יוניברסל / שופרסל",
    storeIcon: "🛒",
    color: "blue",
    searchUrl: productUrl || searchUrl,
    price,
    formattedPrice: price ? formatNis(price) : null,
    productUrl: productUrl || searchUrl,
  };
}

/**
 * Fetch price from Super-Pharm Online (shop.super-pharm.co.il)
 */
async function fetchSuperPharmPrice(rawSku: string): Promise<StorePriceResult> {
  const sku = cleanSku(rawSku);
  const searchUrl = `https://shop.super-pharm.co.il/search?av=${encodeURIComponent(sku)}`;

  let price: number | null = null;
  let productUrl: string | null = null;

  try {
    const res = await fetchWithTimeout(searchUrl);
    if (res && res.ok) {
      const html = await res.text();

      // Products are rendered inside item-box blocks
      const blocks = html.split(/<a[^>]+class="item-box-link"/i);

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const hrefMatch = block.match(/^\s*href="([^"]+)"/);
        const dataNameMatch = block.match(/data-name="([^"]+)"/);
        const dataBrandMatch = block.match(/data-brand="([^"]+)"/);
        const dataPriceMatch = block.match(/data-price="([^"]+)"/);
        const dataDiscountMatch = block.match(/data-discountPrice="([^"]+)"/);
        const titleMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);

        const href = hrefMatch ? hrefMatch[1] : "";
        const name = dataNameMatch ? dataNameMatch[1] : (titleMatch ? titleMatch[1] : "");
        const brand = dataBrandMatch ? dataBrandMatch[1] : "";
        const priceStr = (dataDiscountMatch && dataDiscountMatch[1]) ? dataDiscountMatch[1] : (dataPriceMatch ? dataPriceMatch[1] : null);

        const isLego = brand.includes("לגו") || brand.toLowerCase().includes("lego") ||
                      name.includes("לגו") || name.toLowerCase().includes("lego") ||
                      href.includes("/lego/");

        const skuRegex = new RegExp(`(?:^|[^0-9])${sku}(?:[^0-9]|$)`);
        const hasSku = skuRegex.test(name) || href.includes(sku);

        if (isLego && hasSku && priceStr) {
          const parsedPrice = parseFloat(priceStr.replace(/,/g, ""));
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            price = parsedPrice;
            productUrl = href.startsWith("http") ? href : `https://shop.super-pharm.co.il${href}`;
            break;
          }
        }
      }
    }
  } catch {
    // Ignore fetch errors
  }

  return {
    storeId: "superpharm",
    storeName: "סופר-פארם אונליין",
    storeIcon: "🌐",
    color: "purple",
    searchUrl: productUrl || searchUrl,
    price,
    formattedPrice: price ? formatNis(price) : null,
    productUrl: productUrl || searchUrl,
  };
}

/**
 * Fetches prices from LEGO Store Israel, KSP, Shufersal, and Super-Pharm in parallel.
 */
export async function getStorePricesForSku(sku: string): Promise<StorePriceResult[]> {
  const results = await Promise.allSettled([
    fetchLegoPrice(sku),
    fetchKspPrice(sku),
    fetchShufersalPrice(sku),
    fetchSuperPharmPrice(sku),
  ]);

  return results.map((res, index) => {
    if (res.status === "fulfilled") {
      return res.value;
    }

    const defaultStores: Omit<StorePriceResult, "searchUrl" | "productUrl">[] = [
      { storeId: "lego", storeName: "חנות לגו ישראל (LEGO Certified Store)", storeIcon: "👑", color: "red", price: null, formattedPrice: null },
      { storeId: "ksp", storeName: "KSP", storeIcon: "📦", color: "green", price: null, formattedPrice: null },
      { storeId: "shufersal", storeName: "יוניברסל / שופרסל", storeIcon: "🛒", color: "blue", price: null, formattedPrice: null },
      { storeId: "superpharm", storeName: "סופר-פארם אונליין", storeIcon: "🌐", color: "purple", price: null, formattedPrice: null },
    ];
    const clean = cleanSku(sku);
    const urls = [
      `https://lego.certifiedstore.co.il/search?q=${encodeURIComponent(clean)}`,
      `https://ksp.co.il/web/cat/?search=${encodeURIComponent(clean)}`,
      `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(clean)}`,
      `https://shop.super-pharm.co.il/search?av=${encodeURIComponent(clean)}`,
    ];

    const def = defaultStores[index];
    return {
      ...def,
      searchUrl: urls[index],
      productUrl: urls[index],
    };
  });
}
