"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  Mail,
  Star,
  Inbox,
  LogOut,
  Search,
  RefreshCw,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  Trash2,
  Check,
} from "lucide-react";
import type { Email } from "@/db/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const LIMIT = 15;

interface DashboardCache {
  emails: Email[];
  tab: "all" | "unread" | "starred";
  offset: number;
  hasMore: boolean;
  scrollY: number;
}

// Client-side cache that survives page unmounts during Next.js router transitions
let dashboardCache: DashboardCache | null = null;

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [emails, setEmails] = useState<Email[]>(() => dashboardCache?.emails || []);
  const [tab, setTab] = useState<"all" | "unread" | "starred">(() => dashboardCache?.tab || "all");
  const [offset, setOffset] = useState(() => dashboardCache?.offset || 0);
  const [hasMore, setHasMore] = useState(() => dashboardCache?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Sync state modifications to the global dashboardCache
  const updateCache = (updates: Partial<DashboardCache>) => {
    if (!dashboardCache) {
      dashboardCache = {
        emails: [],
        tab: "all",
        offset: 0,
        hasMore: true,
        scrollY: 0,
      };
    }
    Object.assign(dashboardCache, updates);
  };

  useEffect(() => {
    updateCache({ emails, tab, offset, hasMore });
  }, [emails, tab, offset, hasMore]);

  // Restore scroll position on component mount
  useEffect(() => {
    if (dashboardCache && dashboardCache.scrollY > 0) {
      const scrollContainer = document.querySelector(".custom-scrollbar-container");
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = dashboardCache?.scrollY || 0;
        }, 50);
      }
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    updateCache({ scrollY: e.currentTarget.scrollTop });
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  // Fetch emails API call
  const fetchEmails = useCallback(
    async (currentOffset: number, isRefresh = false) => {
      if (loading) return;
      setLoading(true);

      try {
        const res = await fetch(
          `/api/emails?tab=${tab}&limit=${LIMIT}&offset=${currentOffset}`
        );
        const data = await res.json();

        if (data.emails) {
          setEmails((prev) => {
            const updated = isRefresh ? data.emails : [...prev, ...data.emails];
            updateCache({ emails: updated });
            return updated;
          });
          setHasMore(data.emails.length === LIMIT);
          setOffset(currentOffset + data.emails.length);
        }
      } catch (err) {
        console.error("Failed to load emails:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, loading]
  );

  // Trigger loading initial batch or on tab changes
  useEffect(() => {
    if (session) {
      // Only fetch fresh if there is no cache, the tab is different, or the cache is empty
      if (!dashboardCache || dashboardCache.tab !== tab || dashboardCache.emails.length === 0) {
        setEmails([]);
        setOffset(0);
        setHasMore(true);
        setSelectedIds(new Set());
        updateCache({ scrollY: 0 });
        fetchEmails(0, true);
      }
    }
  }, [tab, session]);

  // Real-time polling: check for new emails every 8 seconds and prepend them to the list
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/emails?tab=${tab}&limit=10&offset=0`);
        const data = await res.json();
        
        if (data.emails && data.emails.length > 0) {
          setEmails((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newEmails = data.emails.filter((e: Email) => !existingIds.has(e.id));
            
            if (newEmails.length > 0) {
              const updatedList = [...newEmails, ...prev];
              updateCache({ emails: updatedList });
              return updatedList;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Error polling new emails:", err);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [session, tab]);

  // Infinite scroll observer setup
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          fetchEmails(offset);
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [loading, hasMore, offset, fetchEmails]
  );

  // Manual refresh
  const handleRefresh = () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    setSelectedIds(new Set());
    updateCache({ scrollY: 0 });
    fetchEmails(0, true);
  };

  // Log out action
  const handleSignOut = async () => {
    dashboardCache = null; // Clear cache on logout
    await authClient.signOut();
    router.push("/login");
  };

  // Toggle Star status
  const toggleStar = async (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    const updatedStarred = !email.isStarred;

    setEmails((prev) => {
      const updated = prev.map((item) =>
        item.id === email.id ? { ...item, isStarred: updatedStarred } : item
      );
      updateCache({ emails: updated });
      return updated;
    });

    try {
      await fetch(`/api/emails/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: updatedStarred }),
      });
    } catch (err) {
      console.error("Failed to update star state:", err);
    }
  };

  // Toggle Read status
  const toggleRead = async (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    const updatedRead = !email.isRead;

    setEmails((prev) => {
      const updated = prev.map((item) =>
        item.id === email.id ? { ...item, isRead: updatedRead } : item
      );
      updateCache({ emails: updated });
      return updated;
    });

    try {
      await fetch(`/api/emails/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: updatedRead }),
      });
    } catch (err) {
      console.error("Failed to update read state:", err);
    }
  };

  // Soft delete an email
  const softDeleteEmail = async (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    
    // Optimistic UI update: remove from list
    setEmails((prev) => {
      const updated = prev.filter((item) => item.id !== email.id);
      updateCache({ emails: updated });
      return updated;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(email.id);
      return next;
    });

    try {
      const res = await fetch(`/api/emails/${email.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Failed to delete email");
      }
    } catch (err) {
      console.error("Failed to delete email:", err);
    }
  };

  const filteredEmails = emails.filter((email) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(searchLower) ||
      email.fromAddress?.toLowerCase().includes(searchLower) ||
      email.fromName?.toLowerCase().includes(searchLower) ||
      email.bodyText?.toLowerCase().includes(searchLower)
    );
  });

  // Checkbox management callbacks
  const isAllSelected = filteredEmails.length > 0 && selectedIds.size === filteredEmails.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(filteredEmails.map((email) => email.id));
      setSelectedIds(allIds);
    }
  };

  const toggleSelect = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);
    
    // Optimistic UI updates
    setEmails((prev) => {
      const updated = prev.filter((email) => !selectedIds.has(email.id));
      updateCache({ emails: updated });
      return updated;
    });
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsArray }),
      });
      if (!res.ok) {
        console.error("Failed to bulk delete");
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  };

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-[#EFCE8A]" />
          <p className="text-sm text-zinc-400">Loading inbox...</p>
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
            onClick={handleSignOut}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition active:scale-[0.98]"
          >
            Sign Out & Log In as Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans w-full relative">
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 h-[30rem] w-[30rem] rounded-full bg-[#EFCE8A]/5 blur-[160px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 h-[30rem] w-[30rem] rounded-full bg-amber-600/5 blur-[160px] pointer-events-none" />

        {/* Collapsible Sidebar */}
        <Sidebar className="border-r border-zinc-900 bg-zinc-950/80 backdrop-blur-xl">
          <SidebarHeader className="p-6 border-b border-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFCE8A]/10 text-[#EFCE8A] border border-[#EFCE8A]/20">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent group-data-[collapsible=icon]:hidden">
                SpaceBuilder
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent className="mt-2">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setTab("all")}
                      isActive={tab === "all"}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition duration-200 ${
                        tab === "all"
                          ? "bg-zinc-900 text-[#EFCE8A] border-l-2 border-[#EFCE8A]"
                          : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                      }`}
                    >
                      <Inbox className="h-4 w-4 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">All Mails</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setTab("unread")}
                      isActive={tab === "unread"}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition duration-200 ${
                        tab === "unread"
                          ? "bg-zinc-900 text-[#EFCE8A] border-l-2 border-[#EFCE8A]"
                          : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                      }`}
                    >
                      <EyeOff className="h-4 w-4 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">Unread</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setTab("starred")}
                      isActive={tab === "starred"}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition duration-200 ${
                        tab === "starred"
                          ? "bg-zinc-900 text-[#EFCE8A] border-l-2 border-[#EFCE8A]"
                          : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                      }`}
                    >
                      <Star className="h-4 w-4 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">Starred</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-6 border-t border-zinc-900/50">
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:px-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                  <p className="text-xs text-zinc-500 font-medium">Logged in as</p>
                  <p className="text-sm font-semibold truncate text-zinc-300" title={session.user.email}>
                    {session.user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900/50 border border-zinc-900 py-2.5 text-sm font-medium text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition duration-200 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Full-width Main Area */}
        <SidebarInset className="flex-1 flex flex-col bg-transparent overflow-hidden">
          {/* Top Navbar */}
          <header className="p-6 border-b border-zinc-900 flex items-center justify-between gap-4 bg-zinc-950/20 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-4 flex-1">
              <SidebarTrigger className="text-zinc-400 hover:text-zinc-200 transition" />
              
              {/* Checkbox multi-select header controls */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs font-semibold hover:bg-rose-500 hover:text-white transition duration-200"
                    title="Delete selected emails"
                  >
                    <Trash2 className="size-3.5" />
                    Delete ({selectedIds.size})
                  </button>
                </div>
              )}

              <div className="relative flex-1 max-w-lg">
                <input
                  type="text"
                  placeholder="Search mails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-zinc-900 bg-zinc-950/80 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-[#EFCE8A]/50 focus:ring-1 focus:ring-[#EFCE8A]/50 transition duration-200"
                />
                <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-900 bg-zinc-950/80 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition duration-200 disabled:opacity-50"
              title="Refresh emails"
            >
              <RefreshCw className={`h-4.5 w-4.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </header>

          {/* Mail List Area */}
          <div
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto custom-scrollbar custom-scrollbar-container bg-zinc-950/10"
          >
            <div className="w-full flex flex-col">
              {filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-zinc-500 border-b border-zinc-900/50 bg-zinc-900/5">
                  <Mail className="h-10 w-10 stroke-[1.2] mb-3 text-zinc-600 animate-pulse" />
                  <h3 className="text-base font-semibold text-zinc-400">No emails here</h3>
                  <p className="text-xs text-zinc-500 mt-1">Waiting for incoming messages to arrive...</p>
                </div>
              ) : (
                filteredEmails.map((email, idx) => {
                  const isLast = idx === filteredEmails.length - 1;
                  return (
                    <div
                      key={email.id}
                      ref={isLast ? lastElementRef : null}
                      onClick={() => router.push(`/email/${email.id}`)}
                      className={`group flex items-center gap-4 px-6 py-3.5 border-b border-zinc-900/50 hover:bg-zinc-900/30 transition duration-150 select-none cursor-pointer ${
                        !email.isRead 
                          ? "bg-zinc-900/60 font-bold border-l-2 border-[#EFCE8A]" 
                          : "bg-transparent border-l-2 border-transparent"
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(email.id)) {
                                next.delete(email.id);
                              } else {
                                next.add(email.id);
                              }
                              return next;
                            });
                          }}
                          className={`size-4 rounded border transition duration-150 flex items-center justify-center cursor-pointer ${
                            selectedIds.has(email.id)
                              ? "bg-[#EFCE8A] border-[#EFCE8A] text-zinc-950"
                              : "bg-zinc-900 border-zinc-800 hover:border-[#EFCE8A]/50 text-transparent"
                          }`}
                          title="Select email"
                        >
                          <Check className="size-3 stroke-[3]" />
                        </button>
                      </div>

                      {/* Star icon */}
                      <div className="shrink-0">
                        <button
                          onClick={(e) => toggleStar(e, email)}
                          className={`text-zinc-500 hover:text-amber-400 transition duration-150 ${
                            email.isStarred ? "text-amber-400" : ""
                          }`}
                          title={email.isStarred ? "Unstar" : "Star"}
                        >
                          <Star className="h-4.5 w-4.5 fill-current" />
                        </button>
                      </div>

                      {/* Sender name column */}
                      <div className="w-48 shrink-0 overflow-hidden truncate">
                        <span className={`text-sm ${!email.isRead ? "font-bold text-zinc-100" : "text-zinc-400 font-medium"}`}>
                          {email.fromName || email.fromAddress}
                        </span>
                      </div>

                      {/* Subject + Body snippet preview */}
                      <div className="flex-1 min-w-0 overflow-hidden truncate flex items-center">
                        <span className={`text-sm tracking-tight shrink-0 ${!email.isRead ? "font-semibold text-zinc-200" : "text-zinc-300"}`}>
                          {email.subject}
                        </span>
                        <span className="text-sm text-zinc-700 mx-2 shrink-0">—</span>
                        <span className="text-sm text-zinc-500 truncate leading-relaxed">
                          {email.bodyText || "No preview text"}
                        </span>
                      </div>

                      {/* Row Action Toolbar on Hover */}
                      <div className="hidden group-hover:flex items-center gap-2 px-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => toggleRead(e, email)}
                          className="text-zinc-500 hover:text-[#EFCE8A] transition duration-150 p-1"
                          title={email.isRead ? "Mark as unread" : "Mark as read"}
                        >
                          {email.isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={(e) => softDeleteEmail(e, email)}
                          className="text-zinc-500 hover:text-rose-400 transition duration-150 p-1"
                          title="Delete email"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>

                      {/* Date Column */}
                      <div className="w-16 shrink-0 text-right group-hover:hidden">
                        <span className="text-xs text-zinc-500 font-medium">
                          {new Date(email.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      <div className="shrink-0 hidden group-hover:block pl-2">
                        <ChevronRight className="h-4 w-4 text-zinc-600" />
                      </div>
                    </div>
                  );
                })
              )}

              {loading && (
                <div className="p-4 text-center border-t border-zinc-900/50">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-zinc-500" />
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
