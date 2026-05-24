import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const syncLogs = await prisma.syncLog.findMany({
    where: { type: "ical" },
    include: { property: { select: { name: true } } },
    orderBy: { syncedAt: "desc" },
    take: 20,
  });

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    GUEST_COORDINATOR: "Coordinador",
    CLEANING: "Limpieza",
    MAINTENANCE: "Mantenimiento",
    FINANCE_VIEWER: "Finanzas",
  };

  const REGION_LABELS: Record<string, string> = {
    MEXICO: "Mexico",
    NORWAY: "Noruega",
  };

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Configuracion</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Usuarios, sync logs y ajustes del sistema
        </p>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Equipo</CardTitle>
            <Link href="/settings/users/invite">
              <Button size="sm" variant="outline">+ Invitar usuario</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay usuarios registrados aun.</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{user.name ?? user.email}</p>
                    {user.name && (
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                    {user.region && (
                      <Badge variant="outline" className="text-xs">
                        {REGION_LABELS[user.region] ?? user.region}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">iCal Sync Log</CardTitle>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay sincronizaciones registradas. El cron corre cada 30 min.
            </p>
          ) : (
            <div className="space-y-1 text-xs">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-center justify-between py-1.5 border-b last:border-0 ${
                    log.status === "error" ? "text-red-600" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        log.status === "success"
                          ? "bg-green-500"
                          : log.status === "error"
                          ? "bg-red-500"
                          : "bg-yellow-500"
                      }`}
                    />
                    <span className="text-gray-700">
                      {log.property?.name ?? "—"}
                    </span>
                    {log.details && (
                      <span className="text-muted-foreground">{log.details}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground flex-shrink-0 ml-2">
                    {new Date(log.syncedAt).toLocaleString("es-MX", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Sync Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronizacion manual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Fuerza la sincronizacion de todos los calendarios iCal ahora.
            Normalmente se ejecuta automaticamente cada 30 minutos via Vercel Cron.
          </p>
          <ManualSyncButton />
        </CardContent>
      </Card>
    </div>
  );
}

function ManualSyncButton() {
  return (
    <form
      action={async () => {
        "use server";
        const { auth } = await import("@/lib/auth");
        const session = await auth();
        if (session?.user.role !== "ADMIN") return;

        await fetch(
          `${process.env.AUTH_URL}/api/sync/ical`,
          {
            headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
          }
        );
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
      >
        Sincronizar ahora
      </button>
    </form>
  );
}
