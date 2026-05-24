import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseIcalUrl } from "@/lib/ical";

// This endpoint is called by Vercel Cron every 30 minutes
// Protected by CRON_SECRET header
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const properties = await prisma.property.findMany({
    where: { active: true, icalUrl: { not: null } },
  });

  const results = [];

  for (const property of properties) {
    const startedAt = Date.now();
    try {
      const reservations = await parseIcalUrl(property.icalUrl!);
      let created = 0;
      let updated = 0;

      for (const res of reservations) {
        const existing = await prisma.reservation.findUnique({
          where: {
            propertyId_externalId: {
              propertyId: property.id,
              externalId: res.externalId,
            },
          },
        });

        if (!existing) {
          await prisma.reservation.create({
            data: {
              propertyId: property.id,
              externalId: res.externalId,
              confirmationCode: res.confirmationCode,
              guestName: res.guestName,
              checkin: res.checkin,
              checkout: res.checkout,
              status: res.status,
              currency: property.currency,
              source: "ical",
              syncedAt: new Date(),
            },
          });
          created++;

          // Auto-create cleaning task if checkout is within 48h from now
          const hoursUntilCheckout =
            (res.checkout.getTime() - Date.now()) / (1000 * 60 * 60);

          if (
            res.status === "CONFIRMED" &&
            hoursUntilCheckout > 0 &&
            hoursUntilCheckout <= 48
          ) {
            await createCleaningTask(property.id, res.checkout);
          }
        } else {
          // Update if dates changed (e.g. modification)
          if (
            existing.checkin.getTime() !== res.checkin.getTime() ||
            existing.checkout.getTime() !== res.checkout.getTime() ||
            existing.status !== res.status
          ) {
            await prisma.reservation.update({
              where: { id: existing.id },
              data: {
                checkin: res.checkin,
                checkout: res.checkout,
                status: res.status,
                guestName: res.guestName ?? existing.guestName,
                confirmationCode: res.confirmationCode ?? existing.confirmationCode,
                syncedAt: new Date(),
              },
            });

            updated++;
          }
        }
      }

      // Detect cancellations: reservations in DB not in iCal feed anymore
      const externalIds = reservations.map((r) => r.externalId);
      const cancelledCount = await prisma.reservation.updateMany({
        where: {
          propertyId: property.id,
          externalId: { notIn: externalIds },
          status: { in: ["CONFIRMED", "PENDING_DATA"] },
          source: "ical",
        },
        data: { status: "CANCELLED" },
      });

      await prisma.property.update({
        where: { id: property.id },
        data: { lastIcalSync: new Date() },
      });

      await prisma.syncLog.create({
        data: {
          type: "ical",
          propertyId: property.id,
          status: "success",
          recordCount: reservations.length,
          details: `created: ${created}, updated: ${updated}, cancelled: ${cancelledCount.count}`,
        },
      });

      results.push({ property: property.name, status: "ok", created, updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.syncLog.create({
        data: {
          type: "ical",
          propertyId: property.id,
          status: "error",
          details: message,
        },
      });
      results.push({ property: property.name, status: "error", error: message });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}

async function createCleaningTask(propertyId: string, checkoutDate: Date) {
  // Find the latest reservation for this property with this checkout
  const reservation = await prisma.reservation.findFirst({
    where: { propertyId, checkout: checkoutDate, status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
  });

  if (!reservation) return;

  // Check if task already exists
  const existing = await prisma.cleaningTask.findFirst({
    where: { reservationId: reservation.id },
  });

  if (existing) return;

  // Find the cleaner assigned to this region
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  const cleaner = await prisma.user.findFirst({
    where: {
      role: "CLEANING",
      region: property?.region,
    },
  });

  await prisma.cleaningTask.create({
    data: {
      reservationId: reservation.id,
      propertyId,
      assignedTo: cleaner?.email ?? null,
      scheduledFor: checkoutDate,
      status: "PENDING",
    },
  });
}
