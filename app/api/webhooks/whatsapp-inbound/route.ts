import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateHostReply } from "@/lib/claude";

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function twimlResponse(message: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = formData.get("From")?.toString() ?? "";
    const body = formData.get("Body")?.toString().trim() ?? "";

    if (!body) {
      return twimlResponse("No entendi tu mensaje. Escribe una pregunta sobre tus reservas o propiedades.");
    }

    // Only respond to the host's phone number
    const hostPhone = process.env.WHATSAPP_PHONE_ME?.replace(/\D/g, "");
    const fromDigits = from.replace(/\D/g, "");
    if (hostPhone && !fromDigits.endsWith(hostPhone.replace(/^\+/, ""))) {
      console.warn("[whatsapp-inbound] Message from unknown number:", from);
      return new NextResponse(null, { status: 200 });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [properties, reservations] = await Promise.all([
      prisma.property.findMany({
        where: { active: true },
        select: { name: true, shortName: true, address: true, region: true, instructions: true, amenities: true, rules: true },
      }),
      prisma.reservation.findMany({
        where: {
          status: "CONFIRMED",
          checkout: { gte: sevenDaysAgo },
          checkin: { lte: thirtyDaysAhead },
        },
        include: { property: { select: { name: true } } },
        orderBy: { checkin: "asc" },
      }),
    ]);

    const reply = await generateHostReply({ question: body, properties, reservations, now });

    return twimlResponse(reply);
  } catch (err) {
    console.error("[whatsapp-inbound] Error:", err);
    return twimlResponse("Hubo un error procesando tu pregunta. Intenta de nuevo.");
  }
}
