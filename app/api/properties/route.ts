import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PropertySchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  region: z.enum(["MEXICO", "NORWAY"]),
  currency: z.enum(["MXN", "NOK"]),
  icalUrl: z.string().url().optional().or(z.literal("")),
  instructions: z.string().optional(),
  amenities: z.string().optional(),
  rules: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = PropertySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { icalUrl, ...rest } = parsed.data;

  const property = await prisma.property.create({
    data: {
      ...rest,
      icalUrl: icalUrl || null,
    },
  });

  // Trigger initial iCal sync if URL provided
  if (property.icalUrl) {
    fetch(`${process.env.AUTH_URL}/api/sync/ical`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch(() => null); // fire-and-forget
  }

  return NextResponse.json(property, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const region = session.user.region;

  const properties = await prisma.property.findMany({
    where: {
      active: true,
      ...(region ? { region } : {}),
    },
    orderBy: [{ region: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(properties);
}
