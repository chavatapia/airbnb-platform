import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InviteUserForm } from "@/components/forms/invite-user-form";

export default async function InviteUserPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Invitar usuario</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registra a un miembro del equipo. Podra acceder usando su correo con un enlace magico.
        </p>
      </div>
      <InviteUserForm />
    </div>
  );
}
