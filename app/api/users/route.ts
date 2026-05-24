import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "GUEST_COORDINATOR", "CLEANING", "MAINTENANCE", "FINANCE_VIEWER"]),
  region: z.enum(["MEXICO", "NORWAY"]).nullable().optional(),
});

// GET /api/users — list all users (admin only)
export async function GET() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(users);
}

// POST /api/users — create/invite a user (admin only)
// Creates the user record; they login via magic link on first access
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const { email, name, role, region } = parsed.data;

  // Upsert: if user already exists from a previous login, update their role
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, region: region ?? null },
    create: { email, name, role, region: region ?? null },
  });

  return NextResponse.json(user, { status: 201 });
}
