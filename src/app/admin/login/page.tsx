"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [accessNotice, setAccessNotice] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkExistingSession() {
      setAccessNotice(new URLSearchParams(window.location.search).get("reason") === "access");
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) return;
        if (profile?.role === "admin") {
          router.replace("/admin");
          return;
        }
        setAccessNotice(true);
        await supabase.auth.signOut();
        if (!active) return;
      }
      setChecking(false);
    }
    checkExistingSession().catch(() => setChecking(false));
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError || !data.user) throw signInError || new Error("Unable to sign in.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }
      if (profile?.role !== "admin") {
        await supabase.auth.signOut();
        setPassword("");
        setError("Administrator access required. These credentials are not assigned an administrator account. You have not been signed in.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Check your administrator credentials and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] text-sm text-slate-500">Checking administrator access…</main>;
  }

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#173b30]">
      <header className="border-b border-gray-100 bg-white">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="text-3xl font-bold tracking-tight">Zuri<span className="text-[#c49a52]">Stay</span></Link>
          <Link href="/" className="text-sm font-semibold text-gray-600 hover:text-[#c49a52]">Back to homepage</Link>
        </div>
      </header>
      <section className="container flex justify-center px-4 py-14 md:py-20">
        <div className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-7 shadow-sm md:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f1eadc] text-[#a77e3e]"><ShieldCheck size={30} /></div>
            <p className="mt-6 text-xs font-bold tracking-[0.2em] text-[#c49a52]">SECURE ADMINISTRATION</p>
            <h1 className="mt-3 text-3xl font-bold">Administrator sign in</h1>
            <p className="mt-3 text-sm leading-6 text-gray-500">Enter your administrator account credentials to access the ZuriStay control centre.</p>
          </div>
          {accessNotice && (
            <p role="status" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">The previous session did not have administrator permission. It has been signed out. Sign in below with your administrator credentials.</p>
          )}
          {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-semibold">Administrator email</label>
              <input id="admin-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15" />
            </div>
            <div>
              <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold">Password</label>
              <div className="relative">
                <input id="admin-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter administrator password" className="w-full rounded-xl border border-gray-200 px-4 py-3.5 pr-12 text-sm outline-none focus:border-[#c49a52] focus:ring-2 focus:ring-[#c49a52]/15" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-full bg-[#173b30] px-7 py-4 font-bold text-white transition hover:bg-[#245545] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "Verifying administrator…" : "Sign in to admin dashboard"} {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          <div className="mt-7 border-t border-gray-100 pt-6 text-center">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[#173b30]/20 px-6 py-3 text-sm font-semibold text-[#173b30] hover:bg-[#f4eee2]">Return to homepage</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
