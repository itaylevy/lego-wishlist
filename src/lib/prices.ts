export type StorePriceResult = {
  storeId: "lego" | "ksp" | "shufersal";
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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
};

async function fetchWithTimeout(url: string, timeoutMs = 3500): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
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
 * Fetch LEGO price from LEGO Store Israel (legostore.co.il) or LEGO official
 */
async function fetchLegoPrice(rawSku: string): Promise<StorePriceResult> {
  const sku = cleanSku(rawSku);
  const searchUrl = `https://legostore.co.il/catalogsearch/result/?q=${encodeURIComponent(sku)}`;
  const israelLegoUrl = `https://www.lego.com/he-il/search?q=${encodeURIComponent(sku)}`;

  let price: number | null = null;
  let productUrl: string | null = null;

  try {
    const res = await fetchWithTimeout(searchUrl);
    if (res && res.ok) {
      const html = await res.text();
      
      // Match price in Magento / Schema markup
      const priceMatch =
        html.match(/data-price-amount="([\d\.]+)"/) ||
        html.match(/class="price"[^>]*>\s*₪?\s*([\d,]+(?:\.\d+)?)/) ||
        html.match(/"price":\s*"?([\d\.]+)"?/);

      if (priceMatch && priceMatch[1]) {
        const parsed = parseFloat(priceMatch[1].replace(/,/g, ""));
        if (!isNaN(parsed) && parsed > 0) {
          price = parsed;
        }
      }

      // Try extracting product link
      const linkMatch = html.match(/href="(https:\/\/legostore\.co\.il\/[a-z0-9-]+\.html)"/i);
      if (linkMatch && linkMatch[1]) {
        productUrl = linkMatch[1];
      }
    }
  } catch {
    // Ignore fetch errors
  }

  return {
    storeId: "lego",
    storeName: "חנות לגו ישראל (LEGO Store)",
    storeIcon: "👑",
    color: "red",
    searchUrl: productUrl || searchUrl || israelLegoUrl,
    price,
    formattedPrice: price ? formatNis(price) : null,
    productUrl: productUrl || searchUrl || israelLegoUrl,
  };
}

/**
 * Fetch price from KSP (ksp.co.il)
 */
async function fetchKspPrice(rawSku: string): Promise<StorePriceResult> {
  const sku = cleanSku(rawSku);
  const searchUrl = `https://ksp.co.il/web/site/skus?q=${encodeURIComponent(sku)}`;
  const apiUrl = `https://ksp.co.il/m_action/api/industry/description/select?q=${encodeURIComponent(sku)}`;

  let price: number | null = null;
  let productUrl: string | null = null;

  try {
    const res = await fetchWithTimeout(apiUrl);
    if (res && res.ok) {
      const data = await res.json();
      // KSP API output format inspection
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
      } else if (data && typeof data === "object") {
        // Direct object search
        const itemPrice = data.price || data.price_nis || data.nis;
        if (typeof itemPrice === "number" && itemPrice > 0) price = itemPrice;
      }
    }
  } catch {
    // Ignore fetch errors
  }

  // Fallback to HTML search scraping if API fails or yields no price
  if (price === null) {
    try {
      const resHtml = await fetchWithTimeout(searchUrl);
      if (resHtml && resHtml.ok) {
        const html = await resHtml.text();
        const priceMatch =
          html.match(/"price":\s*"?([\d\.]+)"?/) ||
          html.match(/₪\s*([\d,]+(?:\.\d+)?)/) ||
          html.match(/class="[^"]*price[^"]*"[^>]*>\s*([\d,]+)/);
        if (priceMatch && priceMatch[1]) {
          const parsed = parseFloat(priceMatch[1].replace(/,/g, ""));
          if (!isNaN(parsed) && parsed > 0) price = parsed;
        }
      }
    } catch {
      // Ignore
    }
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

      // Look for price in Shufersal HTML search results
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
 * Fetches prices from LEGO Store Israel, KSP, and Shufersal in parallel.
 */
export async function getStorePricesForSku(sku: string): Promise<StorePriceResult[]> {
  const results = await Promise.allSettled([
    fetchLegoPrice(sku),
    fetchKspPrice(sku),
    fetchShufersalPrice(sku),
  ]);

  return results.map((res, index) => {
    if (res.status === "fulfilled") {
      return res.value;
    }

    // Default fallback if Promise rejected
    const defaultStores: Omit<StorePriceResult, "searchUrl" | "productUrl">[] = [
      { storeId: "lego", storeName: "חנות לגו ישראל (LEGO Store)", storeIcon: "👑", color: "red", price: null, formattedPrice: null },
      { storeId: "ksp", storeName: "KSP", storeIcon: "📦", color: "green", price: null, formattedPrice: null },
      { storeId: "shufersal", storeName: "יוניברסל / שופרסל", storeIcon: "🛒", color: "blue", price: null, formattedPrice: null },
    ];
    const clean = cleanSku(sku);
    const urls = [
      `https://legostore.co.il/catalogsearch/result/?q=${encodeURIComponent(clean)}`,
      `https://ksp.co.il/web/site/skus?q=${encodeURIComponent(clean)}`,
      `https://www.shufersal.co.il/online/he/search?q=${encodeURIComponent(clean)}`,
    ];

    const def = defaultStores[index];
    return {
      ...def,
      searchUrl: urls[index],
      productUrl: urls[index],
    };
  });
}
