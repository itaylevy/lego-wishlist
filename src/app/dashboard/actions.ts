"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserId, isAdmin } from "@/lib/auth";
import {
  getChildProfileById,
  createChildProfile,
  updateChildProfile,
  deleteChildProfile,
  saveSetForProfile,
  changeStatusForProfile,
  deleteSetForProfile,
  moveWantedForProfile,
  normalizeSku,
  type SetStatus,
  DEFAULT_ARIEL_PROFILE_ID,
} from "@/lib/data";

function isNextRedirect(err: any): boolean {
  return Boolean(
    err &&
      (err.digest?.startsWith?.("NEXT_REDIRECT") ||
        err.message === "NEXT_REDIRECT" ||
        err.__proto__?.constructor?.name === "RedirectError")
  );
}

async function requireAuthUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (userId) return userId;

  // Check legacy admin session
  const adminLoggedIn = await isAdmin();
  if (adminLoggedIn) return "admin-user-default";

  redirect("/login");
}

async function verifyProfileOwnership(profileId: string): Promise<string> {
  const userId = await requireAuthUserId();
  if (profileId === DEFAULT_ARIEL_PROFILE_ID && (await isAdmin())) {
    return userId;
  }

  const profile = await getChildProfileById(profileId);
  if (!profile || profile.userId !== userId) {
    throw new Error("אין לך הרשאה לערוך פרופיל זה.");
  }
  return userId;
}

export async function addProfile(formData: FormData) {
  try {
    const userId = await requireAuthUserId();
    const name = String(formData.get("name") || "").trim();
    const rawSlug = String(formData.get("slug") || "").trim();
    const themeColor = String(formData.get("themeColor") || "yellow");
    const bio = String(formData.get("bio") || "").trim();

    if (!name) {
      redirect("/dashboard?error=" + encodeURIComponent("נא להזין שם עבור הילד."));
    }

    const newProfile = await createChildProfile(userId, {
      name,
      slug: rawSlug || name,
      themeColor,
      bio,
    });
    revalidatePath("/dashboard");
    redirect(`/dashboard/${newProfile.id}?success=` + encodeURIComponent(`הפרופיל של ${name} נוצר בהצלחה!`));
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Add profile error:", err);
    const msg = err.message?.includes("duplicate") ? "כינוי (slug) זה כבר תפוס, נסו כינוי אחר." : (err.message || "שגיאה ביצירת הפרופיל.");
    redirect("/dashboard?error=" + encodeURIComponent(msg));
  }
}

