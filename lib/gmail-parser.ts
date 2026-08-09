// Parser para extraer datos de reservaciones desde emails de Airbnb
//
// Los patrones aquí fueron derivados de emails reales de confirmación de
// Airbnb (formato "Reservation confirmed - NAME arrives DATE"), no de la
// documentación pública de Airbnb (no existe). Si Airbnb cambia su
// plantilla de correo, este parser puede requerir ajustes.

import { CONFIRMATION_CODE_REGEX } from "@/lib/ical";

// Must match Prisma's ReservationStatus enum (see prisma/schema.prisma)
export interface ParsedEmailReservation {
  confirmationCode: string;
  guestName: string;
  propertyName: string;
  checkin: Date;
  checkout: Date;
  status: "CONFIRMED" | "CANCELLED";
}

const MONTHS: Record<string, number> = {
  jan: 0, ene: 0,
  feb: 1,
  mar: 2,
  apr: 3, abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7, ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11, dic: 11,
};

function normalizeMonthKey(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 3)
    .toLowerCase();
}

// Extracts a { month, day } pair from a date fragment lacking a year, in
// either "Mon D" (English: "Aug 8") or "D de Mon" (Spanish: "8 de agosto")
// form.
function extractMonthDay(token: string): { month: number; day: number } | null {
  let m = token.match(/([A-Za-zÁÉÍÓÚÑáéíóúñ]{3,})\.?\s+(\d{1,2})/);
  if (m) {
    const month = MONTHS[normalizeMonthKey(m[1])];
    if (month !== undefined) return { month, day: parseInt(m[2], 10) };
  }
  m = token.match(/(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]{3,})/i);
  if (m) {
    const month = MONTHS[normalizeMonthKey(m[2])];
    if (month !== undefined) return { month, day: parseInt(m[1], 10) };
  }
  return null;
}

// Airbnb's confirmation emails never include a year for check-in/checkout.
// Infer it from the email's own received date: if the resulting date would
// fall more than ~150 days before that reference, it must refer to next
// year (e.g. an email sent in December about a January stay).
function resolveDateWithYear(monthDayToken: string, referenceDate: Date): Date | null {
  const parsed = extractMonthDay(monthDayToken);
  if (!parsed) return null;

  const refYear = referenceDate.getUTCFullYear();
  let date = new Date(Date.UTC(refYear, parsed.month, parsed.day));

  const diffDays = (referenceDate.getTime() - date.getTime()) / 86_400_000;
  if (diffDays > 150) {
    date = new Date(Date.UTC(refYear + 1, parsed.month, parsed.day));
  }

  return date;
}

const DATE_TOKEN_REGEX =
  /(\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}\.?)|([A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}\.?\s+\d{1,2})/g;

// Airbnb renders check-in/checkout dates in two different layouts
// depending on the source: the plaintext body groups both labels first,
// then both dates on the following line ("Check-in Checkout\n\nSat, Aug 8
// Sun, Aug 9"), while the HTML (once tags are stripped to text) interleaves
// each label with its own date and time ("Check-in\n\nSat, Aug 8\n\n9:00
// PM\n\nCheckout\n\nSun, Aug 9\n\n11:00 AM"). Distinguish the two by
// checking whether a digit (part of a date/time) already appears between
// the two labels — if not, they're the grouped header.
function findCheckinCheckoutTokens(text: string): [string, string] | null {
  const checkoutMatch = text.match(/Check-?out\b/i);
  if (!checkoutMatch || checkoutMatch.index === undefined) return null;

  // Airbnb emails often mention "check-in" informally elsewhere in the body
  // ("confirm check-in details or welcome ..."), which isn't the itinerary
  // label. The itinerary's "Check-in" is always the occurrence immediately
  // preceding "Checkout", so take the last match before it, not the first
  // match in the whole text.
  const checkinRegex = /Check-?in\b/gi;
  let checkinMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = checkinRegex.exec(text)) !== null) {
    if (match.index >= checkoutMatch.index) break;
    checkinMatch = match;
  }
  if (!checkinMatch || checkinMatch.index === undefined) return null;

  const checkinEnd = checkinMatch.index + checkinMatch[0].length;
  const between = text.slice(checkinEnd, checkoutMatch.index);
  const afterCheckout = checkoutMatch.index + checkoutMatch[0].length;

  if (!/\d/.test(between) && between.length < 40) {
    // Grouped layout: both date tokens follow the combined header.
    const window = text.slice(afterCheckout, afterCheckout + 150);
    const matches = [...window.matchAll(DATE_TOKEN_REGEX)].map((m) => m[0]);
    if (matches.length < 2) return null;
    return [matches[0], matches[1]];
  }

  // Interleaved layout: each label has its own date immediately after it.
  const checkinToken = between.match(DATE_TOKEN_REGEX);
  if (!checkinToken) return null;

  const checkoutWindow = text.slice(afterCheckout, afterCheckout + 150);
  const checkoutToken = checkoutWindow.match(DATE_TOKEN_REGEX);
  if (!checkoutToken) return null;

  return [checkinToken[0], checkoutToken[0]];
}

