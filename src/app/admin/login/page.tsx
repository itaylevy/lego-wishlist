import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { login } from "../actions";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await isAdmin()) redirect("/admin");
  const errorValue = (await searchParams).error; const error = typeof errorValue === "string" ? errorValue : "";
  return (
    <main className="login-page"><section className="login-card">
      <Link href="/" className="brand"><span className="brand-mark"><i /><i /><i /><i /></span><span><strong>Ariel&apos;s</strong><small>LEGO WISHLIST</small></span></Link>
      <h1>Managing panel</h1><p>Enter the family admin password to update Ariel&apos;s lists.</p>
      {error ? <div className="flash error">{error}</div> : null}
      <form action={login}><div className="field"><label htmlFor="password">ADMIN PASSWORD</label><input id="password" type="password" name="password" required autoFocus autoComplete="current-password" /></div><button className="primary-button" type="submit">Open managing panel</button></form>
      <Link className="back-link" href="/">← Back to the wishlist</Link>
    </section></main>
  );
}
