import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { email as emailTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
    isRead: z.boolean().optional(),
    isStarred: z.boolean().optional(),
}).refine(data => data.isRead !== undefined || data.isStarred !== undefined, {
    message: "At least one of isRead or isStarred must be provided",
});

// GET /api/emails/[id] - Fetch details of a single email
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    try {
        const email = await db.query.email.findFirst({
            where: eq(emailTable.id, id),
        });

        if (!email) {
            return NextResponse.json({ error: "Email not found" }, { status: 404 });
        }

        return NextResponse.json({ email });
    } catch (error) {
        console.error("Failed to fetch email:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// PATCH /api/emails/[id] - Update email status (read/starred)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    try {
        const body = await request.json();
        const validation = patchSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid payload", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { isRead, isStarred } = validation.data;
        const updateData: Record<string, any> = {};

        if (isRead !== undefined) updateData.isRead = isRead;
        if (isStarred !== undefined) updateData.isStarred = isStarred;

        const updated = await db
            .update(emailTable)
            .set(updateData)
            .where(eq(emailTable.id, id))
            .returning();

        if (updated.length === 0) {
            return NextResponse.json({ error: "Email not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, email: updated[0] });
  } catch (error) {
    console.error("Failed to update email status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/emails/[id] - Soft delete an email
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  try {
    const updated = await db
      .update(emailTable)
      .set({ deletedAt: new Date() })
      .where(eq(emailTable.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, email: updated[0] });
  } catch (error) {
    console.error("Failed to soft-delete email:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
