import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateGuestMessage } from "@/lib/claude";
import { z } from "zod";

const GenerateSchema = z.object({
  reservationId: z.string(),
  messageType: z.enum(["welcome", "checkin", "checkout", "faq", "special"]),
  customPrompt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (!["ADMIN", "GUEST_COORDINATOR"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = GenerateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const { reservationId, messageType, customPrompt } = parsed.data;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { property: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  // Enforce region restriction for non-admin
  const userRegion = session.user.region;
  if (userRegion && reservation.property.region !== userRegion) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await generateGuestMessage({
    messageType,
    propertyName: reservation.property.name,
    propertyInstructions: reservation.property.instructions,
    propertyAmenities: reservation.property.amenities,
    propertyRules: reservation.property.rules,
    region: reservation.property.region,
    guestName: reservation.guestName,
    checkinDate: reservation.checkin,
    checkoutDate: reservation.checkout,
    customPrompt,
  });

  // Save message to DB for history
  await prisma.message.create({
    data: {
      propertyId: reservation.propertyId,
      reservationId,
      messageType,
      content: message,
      createdBy: session.user.email!,
    },
  });

  return NextResponse.json({ message });
}
