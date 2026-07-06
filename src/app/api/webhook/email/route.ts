import { NextResponse } from "next/server";
import { db } from "@/db";
import { email as emailTable } from "@/db/schema";
import PostalMime from "postal-mime";
import crypto from "crypto";
import { z } from "zod";

const webhookSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  recipients: z.array(z.string()).optional(),
  raw: z.string().min(1, "Raw email content is required"),
});

export async function POST(request: Request) {
  const signature = request.headers.get("x-webhook-secret");
  if (signature !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = webhookSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { from, to, raw } = validation.data;

    // Parse the raw email RFC822 string
    const parser = new PostalMime();
    const parsedEmail = await parser.parse(raw);

    const emailId = crypto.randomUUID();

    // Store the email content once in the database
    await db.insert(emailTable).values({
      id: emailId,
      fromAddress: from || parsedEmail.from?.address || "unknown@unknown.com",
      fromName: parsedEmail.from?.name || null,
      toAddress: to || parsedEmail.to?.[0]?.address || "unknown@unknown.com",
      subject: parsedEmail.subject || "(No Subject)",
      bodyText: parsedEmail.text || null,
      bodyHtml: parsedEmail.html || null,
      isRead: false,
      isStarred: false,
    });

    return NextResponse.json({ success: true, id: emailId });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