function extractGuestNameFromSubject(subject: string): string | null {
  const patterns = [
    /Reservation confirmed\s*-\s*(.+?)\s+arrives/i,
    /New booking confirmed!?\s*(.+?)\s+arrives/i,
    /Reserva confirmada\s*-\s*(.+?)\s+llega/i,
    /Reservation cancell?ed\s*-\s*(.+?)(?:'s| arrives|$)/i,
  ];
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

const LISTING_TYPE_REGEX = /Entire home\/apt|Private room|Shared room|Hotel room/i;

// The property title is always the line immediately before the listing
// type ("Entire home/apt", etc.). In Airbnb's plaintext body it also
// follows a "/rooms/<id>" link right before that; HTML-stripped-to-text
// output drops the link (it's inside an href, not visible text), so fall
// back to just the line before the listing type.
function extractPropertyNameFromBody(text: string): string | null {
  const withRoomsLink = text.match(
    /\/rooms\/\d+[^\n]*\n+\s*([^\n]+?)\s*\n+\s*(?:Entire home\/apt|Private room|Shared room|Hotel room)/i
  );
  if (withRoomsLink) return withRoomsLink[1].trim();

  const typeMatch = text.match(LISTING_TYPE_REGEX);
  if (!typeMatch || typeMatch.index === undefined) return null;

  const before = text.slice(0, typeMatch.index).trimEnd();
  const lastLine = before.split("\n").pop();
  return lastLine ? lastLine.trim() : null;
}

function extractConfirmationCodeFromText(text: string): string | null {
  const match = text.match(CONFIRMATION_CODE_REGEX);
  return match ? match[1].toUpperCase() : null;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n");
}

export function parseAirbnbEmail(
  subject: string,
  plaintext: string,
  html?: string,
  receivedAt: Date = new Date()
): ParsedEmailReservation | null {
  try {
    const bodyText = plaintext?.trim() ? plaintext : html ? stripHtmlToText(html) : "";
    if (!bodyText) return null;

    if (
      !subject.toLowerCase().includes("airbnb") &&
      !bodyText.toLowerCase().includes("airbnb")
    ) {
      return null;
    }

    const confirmationCode = extractConfirmationCodeFromText(bodyText) ?? extractConfirmationCodeFromText(subject);
    if (!confirmationCode) return null;

    const dateTokens = findCheckinCheckoutTokens(bodyText);
    if (!dateTokens) return null;

    const checkin = resolveDateWithYear(dateTokens[0], receivedAt);
    const checkout = resolveDateWithYear(dateTokens[1], receivedAt);
    if (!checkin || !checkout) return null;

    const guestName = extractGuestNameFromSubject(subject) ?? "Guest";
    const propertyName = extractPropertyNameFromBody(bodyText) ?? "Unknown";

    const isCancellation = /cancell?ed|cancelad/i.test(subject);

    return {
      confirmationCode,
      guestName,
      propertyName,
      checkin,
      checkout,
      status: isCancellation ? "CANCELLED" : "CONFIRMED",
    };
  } catch (error) {
    console.error("[gmail-parser] Error parsing email:", error);
    return null;
  }
}
