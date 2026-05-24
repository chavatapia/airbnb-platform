import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  icalUrl: z.string().url().optional().or(z.literal("")),
  instructions: z.string().optional(),
  amenities: z.string().optional(),
  rules: z.string().optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const { icalUrl, ...rest } = parsed.data;

  const property = await prisma.property.update({
    where: { id },
    data: {
      ...rest,
      ...(icalUrl !== undefined ? { icalUrl: icalUrl || null } : {}),
    },
  });

  return NextResponse.json(property);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Soft delete — just mark as inactive
  await prisma.property.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
