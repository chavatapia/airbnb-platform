import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAirbnbEmail } from "@/lib/gmail-parser";
import { getAirbnbEmails, extractEmailBody } from "@/lib/gmail";

// POST /api/sync/gmail
// Import reservations from Gmail (Airbnb confirmation emails)
// Protected by CRON_SECRET header

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get Airbnb emails from Gmail
    const emails = await getAirbnbEmails(
      "from:noreply@airbnb.com is:unread OR from:noreply@airbnb.com newer_than:30d"
    );

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const results: string[] = [];

    for (const email of emails) {
      try {
        // Extract email body
        const { subject, plaintext, html } = extractEmailBody(email.payload);

        // Parse the email
        const parsed = parseAirbnbEmail(subject, plaintext, html);
        if (!parsed) {
          skipped++;
          continue;
        }

        // Find property by name
        const property = await prisma.property.findFirst({
          where: {
            OR: [
              { name: { contains: parsed.propertyName } },
              { shortName: { contains: parsed.propertyName.split(" ")[0] } },
            ],
          },
        });

        if (!property) {
          errors.push(`No property found for: ${parsed.propertyName}`);
          skipped++;
          continue;
        }

        // Try to find existing reservation by confirmation code
        const existing = await prisma.reservation.findFirst({
          where: {
            confirmationCode: parsed.confirmationCode,
            propertyId: property.id,
          },
        });

        if (existing) {
          // Update if data differs
          if (
            existing.guestName !== parsed.guestName ||
            existing.checkin.getTime() !== parsed.checkin.getTime() ||
            existing.checkout.getTime() !== parsed.checkout.getTime() ||
            existing.status !== parsed.status
          ) {
            await prisma.reservation.update({
              where: { id: existing.id },
              data: {
                guestName: parsed.guestName,
                checkin: parsed.checkin,
                checkout: parsed.checkout,
                status: parsed.status,
                syncedAt: new Date(),
              },
            });
            updated++;
            results.push(
              `Updated: ${parsed.confirmationCode} (${parsed.guestName})`
            );
          } else {
            skipped++;
          }
        } else {
          // Create new reservation
          await prisma.reservation.create({
            data: {
              propertyId: property.id,
              confirmationCode: parsed.confirmationCode,
              guestName: parsed.guestName,
              checkin: parsed.checkin,
              checkout: parsed.checkout,
              status: parsed.status,
              currency: property.currency,
              source: "gmail",
              syncedAt: new Date(),
              externalId: `gmail-${parsed.confirmationCode}`,
            },
          });
          imported++;
          results.push(
            `Created: ${parsed.confirmationCode} (${parsed.guestName})`
          );
        }
      } catch (err) {
        errors.push(
          `Error processing email: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Log sync results
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

    // Log error
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
