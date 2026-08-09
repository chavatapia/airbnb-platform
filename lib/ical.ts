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
    // Include location and URL fields if present (Airbnb may put data there)
    const location = (event.location as string) ?? "";
    const url = (event.url as string) ?? "";

    // Determine if this is a real booking or just a blocked date
    const isBlocked =
      summary.toLowerCase().includes("not available") ||
      summary.toLowerCase().includes("blocked") ||
      summary.toLowerCase().includes("airbnb (not available)");

    // Try to extract confirmation code from multiple sources
    // Check: UID (most reliable), description, summary, location, URL
    let confirmationCode: string | null = null;

    // UID often contains the confirmation code directly (format: something@airbnb.com or similar)
    // But also check for the code in the actual text fields
    const fieldsToCheck = [uid, description, summary, location, url];

    for (const field of fieldsToCheck) {
      const codeMatch = field.match(CONFIRMATION_CODE_REGEX);
      if (codeMatch) {
        confirmationCode = codeMatch[1].toUpperCase();
        break;
      }
    }

    // If confirmation code not found and it's not blocked, use UID as fallback
    // (sometimes Airbnb uses the booking ref as UID)
    if (!confirmationCode && !isBlocked) {
      const uidCode = uid.match(/([A-Z0-9]{8,12})/);
      if (uidCode) {
        confirmationCode = uidCode[1];
      }
    }

    // Try to extract guest name from summary (Airbnb format: "Guest Name" or "Guest Name (HMXXXXXX)")
    let guestName: string | null = null;
    if (!isBlocked && summary) {
      // Remove confirmation code and parentheses from summary to get guest name
      const cleanedSummary = summary
        .replace(/\s*\(HM[A-Z0-9]+\)\s*/gi, "")
        .replace(/airbnb\s*/gi, "")
        .trim();

      if (cleanedSummary && !cleanedSummary.toLowerCase().startsWith("not available")) {
        guestName = cleanedSummary;
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
