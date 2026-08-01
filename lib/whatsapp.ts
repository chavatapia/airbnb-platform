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

const REGION_PHONES: Record<string, string[]> = {
  MEXICO: [
    process.env.WHATSAPP_PHONE_ME!,
    process.env.WHATSAPP_PHONE_PEPE!,
  ].filter(Boolean),
  NORWAY: [
    process.env.WHATSAPP_PHONE_ME!,
    process.env.WHATSAPP_PHONE_KRISTIN!,
  ].filter(Boolean),
};

export async function sendWhatsAppToPersons(
  region: "MEXICO" | "NORWAY",
  message: string
) {
  const phones = REGION_PHONES[region] ?? [];
  await Promise.all(
    phones.map((phone) =>
      client.messages.create({
        from: FROM,
        to: `whatsapp:${phone}`,
        body: message,
      })
    )
  );
}

export async function sendWhatsAppForProperty(
  property: { region: "MEXICO" | "NORWAY"; whatsappGroupId: string | null },
  message: string
) {
  if (property.whatsappGroupId) {
    await client.messages.create({
      from: FROM,
      to: `whatsapp:${property.whatsappGroupId}`,
      body: message,
    });
  } else {
    await sendWhatsAppToPersons(property.region, message);
  }
}

export async function sendWhatsAppToMe(message: string) {
  const me = process.env.WHATSAPP_PHONE_ME;
  if (!me) {
    console.warn("WHATSAPP_PHONE_ME not configured");
    return;
  }
  await client.messages.create({
    from: FROM,
    to: `whatsapp:${me}`,
    body: message,
  });
}

export function buildGuestMessage({
  propertyShortName,
  guestName,
  guestMessage,
  aiReply,
  threadUrl,
}: {
  propertyShortName: string;
  guestName: string | null;
  guestMessage: string;
  aiReply: string;
  threadUrl: string | null;
}): string {
  const header = guestName
    ? `*${propertyShortName}* · ${guestName}`
    : `*${propertyShortName}*`;

  const lines = [
    header,
    "",
    `💬 "${guestMessage}"`,
    "",
    `🤖 ${aiReply}`,
  ];

  if (threadUrl) {
    lines.push("", `🔗 ${threadUrl}`);
  }

  return lines.join("\n");
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
