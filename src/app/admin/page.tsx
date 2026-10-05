import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getCollection, type LegoSet } from "@/lib/data";
import { addSet, logout, removeSet, reorderSet, updateStatus } from "./actions";

function AdminRow({ set, index, count }: { set: LegoSet; index: number; count: number }) {
  return (
    <div className="admin-row">
      {set.imageUrl ? <Image className="admin-thumb" src={set.imageUrl} alt="" width={124} height={108} /> : <div className="admin-thumb" />}
      <div><h3>{set.name}</h3><p>ערכה {set.sku.replace(/-1$/, "")} · {set.year ? `שנת ${set.year}` : "שנה לא ידועה"}{set.status === "wanted" ? ` · עדיפות #${set.wishlistRank}` : ""}</p></div>
      <div className="row-actions">
        {set.status === "wanted" ? <>
          <form action={reorderSet}><input type="hidden" name="id" value={set.id} /><input type="hidden" name="direction" value="up" /><button className="small-button" disabled={index === 0} title="הזז למעלה">↑</button></form>
          <form action={reorderSet}><input type="hidden" name="id" value={set.id} /><input type="hidden" name="direction" value="down" /><button className="small-button" disabled={index === count - 1} title="הזז למטה">↓</button></form>
        </> : null}
        <form action={updateStatus}><input type="hidden" name="id" value={set.id} /><input type="hidden" name="status" value={set.status === "owned" ? "wanted" : "owned"} /><button className="small-button">העבר ל{set.status === "owned" ? "משאלות" : "באוסף"}</button></form>
        <form action={removeSet}><input type="hidden" name="id" value={set.id} /><button className="small-button danger">מחיקה</button></form>
      </div>
    </div>
  );
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { sets, configured } = await getCollection(); const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : ""; const success = typeof query.success === "string" ? query.success : "";
  const wanted = sets.filter((set) => set.status === "wanted").sort((a,b) => a.wishlistRank - b.wishlistRank); const owned = sets.filter((set) => set.status === "owned");
  return (
    <div className="admin-shell">
      <header className="admin-header"><div className="admin-header-inner">
        <Link href="/" className="brand"><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>אריאל</strong><small>פאנל ניהול</small></span></Link>
        <nav><Link href="/">לרשימה הציבורית</Link><form action={logout}><button className="ghost-button">התנתקות</button></form></nav>
      </div></header>
      <main className="admin-main">
        <div className="admin-title"><h1>ניהול רשימות הלגו</h1><p>הכניסו מספר ערכה והפרטים והתמונה הראשית יישלפו באופן אוטומטי.</p></div>
        {error ? <div className="flash error">{error}</div> : null}{success ? <div className="flash success">{success}</div> : null}
        {!configured ? <div className="flash error">DATABASE_URL אינו מוגדר. יש להגדיר אותו ב-Vercel לפני הוספת ערכות.</div> : null}
        <section className="panel"><h2>הוספה או עדכון ערכה</h2><form className="add-form" action={addSet}>
          <div className="field"><label htmlFor="sku">מספר ערכת לגו</label><input id="sku" name="sku" placeholder="40783" inputMode="numeric" required /></div>
          <div className="field"><label htmlFor="status">להוסיף ל-</label><select id="status" name="status" defaultValue="wanted"><option value="wanted">הכי רוצה (משאלות)</option><option value="owned">כבר יש (האוסף שלי)</option></select></div>
          <button type="submit" className="primary-button">אחזר והוסף ערכה</button>
        </form></section>
        <section className="panel"><h2>הכי רוצה ({wanted.length})</h2><div className="admin-list">{wanted.length ? wanted.map((set,index)=><AdminRow key={set.id} set={set} index={index} count={wanted.length} />) : <div className="empty-admin">עדיין אין ערכות ברשימת המשאלות.</div>}</div></section>
        <section className="panel"><h2>כבר יש באוסף ({owned.length})</h2><div className="admin-list">{owned.length ? owned.map((set,index)=><AdminRow key={set.id} set={set} index={index} count={owned.length} />) : <div className="empty-admin">עדיין אין ערכות באוסף.</div>}</div></section>
      </main>
    </div>
  );
}