export async function editProfile(formData: FormData) {
  const profileId = String(formData.get("profileId") || "");
  try {
    const userId = await verifyProfileOwnership(profileId);

    const name = String(formData.get("name") || "").trim();
    const rawSlug = String(formData.get("slug") || "").trim();
    const themeColor = String(formData.get("themeColor") || "yellow");
    const bio = String(formData.get("bio") || "").trim();

    if (!name) {
      redirect(`/dashboard/${profileId}?error=` + encodeURIComponent("שם אינו יכול להיות ריק."));
    }

    await updateChildProfile(userId, profileId, {
      name,
      slug: rawSlug || name,
      themeColor,
      bio,
    });
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${profileId}`);
    redirect(`/dashboard/${profileId}?success=` + encodeURIComponent("פרטי הפרופיל עודכנו בהצלחה."));
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Edit profile error:", err);
    const msg = err.message?.includes("duplicate") ? "כינוי (slug) זה כבר תפוס." : (err.message || "שגיאה בעדכון הפרופיל.");
    redirect(`/dashboard/${profileId || ""}?error=` + encodeURIComponent(msg));
  }
}

export async function removeProfile(formData: FormData) {
  try {
    const profileId = String(formData.get("profileId") || "");
    const userId = await verifyProfileOwnership(profileId);

    await deleteChildProfile(userId, profileId);
    revalidatePath("/dashboard");
    redirect("/dashboard?success=" + encodeURIComponent("הפרופיל נמחק בהצלחה."));
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Remove profile error:", err);
    redirect("/dashboard?error=" + encodeURIComponent(err.message || "שגיאה במחיקת הפרופיל."));
  }
}

export async function addSet(formData: FormData) {
  const profileId = String(formData.get("profileId") || "");
  try {
    await verifyProfileOwnership(profileId);

    const rawSku = String(formData.get("sku") || "").trim();
    const status = String(formData.get("status") || "") as SetStatus;

    if (!/^\d{3,7}(?:-\d+)?$/.test(rawSku)) {
      redirect(`/dashboard/${profileId}?error=` + encodeURIComponent("הכניסו מספר ערכת לגו תקין."));
    }
    if (status !== "owned" && status !== "wanted") {
      redirect(`/dashboard/${profileId}?error=` + encodeURIComponent("בחרו רשימה תקינה."));
    }

    const sku = normalizeSku(rawSku);

    let name = `ערכה ${rawSku.replace(/-1$/, "")}`;
    let imageUrl: string | null = null;
    let year: number | null = null;
    let pieceCount: number | null = null;

    if (process.env.REBRICKABLE_API_KEY) {
      try {
        const response = await fetch(
          `https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(sku)}/`,
          {
            headers: { Authorization: `key ${process.env.REBRICKABLE_API_KEY}` },
            cache: "no-store",
          }
        );
        if (response.ok) {
          const result = await response.json();
          name = result.name;
          imageUrl = result.set_img_url;
          year = result.year;
          pieceCount = result.num_parts;
        }
      } catch {
        // Fallback to basic info
      }
    }

    await saveSetForProfile(profileId, {
      sku,
      name,
      status,
      imageUrl,
      legoUrl: `https://www.lego.com/en-il/search?q=${encodeURIComponent(rawSku.replace(/-1$/, ""))}`,
      year,
      pieceCount,
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${profileId}`);
    redirect(`/dashboard/${profileId}?success=` + encodeURIComponent(`הערכה ${name} נוספה בהצלחה!`));
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Add set error:", err);
    redirect(`/dashboard/${profileId}?error=` + encodeURIComponent(err.message || "לא ניתן היה לשמור את הערכה."));
  }
}

export async function updateStatus(formData: FormData) {
  const profileId = String(formData.get("profileId") || "");
  try {
    await verifyProfileOwnership(profileId);

    const id = String(formData.get("id") || "");
    const status = String(formData.get("status") || "") as SetStatus;
    if (!id || (status !== "owned" && status !== "wanted")) return;

    await changeStatusForProfile(profileId, id, status);
    revalidatePath(`/dashboard/${profileId}`);
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Update status error:", err);
    redirect(`/dashboard/${profileId}?error=` + encodeURIComponent(err.message || "שגיאה בעדכון הסטטוס."));
  }
}

export async function removeSet(formData: FormData) {
  const profileId = String(formData.get("profileId") || "");
  try {
    await verifyProfileOwnership(profileId);

    const id = String(formData.get("id") || "");
    if (!id) return;

    await deleteSetForProfile(profileId, id);
    revalidatePath(`/dashboard/${profileId}`);
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Remove set error:", err);
    redirect(`/dashboard/${profileId}?error=` + encodeURIComponent(err.message || "שגיאה במחיקת הערכה."));
  }
}

export async function reorderSet(formData: FormData) {
  const profileId = String(formData.get("profileId") || "");
  try {
    await verifyProfileOwnership(profileId);

    const id = String(formData.get("id") || "");
    const direction = String(formData.get("direction") || "") as "up" | "down";
    if (!id || (direction !== "up" && direction !== "down")) return;

    await moveWantedForProfile(profileId, id, direction);
    revalidatePath(`/dashboard/${profileId}`);
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    console.error("Reorder set error:", err);
    redirect(`/dashboard/${profileId}?error=` + encodeURIComponent(err.message || "שגיאה בסידור הערכה."));
  }
}
