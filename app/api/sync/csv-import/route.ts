import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parse } from "csv-parse/sync";

// POST /api/sync/csv-import
// Import reservations from CSV file
// Body: { csv: "CSV content" }

interface CSVRow {
  Propiedad: string;
  Huesped: string;
  Listing: string;
  Check_in: string;
  Check_out: string;
  Noches: string;
  Moneda: string;
  Monto: string;
  Codigo: string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const csvContent = body.csv as string;

    if (!csvContent) {
      return NextResponse.json({ error: "CSV content required" }, { status: 400 });
    }

    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as CSVRow[];

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of records) {
      try {
        const confirmationCode = row.Codigo?.trim();
        const guestName = row.Huesped?.trim() || null;
        const listing = row.Listing?.trim();
        const checkin = new Date(row.Check_in);
        const checkout = new Date(row.Check_out);
        const monto = parseFloat(row.Monto) || 0;

        if (!confirmationCode || !listing || !guestName) {
          skipped++;
          continue;
        }

        // Find property by listing name (loose match)
        const property = await prisma.property.findFirst({
          where: {
            OR: [
              { name: { contains: listing.split(" ")[0] } },
              { shortName: { contains: listing.split(" ")[0] } },
            ],
          },
        });

        if (!property) {
          errors.push(`No property found for listing: ${listing}`);
          skipped++;
          continue;
        }

        // Try to find existing reservation by confirmation code
        const existing = await prisma.reservation.findFirst({
          where: {
            confirmationCode: confirmationCode,
            propertyId: property.id,
          },
        });

        if (existing) {
          // Update if data differs
          if (
            existing.guestName !== guestName ||
            existing.checkin.getTime() !== checkin.getTime() ||
            existing.checkout.getTime() !== checkout.getTime() ||
            existing.amount?.toNumber() !== monto
          ) {
            await prisma.reservation.update({
              where: { id: existing.id },
              data: {
                guestName,
                checkin,
                checkout,
                status: "CONFIRMED",
                currency: property.currency,
                amount: monto,
                syncedAt: new Date(),
              },
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Create new reservation
          await prisma.reservation.create({
            data: {
              propertyId: property.id,
              confirmationCode,
              guestName,
              checkin,
              checkout,
              status: "CONFIRMED",
              currency: property.currency,
              amount: monto,
              source: "csv_import",
              syncedAt: new Date(),
              // Generate external ID based on confirmation code
              externalId: `csv-${confirmationCode}`,
            },
          });
          imported++;
        }
      } catch (err) {
        errors.push(
          `Error processing row: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return NextResponse.json({
      imported,
      updated,
      skipped,
      total: records.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("[csv-import] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
