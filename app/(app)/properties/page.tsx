import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Region, Currency } from "@prisma/client";

const REGION_LABELS: Record<Region, string> = {
  MEXICO: "Mexico",
  NORWAY: "Noruega",
};

const CURRENCY_LABELS: Record<Currency, string> = {
  MXN: "MXN",
  NOK: "NOK",
};

export default async function PropertiesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const properties = await prisma.property.findMany({
    orderBy: [{ region: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          reservations: { where: { status: "CONFIRMED" } },
        },
      },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Propiedades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {properties.length} propiedades registradas
          </p>
        </div>
        <Link href="/properties/new">
          <Button>+ Agregar propiedad</Button>
        </Link>
      </div>

      {properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-2xl mb-2">🏡</p>
            <p className="font-medium">No hay propiedades registradas</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Agrega tu primera propiedad con su URL de calendario iCal de Airbnb.
            </p>
            <Link href="/properties/new">
              <Button>+ Agregar propiedad</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{property.name}</CardTitle>
                    <div className="flex gap-1.5 flex-shrink-0 ml-2">
                      <Badge variant="outline" className="text-xs">
                        {REGION_LABELS[property.region]}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {CURRENCY_LABELS[property.currency]}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{property.address}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {property._count.reservations} reservas activas
                    </span>
                    {property.icalUrl ? (
                      <span className="text-green-600 text-xs">● iCal activo</span>
                    ) : (
                      <span className="text-amber-500 text-xs">○ Sin iCal</span>
                    )}
                  </div>
                  {property.lastIcalSync && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ultimo sync:{" "}
                      {new Date(property.lastIcalSync).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
