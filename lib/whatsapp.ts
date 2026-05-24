import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = process.env.TWILIO_WHATSAPP_FROM!;

const GROUP_IDS: Record<string, string | undefined> = {
  MEXICO: process.env.WHATSAPP_GROUP_MEXICO,
  NORWAY: process.env.WHATSAPP_GROUP_NORWAY,
};

export async function sendWhatsAppToGroup(
  region: "MEXICO" | "NORWAY",
  message: string
) {
  const to = GROUP_IDS[region];
  if (!to) {
    console.warn(`WhatsApp group not configured for region: ${region}`);
    return;
  }

  await client.messages.create({
    from: FROM,
    to,
    body: message,
  });
}

export function buildNewReservationMessage({
  propertyName,
  guestName,
  checkinDate,
  checkoutDate,
  confirmationCode,
  suggestedMessage,
  region,
}: {
  propertyName: string;
  guestName?: string | null;
  checkinDate: Date;
  checkoutDate: Date;
  confirmationCode?: string | null;
  suggestedMessage: string;
  region: "MEXICO" | "NORWAY";
}): string {
  const locale = region === "MEXICO" ? "es-MX" : "nb-NO";
  const formatDate = (d: Date) =>
    d.toLocaleDateString(locale, { day: "numeric", month: "short" });

  const airbnbLink = confirmationCode
    ? `https://www.airbnb.com/hosting/reservations/details/${confirmationCode}`
    : null;

  const lines = [
    `🏠 *Nueva reserva — ${propertyName}*`,
    guestName ? `👤 Huesped: ${guestName}` : "👤 Huesped: (pendiente)",
    `📅 Check-in: ${formatDate(checkinDate)} | Check-out: ${formatDate(checkoutDate)}`,
    "",
    `🤖 *Mensaje sugerido (bienvenida):*`,
    `"${suggestedMessage.slice(0, 280)}${suggestedMessage.length > 280 ? "..." : ""}"`,
  ];

  if (airbnbLink) {
    lines.push("", `🔗 Abrir en Airbnb: ${airbnbLink}`);
  }

  return lines.join("\n");
}
