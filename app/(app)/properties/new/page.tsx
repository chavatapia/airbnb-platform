import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PropertyForm } from "@/components/forms/property-form";

export default async function NewPropertyPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Nueva propiedad</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registra una propiedad y conecta su calendario iCal de Airbnb.
        </p>
      </div>
      <PropertyForm />
    </div>
  );
}
