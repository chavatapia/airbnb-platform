import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAirbnbEmail } from "@/lib/airbnb-email";
import { generateGuestMessage } from "@/lib/claude";
import {
  buildGuestMessage,
  sendWhatsAppForProperty,
  sendWhatsAppToMe,
} from "@/lib/whatsapp";

// SendGrid Inbound Parse sends multipart/form-data
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const from = formData.get("from")?.toString() ?? "";
    const subject = formData.get("subject")?.toString() ?? "";
    const text = formData.get("text")?.toString() ?? "";
    const html = formData.get("html")?.toString() ?? "";

    if (!from.includes("@airbnb.com")) {
      return NextResponse.json({ ok: true, skipped: "not airbnb" });
    }

    const { guestName, guestMessage, confirmationCode, threadUrl } =
      parseAirbnbEmail(subject, text, html);

    if (!guestMessage) {
      return NextResponse.json({ ok: true, skipped: "no message extracted" });
    }

    // Find reservation by confirmation code first
    let reservation = confirmationCode
      ? await prisma.reservation.findFirst({
          where: { confirmationCode },
          include: { property: true },
        })
      : null;

    // Fallback: search by guest name
    if (!reservation && guestName) {
      const firstName = guestName.split(" ")[0];
      reservation = await prisma.reservation.findFirst({
        where: {
          guestName: { contains: firstName, mode: "insensitive" },
          status: "CONFIRMED",
          checkout: { gte: new Date() },
        },
        include: { property: true },
        orderBy: { checkin: "asc" },
      });
    }

    if (!reservation) {
      // Pre-booking inquiry — no reservation yet
      console.log("[airbnb-email webhook] No reservation — treating as inquiry", {
        confirmationCode,
        guestName,
      });

      const allProperties = await prisma.property.findMany({ where: { active: true } });
      const lowerSubject = subject.toLowerCase();
      const lowerText = text.toLowerCase();
      const matchedProperty =
        allProperties.find(
          (p) =>
            lowerSubject.includes(p.name.toLowerCase()) ||
            lowerText.includes(p.name.toLowerCase())
        ) ?? null;

      const aiReply = await generateGuestMessage({
        messageType: "special",
        guestMessage,
        propertyName: matchedProperty?.name ?? "Wayak Properties",
        propertyInstructions: matchedProperty?.instructions,
        propertyAmenities: matchedProperty?.amenities,
        propertyRules: matchedProperty?.rules,
        region: matchedProperty?.region ?? "MEXICO",
        guestName,
      });

      const shortName =
        matchedProperty?.shortName ?? matchedProperty?.name ?? "Airbnb";

      const whatsappMsg = buildGuestMessage({
        propertyShortName: shortName,
        guestName,
        guestMessage,
        aiReply,
        threadUrl,
      });

      if (matchedProperty) {
        await sendWhatsAppForProperty(matchedProperty, whatsappMsg);
      } else {
        await sendWhatsAppToMe(whatsappMsg);
      }

      return NextResponse.json({ ok: true, inquiry: true });
    }

    // Update guestName if iCal stored "Reserved"
    if (guestName && reservation.guestName === "Reserved") {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { guestName },
      });
      reservation = { ...reservation, guestName };
    }

    const { property } = reservation;

    const aiReply = await generateGuestMessage({
      messageType: "special",
      guestMessage,
      propertyName: property.name,
      propertyInstructions: property.instructions,
      propertyAmenities: property.amenities,
      propertyRules: property.rules,
      region: property.region,
      guestName: reservation.guestName,
      checkinDate: reservation.checkin,
      checkoutDate: reservation.checkout,
    });

    await prisma.message.create({
      data: {
        propertyId: property.id,
        reservationId: reservation.id,
        messageType: "guest_reply",
        content: aiReply,
        createdBy: "webhook",
      },
    });

    const shortName = property.shortName ?? property.name;

    const whatsappMessage = buildGuestMessage({
      propertyShortName: shortName,
      guestName: reservation.guestName,
      guestMessage,
      aiReply,
      threadUrl,
    });

    await sendWhatsAppForProperty(property, whatsappMessage);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[airbnb-email webhook] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
