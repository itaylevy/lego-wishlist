import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { login } from "../actions";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await isAdmin()) redirect("/admin");
  const errorValue = (await searchParams).error; const error = typeof errorValue === "string" ? errorValue : "";
  return (
    <main className="login-page"><section className="login-card">
      <Link href="/" className="brand"><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>אריאל</strong><small>רשימת LEGO</small></span></Link>
      <h1>פאנל ניהול</h1><p>הכניסו את סיסמת המנהל המשפחתית כדי לעדכן את הרשימות של אריאל.</p>
      {error ? <div className="flash error">{error}</div> : null}
      <form action={login}><div className="field"><label htmlFor="password">סיסמת מנהל</label><input id="password" type="password" name="password" required autoFocus autoComplete="current-password" /></div><button className="primary-button" type="submit">כניסה לפאנל הניהול</button></form>
      <Link className="back-link" href="/">← חזרה לרשימת המשאלות</Link>
    </section></main>
  );
}

