import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { PropertyForm } from "@/components/forms/property-form";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{property.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Editar propiedad</p>
      </div>
      <PropertyForm
        propertyId={id}
        defaults={{
          name: property.name,
          address: property.address,
          region: property.region,
          currency: property.currency,
          icalUrl: property.icalUrl ?? undefined,
          whatsappGroupId: property.whatsappGroupId ?? undefined,
          instructions: property.instructions ?? undefined,
          amenities: property.amenities ?? undefined,
          rules: property.rules ?? undefined,
        }}
      />
    </div>
  );
}
