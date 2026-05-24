import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user.role;
  const region = session?.user.region;

  const propertiesCount = await prisma.property.count({
    where: {
      active: true,
      ...(region ? { region } : {}),
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const checkinsToday = await prisma.reservation.count({
    where: {
      checkin: { gte: today, lt: tomorrow },
      status: "CONFIRMED",
      property: region ? { region } : {},
    },
  });

  const checkoutsToday = await prisma.reservation.count({
    where: {
      checkout: { gte: today, lt: tomorrow },
      status: "CONFIRMED",
      property: region ? { region } : {},
    },
  });

  const pendingCleaning = await prisma.cleaningTask.count({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      property: region ? { region } : {},
      ...(role === "CLEANING" && session?.user.email
        ? { assignedTo: session.user.email }
        : {}),
    },
  });

  const openMaintenance = await prisma.maintenanceRequest.count({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      property: region ? { region } : {},
      ...(role === "MAINTENANCE" && session?.user.email
        ? { assignedTo: session.user.email }
        : {}),
    },
  });

  const greetingName = session?.user.name?.split(" ")[0] ?? "bienvenido";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Hola, {greetingName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(role === "ADMIN" || role === "GUEST_COORDINATOR") && (
          <>
            <StatCard
              icon="🏡"
              label="Propiedades activas"
              value={propertiesCount}
            />
            <StatCard
              icon="✅"
              label="Check-ins hoy"
              value={checkinsToday}
              highlight={checkinsToday > 0}
            />
            <StatCard
              icon="🚪"
              label="Check-outs hoy"
              value={checkoutsToday}
              highlight={checkoutsToday > 0}
            />
          </>
        )}

        {(role === "ADMIN" || role === "CLEANING") && (
          <StatCard
            icon="🧹"
            label="Tareas de limpieza"
            value={pendingCleaning}
            highlight={pendingCleaning > 0}
          />
        )}

        {(role === "ADMIN" || role === "MAINTENANCE") && (
          <StatCard
            icon="🔧"
            label="Mantenimiento abierto"
            value={openMaintenance}
            highlight={openMaintenance > 0}
          />
        )}
      </div>

      {propertiesCount === 0 && (role === "ADMIN") && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-2xl mb-2">🏡</p>
            <p className="font-medium">No hay propiedades registradas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ve a <a href="/properties" className="underline">Propiedades</a> para agregar tu primera propiedad con su URL de calendario iCal.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span>{icon}</span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${highlight ? "text-blue-600" : "text-gray-900"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
