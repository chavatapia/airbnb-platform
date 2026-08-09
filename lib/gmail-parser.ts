// Parser para extraer datos de reservaciones desde emails de Airbnb

// Must match Prisma's ReservationStatus enum (see prisma/schema.prisma)
export interface ParsedEmailReservation {
  confirmationCode: string;
  guestName: string;
  propertyName: string;
  checkin: Date;
  checkout: Date;
  status: "CONFIRMED" | "CANCELLED";
}

// Regex patterns para extraer datos de emails de Airbnb
const PATTERNS = {
  confirmationCode: /([A-Z0-9]{10,12})/,
  checkinDate: /Check-in[:\s]+([A-Za-z]+\s+\d+,?\s+\d{4})/i,
  checkoutDate: /Check-out[:\s]+([A-Za-z]+\s+\d+,?\s+\d{4})/i,
  guestName: /(?:Guest|Huésped|Host)[:\s]+([A-Za-z\s]+?)(?:\n|<|·)/i,
  propertyNameHtml: /Property[:\s]+<[^>]*>([^<]+)</i,
  propertyName: /(?:at|en|en tu)\s+([^(\n]+?)(?:\(|,|\n|$)/i,
};

export function parseAirbnbEmail(
  subject: string,
  plaintext: string,
  html?: string
): ParsedEmailReservation | null {
  try {
    // Verificar que es un email de Airbnb
    if (
      !subject.toLowerCase().includes("airbnb") &&
      !plaintext.toLowerCase().includes("airbnb")
    ) {
      return null;
    }

    // Extraer confirmation code
    const codeMatch = plaintext.match(PATTERNS.confirmationCode);
    if (!codeMatch) return null;
    const confirmationCode = codeMatch[1];

    // Extraer fechas de check-in y check-out
    const checkinMatch = plaintext.match(PATTERNS.checkinDate);
    const checkoutMatch = plaintext.match(PATTERNS.checkoutDate);

    if (!checkinMatch || !checkoutMatch) return null;

    const checkin = parseDate(checkinMatch[1]);
    const checkout = parseDate(checkoutMatch[1]);

    if (!checkin || !checkout) return null;

    // Extraer nombre del huésped
    let guestName = "Guest";
    const guestMatch = plaintext.match(PATTERNS.guestName);
    if (guestMatch) {
      guestName = guestMatch[1].trim();
    }

    // Extraer nombre de la propiedad
    let propertyName = "Unknown";
    const propMatch =
      plaintext.match(PATTERNS.propertyName) || subject.match(PATTERNS.propertyName);
    if (propMatch) {
      propertyName = propMatch[1].trim();
    }

    // Determinar status (usualmente está en el asunto)
    const status = subject.toLowerCase().includes("cancelled")
      ? "CANCELLED"
      : "CONFIRMED";

    return {
      confirmationCode,
      guestName,
      propertyName,
      checkin,
      checkout,
      status,
    };
  } catch (error) {
    console.error("[gmail-parser] Error parsing email:", error);
    return null;
  }
}

function parseDate(dateStr: string): Date | null {
  try {
    // Soporta formatos como "August 5, 2026" o "5 de agosto de 2026"
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

// Función para extraer confirmation code de un email más agresivamente
export function extractConfirmationCode(text: string): string | null {
  // Buscar patrón HMxxxxxx (Airbnb standard)
  const match = text.match(/\bHM[A-Z0-9]{8}\b/);
  if (match) {
    return match[0];
  }

  // Fallback: buscar cualquier código de 10-12 caracteres alfanuméricos
  const fallback = text.match(/\b[A-Z0-9]{10,12}\b/);
  if (fallback) {
    return fallback[0];
  }

  return null;
}

// Función para extraer nombre de propiedad
export function extractPropertyName(text: string): string | null {
  // Buscar patrones comunes en emails de Airbnb
  const patterns = [
    /Your listing[:\s]+([^\n]+)/i,
    /Property[:\s]+([^\n]+)/i,
    /at\s+([^\n,]+)/i,
    /en\s+([^\n,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

// Función para extraer nombre del huésped
export function extractGuestName(text: string): string | null {
  const patterns = [
    /Guest[:\s]+([A-Za-z\s]+?)(?:\n|$)/i,
    /Huésped[:\s]+([A-Za-z\s]+?)(?:\n|$)/i,
    /Name[:\s]+([A-Za-z\s]+?)(?:\n|$)/i,
    /(?:from|de)\s+([A-Za-z\s]+?)(?:\n|says|dice)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

// Función para extraer fechas
export function extractDates(
  text: string
): { checkin: Date | null; checkout: Date | null } {
  const checkinMatch = text.match(
    /Check-in[:\s]+([A-Za-z]+\s+\d+,?\s+\d{4}|del?\s+\d+\s+de\s+[A-Za-z]+\s+de\s+\d{4})/i
  );
  const checkoutMatch = text.match(
    /Check-out[:\s]+([A-Za-z]+\s+\d+,?\s+\d{4}|del?\s+\d+\s+de\s+[A-Za-z]+\s+de\s+\d{4})/i
  );

  return {
    checkin: checkinMatch ? parseDate(checkinMatch[1]) : null,
    checkout: checkoutMatch ? parseDate(checkoutMatch[1]) : null,
  };
}
