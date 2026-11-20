"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Building2, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Method = "mpesa" | "till_paybill" | "bank";
type Payout = {
  payout_method: Method;
  account_holder_name: string;
  mpesa_phone?: string | null;
  merchant_type?: "till" | "paybill" | null;
  merchant_number?: string | null;
  merchant_account_number?: string | null;
  bank_name?: string | null;
  bank_code?: string | null;
  bank_branch?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  verification_status: string;
};

type BankOption = { bank_name: string; bank_code: string };

const blank: Payout = { payout_method: "mpesa", account_holder_name: "", verification_status: "pending" };

export default function PartnerPayoutSettingsPage() {
  const router = useRouter();
  const [payout, setPayout] = useState<Payout>(blank);
  const [token, setToken] = useState("");
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login?next=%2Fpartner%2Fpayouts");
          return;
        }
        const response = await fetch("/api/partner/payout-preference", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json();
        if (response.status === 401) {
          router.replace("/login?next=%2Fpartner%2Fpayouts");
          return;
        }
        if (!response.ok || !result.success) throw new Error(result.error || "Unable to load payout details.");
        const bankResponse = await fetch("/api/payments/bank-codes", { cache: "force-cache" });
        const bankResult = await bankResponse.json();
        if (active && bankResponse.ok && bankResult.success && Array.isArray(bankResult.banks)) {
          setBanks(bankResult.banks.filter((item: unknown): item is BankOption => !!item && typeof item === "object" && typeof (item as BankOption).bank_name === "string" && typeof (item as BankOption).bank_code === "string"));
        }
        if (active) {
          setToken(session.access_token);
          if (result.payout) setPayout({ ...blank, ...result.payout });
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unable to load payout details.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [router]);

  function update(field: keyof Payout, value: string) {
    setPayout(current => ({ ...current, [field]: value } as Payout));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/partner/payout-preference", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payout),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to save payout details.");
      setPayout({ ...blank, ...result.payout });
      setNotice(result.message || "Payout preference saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save payout details.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-900" /></main>;

  const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100";
  const labelClass = "block text-sm font-semibold text-slate-700";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight text-blue-900">ZuriStay<span className="text-amber-500">.</span></Link>
          <Link href="/partner/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-900"><ArrowLeft size={16}/> Partner dashboard</Link>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Partner finance</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Payout preferences</h1>
        <p className="mt-2 text-slate-600">Choose where ZuriStay should send your eligible booking earnings. You can update your preferred destination at any time.</p>

        {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mt-6 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0"/>{notice}</div>}

        <form onSubmit={save} className="mt-7 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className={labelClass} htmlFor="account_holder_name">Account holder / business name</label>
            <input id="account_holder_name" className={inputClass} value={payout.account_holder_name} onChange={e => update("account_holder_name", e.target.value)} required maxLength={120} placeholder="Name registered to the payout account"/>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-slate-700">Preferred payout method</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <button type="button" onClick={() => update("payout_method", "mpesa")} className={`rounded-xl border p-4 text-left transition ${payout.payout_method === "mpesa" ? "border-blue-800 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-400"}`}>
                <Smartphone className="mb-2 text-blue-900"/><span className="block font-semibold text-slate-900">M-Pesa</span><span className="mt-1 block text-xs text-slate-500">Phone number</span>
              </button>
              <button type="button" onClick={() => update("payout_method", "till_paybill")} className={`rounded-xl border p-4 text-left transition ${payout.payout_method === "till_paybill" ? "border-blue-800 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-400"}`}>
                <Building2 className="mb-2 text-blue-900"/><span className="block font-semibold text-slate-900">Till / Paybill</span><span className="mt-1 block text-xs text-slate-500">Business number</span>
              </button>
              <button type="button" onClick={() => update("payout_method", "bank")} className={`rounded-xl border p-4 text-left transition ${payout.payout_method === "bank" ? "border-blue-800 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-400"}`}>
                <Banknote className="mb-2 text-blue-900"/><span className="block font-semibold text-slate-900">Bank account</span><span className="mt-1 block text-xs text-slate-500">Bank transfer</span>
              </button>
            </div>
          </fieldset>

          {payout.payout_method === "mpesa" && <div>
            <label className={labelClass} htmlFor="mpesa_phone">M-Pesa phone number</label>
            <input id="mpesa_phone" className={inputClass} value={payout.mpesa_phone || ""} onChange={e => update("mpesa_phone", e.target.value)} required placeholder="0712 345 678" inputMode="tel"/>
          </div>}

          {payout.payout_method === "till_paybill" && <div className="grid gap-5 sm:grid-cols-2">
            <div><label className={labelClass} htmlFor="merchant_type">Business number type</label><select id="merchant_type" className={inputClass} value={payout.merchant_type || "till"} onChange={e => update("merchant_type", e.target.value)}><option value="till">Buy Goods (Till)</option><option value="paybill">Paybill</option></select></div>
            <div><label className={labelClass} htmlFor="merchant_number">Till / Paybill number</label><input id="merchant_number" className={inputClass} value={payout.merchant_number || ""} onChange={e => update("merchant_number", e.target.value)} required inputMode="numeric" placeholder="Business number"/></div>
            {payout.merchant_type === "paybill" && <div className="sm:col-span-2"><label className={labelClass} htmlFor="merchant_account_number">Paybill account number</label><input id="merchant_account_number" className={inputClass} value={payout.merchant_account_number || ""} onChange={e => update("merchant_account_number", e.target.value)} required placeholder="Account number for receiving payments"/></div>}
          </div>}

          {payout.payout_method === "bank" && <div className="grid gap-5 sm:grid-cols-2">
            <div><label className={labelClass} htmlFor="bank_name">Bank name</label><select id="bank_name" className={inputClass} value={payout.bank_code || ""} onChange={e => { const bank = banks.find(item => item.bank_code === e.target.value); setPayout(current => ({ ...current, bank_name: bank?.bank_name || "", bank_code: bank?.bank_code || "" })); }} required><option value="">Select your bank</option>{banks.map(bank => <option key={bank.bank_code} value={bank.bank_code}>{bank.bank_name}</option>)}</select>{banks.length === 0 && <p className="mt-1 text-xs text-amber-700">Bank directory unavailable. Refresh the page to try again.</p>}</div>
            <div><label className={labelClass} htmlFor="bank_branch">Branch (optional)</label><input id="bank_branch" className={inputClass} value={payout.bank_branch || ""} onChange={e => update("bank_branch", e.target.value)} placeholder="Branch name"/></div>
            <div><label className={labelClass} htmlFor="bank_account_name">Bank account name</label><input id="bank_account_name" className={inputClass} value={payout.bank_account_name || ""} onChange={e => update("bank_account_name", e.target.value)} required placeholder="Name on bank account"/></div>
            <div><label className={labelClass} htmlFor="bank_account_number">Bank account number</label><input id="bank_account_number" className={inputClass} value={payout.bank_account_number || ""} onChange={e => update("bank_account_number", e.target.value)} required inputMode="numeric" placeholder="Account number"/></div>
          </div>}

          {payout.verification_status === "verified" ? <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">Your payout destination is verified.</p> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your details will be verified before automatic payouts are activated. Saving these details does not initiate a transfer.</p>}

          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <><Loader2 size={18} className="animate-spin"/> Saving...</> : "Save payout preference"}</button>
        </form>
      </div>
    </main>
  );
}
