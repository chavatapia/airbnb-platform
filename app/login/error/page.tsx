import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "Error de configuracion del servidor. Contacta al administrador.",
  AccessDenied: "No tienes permiso para acceder.",
  Verification: "El enlace expiro o ya fue usado. Solicita uno nuevo.",
  Default: "Ocurrio un error al iniciar sesion.",
};

export default function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <CardTitle className="text-xl">Error al iniciar sesion</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Hubo un problema con el inicio de sesion. Intenta de nuevo.
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
          >
            Volver al login
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
