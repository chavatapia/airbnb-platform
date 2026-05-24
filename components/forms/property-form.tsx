"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function PropertyForm({ propertyId }: { propertyId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch(
      propertyId ? `/api/properties/${propertyId}` : "/api/properties",
      {
        method: propertyId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    if (res.ok) {
      router.push("/properties");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Error al guardar la propiedad");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Nombre de la propiedad *</Label>
              <Input id="name" name="name" placeholder="Ej: Depto Centro Guadalajara" required />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="address">Direccion *</Label>
              <Input id="address" name="address" placeholder="Calle, colonia, ciudad" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <select
                id="region"
                name="region"
                required
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Seleccionar...</option>
                <option value="MEXICO">Mexico</option>
                <option value="NORWAY">Noruega</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Moneda *</Label>
              <select
                id="currency"
                name="currency"
                required
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Seleccionar...</option>
                <option value="MXN">MXN — Peso mexicano</option>
                <option value="NOK">NOK — Corona noruega</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="font-medium text-sm mb-3">📅 Calendario iCal</h3>
            <div className="space-y-2">
              <Label htmlFor="icalUrl">URL del calendario iCal de Airbnb</Label>
              <Input
                id="icalUrl"
                name="icalUrl"
                type="url"
                placeholder="https://www.airbnb.com/calendar/ical/..."
              />
              <p className="text-xs text-muted-foreground">
                En Airbnb: Calendario → Disponibilidad → Exportar calendario → Copiar enlace
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-medium text-sm">🤖 Informacion para el chatbot AI</h3>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instrucciones de acceso</Label>
            <textarea
              id="instructions"
              name="instructions"
              rows={3}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
              placeholder="Ej: Clave del portero: 1234. WiFi: RedCasaNombre / Clave123. La llave esta en la caja gris junto a la puerta..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amenities">Amenidades</Label>
            <textarea
              id="amenities"
              name="amenities"
              rows={2}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
              placeholder="Ej: WiFi, estacionamiento, cocina equipada, aire acondicionado..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rules">Reglas de la casa</Label>
            <textarea
              id="rules"
              name="rules"
              rows={2}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
              placeholder="Ej: No fumar, no mascotas, check-in a partir de las 3pm..."
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : propertyId ? "Actualizar" : "Crear propiedad"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
