import { prisma } from "@/lib/prisma";
import type { ParsedEmailReservation } from "@/lib/gmail-parser";

export type ReservationSyncAction = "created" | "updated" | "skipped" | "error";

export interface ReservationSyncResult {
  action: ReservationSyncAction;
  message?: string;
}

// Shared by the Gmail sync cron and the Airbnb email webhook — both parse
// a reservation confirmation email into ParsedEmailReservation and need
// the same find-property / create-or-update-reservation logic.
export async function upsertReservationFromParsedEmail(
  parsed: ParsedEmailReservation,
  source: string
): Promise<ReservationSyncResult> {
  const property = await prisma.property.findFirst({
    where: {
      OR: [
        { name: { contains: parsed.propertyName, mode: "insensitive" } },
        {
          shortName: {
            contains: parsed.propertyName.split(" ")[0],
            mode: "insensitive",
          },
        },
      ],
    },
  });

  if (!property) {
    return { action: "error", message: `No property found for: ${parsed.propertyName}` };
  }

  const existing = await prisma.reservation.findFirst({
    where: { confirmationCode: parsed.confirmationCode, propertyId: property.id },
  });

  if (existing) {
    const changed =
      existing.guestName !== parsed.guestName ||
      existing.checkin.getTime() !== parsed.checkin.getTime() ||
      existing.checkout.getTime() !== parsed.checkout.getTime() ||
      existing.status !== parsed.status;

    if (!changed) return { action: "skipped" };

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
    return { action: "updated" };
  }

  await prisma.reservation.create({
    data: {
      propertyId: property.id,
      confirmationCode: parsed.confirmationCode,
      guestName: parsed.guestName,
      checkin: parsed.checkin,
      checkout: parsed.checkout,
      status: parsed.status,
      currency: property.currency,
      source,
      syncedAt: new Date(),
      externalId: `${source}-${parsed.confirmationCode}`,
    },
  });
  return { action: "created" };
}
