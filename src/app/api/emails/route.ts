import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { email as emailTable } from "@/db/schema";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "user";
    if (userRole !== "admin") {
        return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "all"; // all | unread | starred
    const limit = Math.min(parseInt(searchParams.get("limit") || "15", 10), 50);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    try {
        const conditions = [isNull(emailTable.deletedAt)];

        if (tab === "unread") {
            conditions.push(eq(emailTable.isRead, false));
        } else if (tab === "starred") {
            conditions.push(eq(emailTable.isStarred, true));
        }

        const emails = await db
            .select({
                id: emailTable.id,
                fromAddress: emailTable.fromAddress,
                fromName: emailTable.fromName,
                toAddress: emailTable.toAddress,
                subject: emailTable.subject,
                bodyText: emailTable.bodyText,
                isRead: emailTable.isRead,
                isStarred: emailTable.isStarred,
                createdAt: emailTable.createdAt,
            })
            .from(emailTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(emailTable.createdAt))
            .limit(limit)
            .offset(offset);

        return NextResponse.json({ emails });
    } catch (error) {
        console.error("Failed to fetch emails:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// DELETE /api/emails - Bulk soft delete multiple emails
export async function DELETE(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role || "user";
    if (userRole !== "admin") {
        return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    try {
        const { ids } = await request.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Invalid or empty IDs list" }, { status: 400 });
        }

        const updated = await db
            .update(emailTable)
            .set({ deletedAt: new Date() })
            .where(inArray(emailTable.id, ids))
            .returning();

        return NextResponse.json({ success: true, count: updated.length });
    } catch (error) {
        console.error("Failed bulk soft delete:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
