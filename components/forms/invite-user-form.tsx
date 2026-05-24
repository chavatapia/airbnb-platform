"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const TEAM_SUGGESTIONS = [
  { name: "Pepe", role: "GUEST_COORDINATOR", region: "MEXICO" },
  { name: "Marisa", role: "CLEANING", region: "MEXICO" },
  { name: "Ray", role: "MAINTENANCE", region: "MEXICO" },
  { name: "Kristin", role: "GUEST_COORDINATOR", region: "NORWAY" },
  { name: "Juliia", role: "CLEANING", region: "NORWAY" },
  { name: "Vitalii", role: "MAINTENANCE", region: "NORWAY" },
];

export function InviteUserForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email"),
      name: formData.get("name"),
      role: formData.get("role"),
      region: formData.get("region") || null,
    };

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setSuccess(true);
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Error al crear el usuario");
    }
    setLoading(false);
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <p className="text-2xl">✅</p>
          <p className="font-medium">Usuario registrado</p>
          <p className="text-sm text-muted-foreground">
            El usuario puede hacer login en la plataforma usando su correo electronico.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => { setSuccess(false); }}>
              Invitar otro
            </Button>
            <Button variant="outline" onClick={() => router.push("/settings")}>
              Ver equipo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quick fill suggestions */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Sugerencias rapidas:</p>
        <div className="flex flex-wrap gap-2">
          {TEAM_SUGGESTIONS.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => {
                const form = document.querySelector("form") as HTMLFormElement;
                (form.querySelector('[name="name"]') as HTMLInputElement).value = s.name;
                (form.querySelector('[name="role"]') as HTMLSelectElement).value = s.role;
                (form.querySelector('[name="region"]') as HTMLSelectElement).value = s.region;
              }}
              className="text-xs px-2 py-1 rounded border border-gray-200 hover:border-gray-400"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" name="name" placeholder="Ej: Pepe Garcia" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electronico *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="pepe@correo.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Rol *</Label>
              <select
                id="role"
                name="role"
                required
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Seleccionar...</option>
                <option value="ADMIN">Admin</option>
                <option value="GUEST_COORDINATOR">Coordinador de huespedes</option>
                <option value="CLEANING">Limpieza</option>
                <option value="MAINTENANCE">Mantenimiento</option>
                <option value="FINANCE_VIEWER">Finanzas (solo lectura)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <select
                id="region"
                name="region"
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Ambas (admin)</option>
                <option value="MEXICO">Mexico</option>
                <option value="NORWAY">Noruega</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Registrar usuario"}
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
