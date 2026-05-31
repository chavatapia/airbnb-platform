import ical from "node-ical";
import type { Property } from "@prisma/client";

export interface ParsedReservation {
  externalId: string;
  confirmationCode: string | null;
  guestName: string | null;
  checkin: Date;
  checkout: Date;
  status: "CONFIRMED" | "BLOCKED";
  source: "ical";
}

// Airbnb confirmation code pattern: HMXXXXXXXX or similar
export const CONFIRMATION_CODE_REGEX = /\b(HM[A-Z0-9]{6,10})\b/i;

export async function parseIcalUrl(
  icalUrl: string
): Promise<ParsedReservation[]> {
  const events = await ical.async.fromURL(icalUrl);
  const reservations: ParsedReservation[] = [];

  for (const key in events) {
    const event = events[key];
    if (!event || event.type !== "VEVENT") continue;

    const start = event.start as Date;
    const end = event.end as Date;

    if (!start || !end) continue;

    // Airbnb sends all-day events — normalize to midnight UTC
    const checkin = new Date(start);
    const checkout = new Date(end);

    const uid = event.uid ?? key;
    const summary = (event.summary as string) ?? "";
    const description = (event.description as string) ?? "";

    // Determine if this is a real booking or just a blocked date
    const isBlocked =
      summary.toLowerCase().includes("not available") ||
      summary.toLowerCase().includes("blocked") ||
      summary.toLowerCase().includes("airbnb (not available)");

    // Try to extract confirmation code from UID or description
    let confirmationCode: string | null = null;
    const codeMatch =
      uid.match(CONFIRMATION_CODE_REGEX) ||
      description.match(CONFIRMATION_CODE_REGEX) ||
      summary.match(CONFIRMATION_CODE_REGEX);
    if (codeMatch) {
      confirmationCode = codeMatch[1].toUpperCase();
    }

    // Try to extract guest name from summary (Airbnb format: "Guest Name (HMXXXXXX)")
    let guestName: string | null = null;
    if (!isBlocked && summary) {
      const nameMatch = summary.match(/^(.+?)\s*(?:\(HM[A-Z0-9]+\))?$/i);
      if (nameMatch && !summary.toLowerCase().startsWith("airbnb")) {
        guestName = nameMatch[1].trim();
      }
    }

    reservations.push({
      externalId: uid,
      confirmationCode,
      guestName,
      checkin,
      checkout,
      status: isBlocked ? "BLOCKED" : "CONFIRMED",
      source: "ical",
    });
  }

  return reservations;
}

export function buildAirbnbReservationLink(confirmationCode: string): string {
  return `https://www.airbnb.com/hosting/reservations/details/${confirmationCode}`;
}
