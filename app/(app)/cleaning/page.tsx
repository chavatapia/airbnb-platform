import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CleaningTaskActions } from "@/components/cleaning/task-actions";
import type { CleaningStatus } from "@prisma/client";

const STATUS_LABELS: Record<CleaningStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  DONE: "Lista",
  ISSUE: "Problema",
  CANCELLED: "Cancelada",
};

const STATUS_COLORS: Record<CleaningStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  DONE: "bg-green-100 text-green-800",
  ISSUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function CleaningPage() {
  const session = await auth();
  if (!["ADMIN", "CLEANING"].includes(session?.user.role ?? "")) {
    redirect("/dashboard");
  }

  const region = session?.user.region;
  const email = session?.user.email;
  const isAdmin = session?.user.role === "ADMIN";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7days = new Date(today);
  in7days.setDate(in7days.getDate() + 7);

  // Week bounds: Sunday → Saturday
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // last Sunday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const tasks = await prisma.cleaningTask.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      scheduledFor: { gte: today, lte: in7days },
      property: region ? { region } : {},
      ...(isAdmin ? {} : { assignedTo: email }),
    },
    include: {
      property: { select: { name: true, region: true } },
      reservation: { select: { guestName: true, confirmationCode: true } },
    },
    orderBy: { scheduledFor: "asc" },
  });

  // Weekly summary (admin only)
  const weeklyDone = isAdmin
    ? await prisma.cleaningTask.findMany({
        where: {
          status: "DONE",
          completedAt: { gte: weekStart, lte: weekEnd },
          property: region ? { region } : {},
        },
        include: {
          property: { select: { name: true } },
          reservation: { select: { guestName: true } },
        },
        orderBy: { completedAt: "asc" },
      })
    : [];

  // Group by completedBy for the summary
  const byPerson: Record<string, typeof weeklyDone> = {};
  for (const t of weeklyDone) {
    const key = t.completedBy ?? "—";
    if (!byPerson[key]) byPerson[key] = [];
    byPerson[key].push(t);
  }

  // Past issues (not resolved)
  const issues = await prisma.cleaningTask.findMany({
    where: {
      status: "ISSUE",
      property: region ? { region } : {},
      ...(isAdmin ? {} : { assignedTo: email }),
    },
    include: {
      property: { select: { name: true, region: true } },
    },
    orderBy: { scheduledFor: "desc" },
    take: 10,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Limpieza</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tareas de los proximos 7 dias — {tasks.length} pendientes
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Resumen semana{" "}
              {weekStart.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
              {" – "}
              {weekEnd.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
            </p>
            {weeklyDone.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin limpiezas completadas esta semana.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byPerson).map(([person, personTasks]) => (
                  <div key={person}>
                    <p className="text-sm font-medium text-gray-800">
                      {person === email ? "Yo" : person} — {personTasks.length}{" "}
                      {personTasks.length === 1 ? "limpieza" : "limpiezas"}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {personTasks.map((t) => (
                        <li key={t.id} className="text-xs text-gray-500 flex gap-2">
                          <span>•</span>
                          <span>
                            {t.property.name}
                            {t.reservation.guestName ? ` · ${t.reservation.guestName}` : ""}
                            {" · "}
                            {new Date(t.completedAt!).toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 && issues.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-2xl mb-2">🧹</p>
            <p className="font-medium">No hay tareas de limpieza pendientes</p>
            <p className="text-sm text-muted-foreground mt-1">
              Las tareas se crean automaticamente cuando hay un checkout en las proximas 24h.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {tasks.length > 0 && (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isToday =
                  new Date(task.scheduledFor).toDateString() ===
                  new Date().toDateString();

                return (
                  <div
                    key={task.id}
                    className={`bg-white border rounded-lg p-4 ${
                      isToday ? "border-blue-200 bg-blue-50" : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{task.property.name}</p>
                          {isToday && (
                            <Badge className="bg-blue-600 text-xs">Hoy</Badge>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}
                          >
                            {STATUS_LABELS[task.status]}
                          </span>
                        </div>
                        {task.reservation.guestName && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Checkout: {task.reservation.guestName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(task.scheduledFor).toLocaleDateString("es-MX", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </p>
                        {task.notes && (
                          <p className="text-xs text-gray-600 mt-1 italic">{task.notes}</p>
                        )}
                      </div>
                      <CleaningTaskActions
                        taskId={task.id}
                        currentStatus={task.status}
                        assignedTo={task.assignedTo}
                        userRole={session?.user.role}
                        userEmail={email ?? undefined}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {issues.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-red-700 mb-2">
                🔴 Problemas reportados
              </h2>
              <div className="space-y-2">
                {issues.map((task) => (
                  <div key={task.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-sm">{task.property.name}</p>
                        {task.notes && (
                          <p className="text-xs text-red-700 mt-1">{task.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(task.scheduledFor).toLocaleDateString("es-MX")}
                        </p>
                      </div>
                      <CleaningTaskActions
                        taskId={task.id}
                        currentStatus={task.status}
                        userRole={session?.user.role}
                        userEmail={email ?? undefined}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
