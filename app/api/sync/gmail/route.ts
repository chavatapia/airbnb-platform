import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAirbnbEmail } from "@/lib/gmail-parser";
import { getAirbnbEmails, extractEmailBody } from "@/lib/gmail";
import { upsertReservationFromParsedEmail } from "@/lib/reservation-sync";

// GET /api/sync/gmail
// Import reservations from Gmail (Airbnb confirmation emails), via OAuth.
// This is a fallback data source — the primary path is the SendGrid
// Inbound Parse webhook at /api/webhooks/airbnb-email, which the same
// personal Gmail account already forwards Airbnb mail to. Use this route
// only if that forwarding setup breaks or is unavailable.
// Protected by CRON_SECRET header. See docs/GMAIL_SETUP.md for OAuth setup.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get Airbnb emails from Gmail
    const emails = await getAirbnbEmails(
      "from:automated@airbnb.com OR from:noreply@airbnb.com newer_than:30d"
    );

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const results: string[] = [];

    for (const email of emails) {
      try {
        const { subject, plaintext, html, date } = extractEmailBody(email.payload);

        const parsed = parseAirbnbEmail(subject, plaintext, html, date);
        if (!parsed) {
          skipped++;
          continue;
        }

        const result = await upsertReservationFromParsedEmail(parsed, "gmail");

        if (result.action === "created") {
          imported++;
          results.push(`Created: ${parsed.confirmationCode} (${parsed.guestName})`);
        } else if (result.action === "updated") {
          updated++;
          results.push(`Updated: ${parsed.confirmationCode} (${parsed.guestName})`);
        } else if (result.action === "error") {
          errors.push(result.message ?? "Unknown error");
          skipped++;
        } else {
          skipped++;
        }
      } catch (err) {
        errors.push(
          `Error processing email: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    await prisma.syncLog.create({
      data: {
        type: "gmail",
        status: "success",
        recordCount: imported + updated,
        details: `imported: ${imported}, updated: ${updated}, skipped: ${skipped}`,
      },
    });

    return NextResponse.json({
      imported,
      updated,
      skipped,
      total: emails.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      results: results.slice(0, 20),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gmail-sync] Error:", error);

    try {
      await prisma.syncLog.create({
        data: {
          type: "gmail",
          status: "error",
          details: message,
        },
      });
    } catch (logError) {
      console.error("[gmail-sync] Failed to log error:", logError);
    }

    return NextResponse.json(
      { error: message, imported: 0, updated: 0, skipped: 0 },
      { status: 500 }
    );
  }
}
