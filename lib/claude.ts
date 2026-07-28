import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface HostReplyParams {
  question: string;
  properties: Array<{
    name: string;
    region: string;
    instructions?: string | null;
    amenities?: string | null;
    rules?: string | null;
  }>;
  reservations: Array<{
    guestName: string | null;
    checkin: Date;
    checkout: Date;
    confirmationCode: string | null;
    property: { name: string };
  }>;
  now: Date;
}

export async function generateHostReply({
  question,
  properties,
  reservations,
  now,
}: HostReplyParams): Promise<string> {
  const dateStr = now.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const reservationContext = reservations
    .map((r) => {
      const checkin = r.checkin.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
      const checkout = r.checkout.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
      const estado =
        r.checkin <= now && r.checkout >= now
          ? "ACTIVA"
          : r.checkin > now
          ? "PROXIMA"
          : "PASADA";
      return `- ${r.property.name}: ${r.guestName ?? "Reserved"} | ${checkin} → ${checkout} [${estado}]${r.confirmationCode ? ` | ${r.confirmationCode}` : ""}`;
    })
    .join("\n");

  const propertyContext = properties
    .map((p) => {
      const parts = [`${p.name} (${p.region})`];
      if (p.instructions) parts.push(`Acceso: ${p.instructions}`);
      if (p.amenities) parts.push(`Amenidades: ${p.amenities}`);
      if (p.rules) parts.push(`Reglas: ${p.rules}`);
      return parts.join(" | ");
    })
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `Eres el asistente personal de un anfitrion de Airbnb con propiedades en Mexico y Noruega.
Respondes preguntas sobre sus reservas, propiedades y huespedes de forma concisa y util.
Hoy es ${dateStr}.
Responde en espanol, de forma corta y directa (maximo 3-4 lineas). Sin saludos ni despedidas.`,
    messages: [
      {
        role: "user",
        content: `Propiedades:\n${propertyContext || "Sin propiedades registradas"}\n\nReservas:\n${reservationContext || "Sin reservas"}\n\nPregunta: ${question}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");
  return content.text;
}

export type MessageType = "welcome" | "checkin" | "checkout" | "faq" | "special";

interface GenerateMessageParams {
  messageType: MessageType;
  propertyName: string;
  propertyInstructions?: string | null;
  propertyAmenities?: string | null;
  propertyRules?: string | null;
  region: "MEXICO" | "NORWAY";
  guestName?: string | null;
  checkinDate?: Date | null;
  checkoutDate?: Date | null;
  customPrompt?: string;
  guestMessage?: string;
}

const MESSAGE_TEMPLATES: Record<MessageType, string> = {
  welcome: "mensaje de bienvenida inicial para un huesped que acaba de reservar",
  checkin: "mensaje de instrucciones de check-in con todos los detalles de acceso",
  checkout: "mensaje amable de despedida y solicitud de resena al momento del check-out",
  faq: "respuesta a preguntas frecuentes sobre la propiedad",
  special: "mensaje personalizado segun las instrucciones especificas",
};

export async function generateGuestMessage({
  messageType,
  propertyName,
  propertyInstructions,
  propertyAmenities,
  propertyRules,
  region,
  guestName,
  checkinDate,
  checkoutDate,
  customPrompt,
  guestMessage,
}: GenerateMessageParams): Promise<string> {
  const language = region === "MEXICO" ? "espanol" : "ingles";

  const systemPrompt = `Eres un asistente experto en hospitalidad para propiedades de Airbnb.
Generas mensajes para huespedes que son calidoss, profesionales y personalizados.
El idioma de respuesta DEBE ser ${language}.
Usa un tono amigable y profesional. Se conciso pero completo.
NO incluyas saludos genericos ni frases de relleno.`;

  const propertyContext = [
    `Propiedad: ${propertyName}`,
    propertyInstructions ? `Instrucciones/acceso: ${propertyInstructions}` : null,
    propertyAmenities ? `Amenidades: ${propertyAmenities}` : null,
    propertyRules ? `Reglas de la casa: ${propertyRules}` : null,
    guestName ? `Nombre del huesped: ${guestName}` : null,
    checkinDate
      ? `Fecha de check-in: ${checkinDate.toLocaleDateString(region === "MEXICO" ? "es-MX" : "nb-NO")}`
      : null,
    checkoutDate
      ? `Fecha de check-out: ${checkoutDate.toLocaleDateString(region === "MEXICO" ? "es-MX" : "nb-NO")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const effectivePrompt = guestMessage
    ? `El huesped envio este mensaje: "${guestMessage}"\n\nGenera una respuesta precisa y util usando la informacion de la propiedad.`
    : customPrompt;

  const userPrompt = effectivePrompt
    ? `${effectivePrompt}\n\nContexto de la propiedad:\n${propertyContext}`
    : `Genera un ${MESSAGE_TEMPLATES[messageType]}.\n\nContexto de la propiedad:\n${propertyContext}`;

  // Use prompt caching for the system prompt + property instructions (stable content)
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return content.text;
}
