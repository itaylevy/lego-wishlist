"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { changeStatus, deleteSetById, moveWanted, normalizeSku, saveSet, type SetStatus } from "@/lib/data";
import { clearAdminSession, createAdminSession, isAdmin, passwordIsValid } from "@/lib/auth";

function adminRedirect(type: "error" | "success", message: string): never { redirect(`/admin?${type}=${encodeURIComponent(message)}`); }
async function requireAdmin() { if (!(await isAdmin())) redirect("/admin/login"); }
export async function login(formData: FormData) {
  const password = String(formData.get("password") || "");
  if (!process.env.ADMIN_PASSWORD) redirect("/admin/login?error=" + encodeURIComponent("ADMIN_PASSWORD אינו מוגדר"));
  if (!passwordIsValid(password)) redirect("/admin/login?error=" + encodeURIComponent("סיסמה שגויה"));
  await createAdminSession(); redirect("/admin");
}
export async function logout() { await clearAdminSession(); redirect("/"); }
export async function addSet(formData: FormData) {
  await requireAdmin();
  const rawSku = String(formData.get("sku") || "").trim(); const status = String(formData.get("status") || "") as SetStatus;
  if (!/^\d{3,7}(?:-\d+)?$/.test(rawSku)) adminRedirect("error", "הכניסו מספר ערכת לגו תקין.");
  if (status !== "owned" && status !== "wanted") adminRedirect("error", "בחרו רשימה תקינה.");
  if (!process.env.REBRICKABLE_API_KEY) adminRedirect("error", "REBRICKABLE_API_KEY אינו מוגדר.");
  const sku = normalizeSku(rawSku);
  const response = await fetch(`https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(sku)}/`, { headers: { Authorization: `key ${process.env.REBRICKABLE_API_KEY}` }, cache: "no-store" });
  if (response.status === 404) adminRedirect("error", `ערכת לגו מספר ${rawSku} לא נמצאה.`);
  if (!response.ok) adminRedirect("error", "לא ניתן היה להתחבר לקטלוג LEGO. נסו שוב במועד מאוחר יותר.");
  const result = (await response.json()) as { set_num: string; name: string; year: number; num_parts: number; set_img_url: string | null };
  try {
    await saveSet({ sku: result.set_num, name: result.name, status, imageUrl: result.set_img_url,
      legoUrl: `https://www.lego.com/en-il/search?q=${encodeURIComponent(rawSku.replace(/-1$/, ""))}`,
      year: result.year, pieceCount: result.num_parts });
  } catch (error) { adminRedirect("error", error instanceof Error ? error.message : "לא ניתן היה לשמור את הערכה."); }
  revalidatePath("/"); revalidatePath("/admin"); adminRedirect("success", `הערכה ${result.name} נוספה בהצלחה.`);
}
export async function updateStatus(formData: FormData) {
  await requireAdmin(); const id = String(formData.get("id") || ""); const status = String(formData.get("status") || "") as SetStatus;
  if (!id || (status !== "owned" && status !== "wanted")) adminRedirect("error", "עדכון לא תקין.");
  await changeStatus(id, status); revalidatePath("/"); revalidatePath("/admin");
}
export async function removeSet(formData: FormData) {
  await requireAdmin(); const id = String(formData.get("id") || ""); if (!id) adminRedirect("error", "ערכה לא תקינה.");
  await deleteSetById(id); revalidatePath("/"); revalidatePath("/admin");
}
export async function reorderSet(formData: FormData) {
  await requireAdmin(); const id = String(formData.get("id") || ""); const direction = String(formData.get("direction") || "") as "up" | "down";
  if (!id || (direction !== "up" && direction !== "down")) adminRedirect("error", "בקשת שינוי סדר לא תקינה.");
  await moveWanted(id, direction); revalidatePath("/"); revalidatePath("/admin");
}

