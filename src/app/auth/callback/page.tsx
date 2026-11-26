
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState(
    "Verifying your email and setting up your account..."
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function verifyAccount() {
      try {
        const supabase = createSupabaseBrowserClient();
        const params = new URLSearchParams(window.location.search);

        const urlError =
          params.get("error_description") || params.get("error");

        if (urlError) {
          throw new Error(urlError.replace(/\+/g, " "));
        }

        const requestedNext = params.get("next");
        const nextPath =
          requestedNext &&
          requestedNext.startsWith("/") &&
          !requestedNext.startsWith("//")
            ? requestedNext
            : "/";

        const code = params.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!data.session) {
          throw new Error(
            "We could not verify your session. Please try signing in."
          );
        }

        setStatus("success");
        setMessage("Your email has been verified. Welcome to ZuriStay!");

        window.setTimeout(() => {
          router.replace(nextPath);
          router.refresh();
        }, 2000);
      } catch (err) {
        console.error("Email verification error:", err);

        setStatus("error");
        setMessage(
          err instanceof Error
            ? err.message
            : "Email verification failed. Please try signing in again."
        );
      }
    }

    void verifyAccount();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf9f6] px-4 text-[#173b30]">
      <div className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm md:p-12">
        <Link href="/" className="text-3xl font-bold tracking-tight">
          Zuri<span className="text-[#c49a52]">Stay</span>
        </Link>

        <div className="mx-auto mt-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#f1eadc]">
          {status === "loading" && (
            <LoaderCircle
              size={38}
              className="animate-spin text-[#a77e3e]"
            />
          )}

          {status === "success" && (
            <CheckCircle2 size={40} className="text-green-600" />
          )}

          {status === "error" && (
            <XCircle size={40} className="text-red-600" />
          )}
        </div>

        <h1 className="mt-7 text-2xl font-bold">
          {status === "loading" && "Verifying your email"}
          {status === "success" && "Email verified!"}
          {status === "error" && "Verification unsuccessful"}
        </h1>

        <p
          role="status"
          className="mt-4 text-sm leading-7 text-gray-500"
        >
          {message}
        </p>

        {status === "success" && (
          <p className="mt-5 text-xs text-gray-400">
            Taking you to your account...
          </p>
        )}

        {status === "error" && (
          <Link
            href="/login"
            className="mt-7 inline-flex rounded-full bg-[#173b30] px-8 py-3.5 font-semibold text-white hover:bg-[#245545]"
          >
            Go to sign in
          </Link>
        )}

        <p className="mt-10 text-xs text-gray-400">
          Your World. Your Stay.
        </p>
      </div>
    </main>
  );
}
