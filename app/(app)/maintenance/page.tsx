import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { MaintenancePriority, MaintenanceStatus } from "@prisma/client";

const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  URGENT: "Urgente",
  NORMAL: "Normal",
  LOW: "Baja",
};

const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  URGENT: "bg-red-100 text-red-700",
  NORMAL: "bg-yellow-100 text-yellow-700",
  LOW: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En progreso",
  RESOLVED: "Resuelto",
};

export default async function MaintenancePage() {
  const session = await auth();
  if (!["ADMIN", "MAINTENANCE"].includes(session?.user.role ?? "")) {
    redirect("/dashboard");
  }

  const region = session?.user.region;
  const email = session?.user.email;
  const isAdmin = session?.user.role === "ADMIN";

  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      property: region ? { region } : {},
      ...(isAdmin ? {} : { assignedTo: email }),
    },
    include: {
      property: { select: { name: true, region: true } },
    },
    orderBy: [
      { priority: "asc" }, // URGENT first
      { createdAt: "desc" },
    ],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mantenimiento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {requests.length} solicitudes abiertas
          </p>
        </div>
        {isAdmin && (
          <Link href="/maintenance/new">
            <Button>+ Nueva solicitud</Button>
          </Link>
        )}
      </div>

      {requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-2xl mb-2">🔧</p>
            <p className="font-medium">No hay solicitudes abiertas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Las solicitudes pueden crearse manualmente o desde reportes de limpieza.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <Link key={req.id} href={`/maintenance/${req.id}`}>
              <div className="bg-white border border-gray-100 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-sm">{req.title}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[req.priority]}`}
                      >
                        {PRIORITY_LABELS[req.priority]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {req.property.name} ·{" "}
                      {req.property.region === "MEXICO" ? "Mexico" : "Noruega"}
                    </p>
                    {req.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {req.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(req.createdAt).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {STATUS_LABELS[req.status]}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
