import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "ISSUE", "CANCELLED"]),
  notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!["ADMIN", "CLEANING"].includes(session?.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const { status, notes } = parsed.data;

  const task = await prisma.cleaningTask.update({
    where: { id },
    data: {
      status,
      notes: notes ?? undefined,
      completedAt: status === "DONE" ? new Date() : undefined,
    },
  });

  // If issue reported → auto-create maintenance request
  if (status === "ISSUE" && notes) {
    await prisma.maintenanceRequest.create({
      data: {
        propertyId: task.propertyId,
        title: `Problema reportado en limpieza`,
        description: notes,
        priority: "NORMAL",
        reportedBy: session?.user.email ?? undefined,
      },
    });
  }

  return NextResponse.json(task);
}
