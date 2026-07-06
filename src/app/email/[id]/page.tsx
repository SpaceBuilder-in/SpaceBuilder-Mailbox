"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
    ArrowLeft,
    Star,
    Eye,
    EyeOff,
    Clock,
    User,
    RefreshCw,
    Mail,
    Trash2,
} from "lucide-react";
import type { Email } from "@/db/schema";

export default function EmailDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();

    const [email, setEmail] = useState<Email | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [iframeHeight, setIframeHeight] = useState("500px");

    // Auth and Admin authorization check
    useEffect(() => {
        if (!isPending && !session) {
            router.push("/login");
        }
    }, [session, isPending, router]);

    // Fetch the individual email details
    useEffect(() => {
        if (!session) return;

        const fetchEmail = async () => {
            try {
                const res = await fetch(`/api/emails/${id}`);
                const data = await res.json();

                if (res.ok && data.email) {
                    setEmail(data.email);

                    // Mark as read automatically when opened if it wasn't already
                    if (!data.email.isRead) {
                        await fetch(`/api/emails/${id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isRead: true }),
                        });
                        setEmail((prev) => (prev ? { ...prev, isRead: true } : null));
                    }
                } else {
                    setError(data.error || "Failed to load email.");
                }
            } catch (err) {
                console.error(err);
                setError("An error occurred while fetching the email.");
            } finally {
                setLoading(false);
            }
        };

        fetchEmail();
    }, [id, session]);

    // Toggle Star status
    const toggleStar = async () => {
        if (!email) return;
        const updatedStarred = !email.isStarred;

        setEmail((prev) => (prev ? { ...prev, isStarred: updatedStarred } : null));

        try {
            await fetch(`/api/emails/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isStarred: updatedStarred }),
            });
        } catch (err) {
            console.error(err);
        }
    };

    // Toggle Read status
    const toggleRead = async () => {
        if (!email) return;
        const updatedRead = !email.isRead;

        setEmail((prev) => (prev ? { ...prev, isRead: updatedRead } : null));

        try {
            await fetch(`/api/emails/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isRead: updatedRead }),
            });
        } catch (err) {
            console.error(err);
        }
    };

    // Soft delete the email and go back
    const softDeleteEmail = async () => {
        if (!email) return;

        try {
            await fetch(`/api/emails/${id}`, {
                method: "DELETE",
            });
            router.back();
        } catch (err) {
            console.error("Failed to delete email:", err);
        }
    };

    if (isPending || !session) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-[#EFCE8A]" />
                    <p className="text-sm text-zinc-400">Verifying session...</p>
                </div>
            </div>
        );
    }

    const userRole = (session.user as any).role || "user";
    if (userRole !== "admin") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50 px-4">
                <div className="text-center space-y-5 w-full max-w-md p-8 border border-zinc-900 bg-zinc-900/40 backdrop-blur-xl rounded-2xl shadow-2xl">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <span className="text-xl font-bold">!</span>
                    </div>
                    <h2 className="text-xl font-bold text-rose-400">Access Denied</h2>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                        This dashboard is restricted to admin users only. Your account is registered under the role <span className="font-semibold text-zinc-200">"{userRole}"</span>.
                    </p>
                    <button
                        onClick={async () => {
                            await authClient.signOut();
                            router.push("/login");
                        }}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition"
                    >
                        Sign Out & Log In as Admin
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans relative overflow-x-hidden">
            {/* Glow Effects */}
            <div className="absolute top-0 right-1/4 h-[30rem] w-[30rem] rounded-full bg-[#EFCE8A]/5 blur-[160px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 h-[30rem] w-[30rem] rounded-full bg-amber-600/5 blur-[160px] pointer-events-none" />

            {/* Main Container */}
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 z-10 flex flex-col gap-6">
                {/* Back and Toolbar */}
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                    <button
                        onClick={() => router.back()} // Router back maintains the list state/scroll
                        className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition text-sm font-medium"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Inbox
                    </button>

                    {email && (
                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleStar}
                                className={`text-zinc-400 hover:text-amber-400 transition duration-150 ${email.isStarred ? "text-amber-400" : ""
                                    }`}
                                title={email.isStarred ? "Unstar" : "Star"}
                            >
                                <Star className="h-5 w-5 fill-current" />
                            </button>
                            <button
                                onClick={toggleRead}
                                className="text-zinc-400 hover:text-[#EFCE8A] transition duration-150"
                                title={email.isRead ? "Mark as unread" : "Mark as read"}
                            >
                                {email.isRead ? (
                                    <EyeOff className="h-5 w-5" />
                                ) : (
                                    <Eye className="h-5 w-5" />
                                )}
                            </button>
                            <button
                                onClick={softDeleteEmail}
                                className="text-zinc-400 hover:text-rose-400 transition duration-150"
                                title="Delete email"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex flex-col gap-6 animate-pulse">
                        <div className="h-8 w-2/3 bg-zinc-900 rounded-lg" />
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-zinc-900 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 w-1/4 bg-zinc-900 rounded" />
                                <div className="h-3 w-1/3 bg-zinc-900 rounded" />
                            </div>
                        </div>
                        <div className="h-96 bg-zinc-900 rounded-xl" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                        <Mail className="h-12 w-12 stroke-[1.2] mb-4 text-zinc-600" />
                        <h3 className="text-base font-medium text-zinc-400">{error}</h3>
                        <button
                            onClick={() => router.back()}
                            className="mt-4 text-sm text-[#EFCE8A] hover:underline"
                        >
                            Go Back
                        </button>
                    </div>
                ) : email ? (
                    <div className="flex flex-col gap-6">
                        {/* Email Title & Subject */}
                        <div className="space-y-4">
                            <h1 className="text-2xl font-extrabold text-zinc-50 tracking-tight leading-tight">
                                {email.subject}
                            </h1>

                            <div className="flex justify-between items-center bg-zinc-900/20 p-4 rounded-xl border border-zinc-900">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-[#EFCE8A]/10 text-[#EFCE8A] border border-[#EFCE8A]/20 flex items-center justify-center font-bold text-sm shrink-0">
                                        {(email.fromName || email.fromAddress)[0].toUpperCase()}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="text-sm font-semibold text-zinc-200 truncate">
                                            {email.fromName || "Unknown Sender"}
                                        </div>
                                        <div className="text-xs text-zinc-500 truncate">
                                            From: {email.fromAddress}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end text-right shrink-0">
                                    <span className="text-xs text-zinc-400 font-medium">
                                        To: {email.toAddress}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {new Date(email.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Email Body Viewer */}
                        <div className="w-full rounded-xl border border-zinc-900 bg-zinc-900/10 p-1">
                            {email.bodyHtml ? (
                                <div className="w-full rounded-lg overflow-hidden bg-white">
                                    <iframe
                                        srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <style>
                            body {
                              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                              color: #1f2937;
                              line-height: 1.6;
                              padding: 24px;
                              margin: 0;
                            }
                            a { color: #EFCE8A; }
                          </style>
                        </head>
                        <body>
                          ${email.bodyHtml}
                        </body>
                      </html>
                    `}
                                        onLoad={(e) => {
                                            try {
                                                const iframe = e.currentTarget;
                                                if (iframe.contentWindow?.document.documentElement) {
                                                    const height = iframe.contentWindow.document.documentElement.scrollHeight;
                                                    setIframeHeight(`${height}px`);
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                        style={{ height: iframeHeight }}
                                        className="w-full border-0"
                                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                                    />
                                </div>
                            ) : (
                                <div className="w-full min-h-[300px] overflow-y-auto rounded-lg bg-zinc-950 p-6 whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed font-mono custom-scrollbar border border-zinc-900">
                                    {email.bodyText || "This email has no text content."}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </main>
        </div>
    );
}
