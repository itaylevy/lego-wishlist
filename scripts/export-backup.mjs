import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Simple env file parser
function loadEnv() {
  const envPath = path.join(rootDir, ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const [key, ...vals] = trimmed.split("=");
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = vals.join("=").trim().replace(/^["']|["']$/g, "");
      }
    });
  }
}

loadEnv();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ Error: DATABASE_URL is not set in .env.local or environment.");
    console.log("ℹ️ If your database is hosted on Vercel/Neon, add DATABASE_URL=... into .env.local or download backup from /api/backup");
    process.exit(1);
  }

  console.log("Connecting to database to backup Ariel's LEGO sets...");
  const sql = neon(dbUrl);

  const rows = await sql`
    SELECT id, sku, name, status, image_url, lego_url, year, piece_count, wishlist_rank, created_at
    FROM lego_sets
    ORDER BY status DESC, wishlist_rank ASC, created_at DESC
  `;

  const dataDir = path.join(rootDir, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const outPath = path.join(dataDir, `backup-ariel-sets-${dateStr}.json`);
  const latestPath = path.join(dataDir, `backup-ariel-sets.json`);

  const payload = {
    exportedAt: new Date().toISOString(),
    owner: "אריאל",
    totalSets: rows.length,
    wantedSets: rows.filter((r) => r.status === "wanted").length,
    ownedSets: rows.filter((r) => r.status === "owned").length,
    sets: rows,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`✅ Success! Backed up ${rows.length} sets to:`);
  console.log(`   ${outPath}`);
  console.log(`   ${latestPath}`);
}

main().catch((err) => {
  console.error("❌ Backup failed:", err);
  process.exit(1);
});
