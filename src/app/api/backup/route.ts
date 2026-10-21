import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getCollection } from "@/lib/data";

export async function GET() {
  const isAuthorized = await isAdmin();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sets } = await getCollection();
  const dateStr = new Date().toISOString().split("T")[0];

  const backupData = {
    exportedAt: new Date().toISOString(),
    owner: "אריאל",
    totalSets: sets.length,
    wantedSets: sets.filter((s) => s.status === "wanted").length,
    ownedSets: sets.filter((s) => s.status === "owned").length,
    sets,
  };

  return new NextResponse(JSON.stringify(backupData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ariel-lego-backup-${dateStr}.json"`,
    },
  });
}
