"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Mail, Loader2, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError(null);

    const { error: signInError } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard",
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message || "Something went wrong. Please try again.");
    } else {
      setIsSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-[#EFCE8A]/10 blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-amber-600/10 blur-[128px]" />

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFCE8A]/10 text-[#EFCE8A] border border-[#EFCE8A]/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
            Welcome to SpaceBuilder
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Authenticate using a secure login link sent to your email.
          </p>
        </div>

        {isSent ? (
          <div className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-emerald-400">Check your email</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              We've sent a magic sign-in link to <span className="font-medium text-zinc-200">{email}</span>. Click the link to complete authentication.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Email Address
              </label>
              <div className="relative mt-2">
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition duration-200 focus:border-[#EFCE8A] focus:ring-1 focus:ring-[#EFCE8A] focus:bg-zinc-950"
                  disabled={isLoading}
                />
                <Mail className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-medium bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EFCE8A] py-3 text-sm font-semibold text-zinc-950 shadow-lg transition duration-200 hover:bg-[#ebd097] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                <>
                  Send Magic Link
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
