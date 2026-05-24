import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MessagingIndexPage() {
  const session = await auth();
  if (!["ADMIN", "GUEST_COORDINATOR"].includes(session?.user.role ?? "")) {
    redirect("/dashboard");
  }

  const region = session?.user.region;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Active reservations with upcoming or recent checkins
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "PENDING_DATA"] },
      checkout: { gte: today },
      property: region ? { region } : {},
    },
    include: {
      property: { select: { name: true, region: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { checkin: "asc" },
    take: 30,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mensajes AI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona una reserva para generar un mensaje con AI
        </p>
      </div>

      {reservations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-2xl mb-2">💬</p>
            <p className="font-medium">No hay reservas activas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Las reservas aparecen aqui cuando se sincronizan desde Airbnb via iCal.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reservations.map((res) => (
            <Link key={res.id} href={`/messaging/${res.id}`}>
              <div className="bg-white border border-gray-100 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{res.property.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {res.property.region === "MEXICO" ? "MX" : "NO"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {res.guestName ?? <span className="italic text-gray-400">Sin nombre</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(res.checkin).toLocaleDateString("es-MX", {
                        day: "numeric", month: "short"
                      })} → {new Date(res.checkout).toLocaleDateString("es-MX", {
                        day: "numeric", month: "short"
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    {res.messages[0] ? (
                      <p className="text-xs text-muted-foreground">
                        Ultimo mensaje: {new Date(res.messages[0].createdAt).toLocaleDateString("es-MX")}
                      </p>
                    ) : (
                      <span className="text-xs text-blue-600">Sin mensajes aun</span>
                    )}
                    <p className="text-xs text-blue-600 mt-1">Generar mensaje →</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
