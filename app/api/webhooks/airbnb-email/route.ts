import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAirbnbEmail } from "@/lib/airbnb-email";
import { generateGuestMessage } from "@/lib/claude";
import { buildAirbnbReservationLink } from "@/lib/ical";
import {
  buildGuestReplyMessage,
  sendWhatsAppToPersons,
} from "@/lib/whatsapp";

// SendGrid Inbound Parse sends multipart/form-data
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const from = formData.get("from")?.toString() ?? "";
    const subject = formData.get("subject")?.toString() ?? "";
    const text = formData.get("text")?.toString() ?? "";

    // Only process emails from Airbnb
    if (!from.includes("@airbnb.com")) {
      return NextResponse.json({ ok: true, skipped: "not airbnb" });
    }

    const { guestName, guestMessage, confirmationCode } = parseAirbnbEmail(
      subject,
      text
    );

    if (!guestMessage) {
      return NextResponse.json({ ok: true, skipped: "no message extracted" });
    }

    // Find matching reservation — by confirmation code first, then guest name
    let reservation = confirmationCode
      ? await prisma.reservation.findFirst({
          where: { confirmationCode },
          include: { property: true },
        })
      : null;

    if (!reservation && guestName) {
      reservation = await prisma.reservation.findFirst({
        where: {
          guestName: { contains: guestName, mode: "insensitive" },
          status: "CONFIRMED",
          checkout: { gte: new Date() },
        },
        include: { property: true },
        orderBy: { checkin: "asc" },
      });
    }

    if (!reservation) {
      console.warn("[airbnb-email webhook] No reservation found", {
        confirmationCode,
        guestName,
      });
      return NextResponse.json({ ok: true, skipped: "no reservation found" });
    }

    const { property } = reservation;

    // Generate Claude reply using property documentation
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

    // Save to message history
    await prisma.message.create({
      data: {
        propertyId: property.id,
        reservationId: reservation.id,
        messageType: "guest_reply",
        content: aiReply,
        createdBy: "webhook",
      },
    });

    const airbnbLink = reservation.confirmationCode
      ? buildAirbnbReservationLink(reservation.confirmationCode)
      : null;

    const whatsappMessage = buildGuestReplyMessage({
      propertyName: property.name,
      guestName: reservation.guestName,
      checkin: reservation.checkin,
      checkout: reservation.checkout,
      guestMessage,
      aiReply,
      airbnbLink,
      region: property.region,
    });

    await sendWhatsAppToPersons(property.region, whatsappMessage);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[airbnb-email webhook] Error:", err);
    // Always return 200 to SendGrid to avoid retries on app errors
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
