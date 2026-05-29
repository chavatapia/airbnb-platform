import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email";
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
// Creates the user record and sends an invitation email with the login URL
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

  const isNew = !(await prisma.user.findUnique({ where: { email } }));

  // Upsert: if user already exists from a previous login, update their role
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, region: region ?? null },
    create: { email, name, role, region: region ?? null },
  });

  // Send invitation email only for new users
  if (isNew) {
    const platformUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
    await sendInvitationEmail({ to: email, name, platformUrl }).catch(() => {
      // Non-fatal: user was created, email failure shouldn't block the response
    });
  }

  return NextResponse.json(user, { status: 201 });
}
