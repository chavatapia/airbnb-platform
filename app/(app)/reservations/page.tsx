import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ReservationStatus } from "@prisma/client";

const STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  BLOCKED: "Bloqueada",
  PENDING_DATA: "Pendiente datos",
};

const STATUS_COLORS: Record<ReservationStatus, string> = {
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  BLOCKED: "bg-gray-100 text-gray-600",
  PENDING_DATA: "bg-yellow-100 text-yellow-800",
};

export default async function ReservationsPage() {
  const session = await auth();
  if (!["ADMIN", "GUEST_COORDINATOR"].includes(session?.user.role ?? "")) {
    redirect("/dashboard");
  }

  const region = session?.user.region;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Next 30 days of activity
  const upcoming = await prisma.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "PENDING_DATA"] },
      checkout: { gte: today },
      property: region ? { region } : {},
    },
    include: { property: { select: { name: true, region: true } } },
    orderBy: { checkin: "asc" },
    take: 50,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Proximas {upcoming.length} reservas activas
          </p>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-2xl mb-2">📅</p>
            <p className="font-medium">No hay reservas activas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Las reservas se sincronizan automaticamente desde Airbnb via iCal.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {upcoming.map((res) => {
            const isToday =
              new Date(res.checkin).toDateString() === today.toDateString() ||
              new Date(res.checkout).toDateString() === today.toDateString();

            return (
              <div
                key={res.id}
                className={`flex items-center justify-between p-4 bg-white rounded-lg border ${
                  isToday ? "border-blue-200 bg-blue-50" : "border-gray-100"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-gray-900">
                      {res.property.name}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {res.property.region === "MEXICO" ? "MX" : "NO"}
                    </Badge>
                    {isToday && (
                      <Badge className="text-xs bg-blue-600">Hoy</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {res.guestName ?? <span className="italic text-gray-400">Sin nombre</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(res.checkin).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    →{" "}
                    {new Date(res.checkout).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[res.status]}`}
                  >
                    {STATUS_LABELS[res.status]}
                  </span>
                  {["ADMIN", "GUEST_COORDINATOR"].includes(session?.user.role ?? "") && (
                    <Link
                      href={`/messaging/${res.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      💬 Mensaje
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
