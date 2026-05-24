import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function FinancesPage() {
  const session = await auth();
  if (!["ADMIN", "FINANCE_VIEWER"].includes(session?.user.role ?? "")) {
    redirect("/dashboard");
  }

  const region = session?.user.region;
  const isAdmin = session?.user.role === "ADMIN";

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // This month aggregates
  const [mxIncome, nokIncome, mxExpenses, nokExpenses] = await Promise.all([
    prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        currency: "MXN",
        date: { gte: firstOfMonth, lte: lastOfMonth },
        property: region && region !== "NORWAY" ? { region: "MEXICO" } : { region: "MEXICO" },
      },
    }),
    prisma.income.aggregate({
      _sum: { amount: true },
      where: {
        currency: "NOK",
        date: { gte: firstOfMonth, lte: lastOfMonth },
        property: region && region !== "MEXICO" ? { region: "NORWAY" } : { region: "NORWAY" },
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        currency: "MXN",
        date: { gte: firstOfMonth, lte: lastOfMonth },
        property: { region: "MEXICO" },
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        currency: "NOK",
        date: { gte: firstOfMonth, lte: lastOfMonth },
        property: { region: "NORWAY" },
      },
    }),
  ]);

  const mxNet = Number(mxIncome._sum.amount ?? 0) - Number(mxExpenses._sum.amount ?? 0);
  const nokNet = Number(nokIncome._sum.amount ?? 0) - Number(nokExpenses._sum.amount ?? 0);

  const monthLabel = now.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  const showMexico = !region || region === "MEXICO";
  const showNorway = !region || region === "NORWAY";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Finanzas</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{monthLabel}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Link href="/finances/expenses/new">
              <Button variant="outline" size="sm">+ Gasto</Button>
            </Link>
            <Link href="/finances/income/new">
              <Button size="sm">+ Ingreso</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {showMexico && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Mexico</CardTitle>
                <Badge variant="outline">MXN</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ingresos</span>
                <span className="font-medium text-green-700">
                  ${Number(mxIncome._sum.amount ?? 0).toLocaleString("es-MX")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gastos</span>
                <span className="font-medium text-red-600">
                  ${Number(mxExpenses._sum.amount ?? 0).toLocaleString("es-MX")}
                </span>
              </div>
              <div className="pt-2 border-t flex justify-between">
                <span className="font-medium text-sm">Utilidad neta</span>
                <span
                  className={`font-bold text-sm ${mxNet >= 0 ? "text-green-700" : "text-red-600"}`}
                >
                  ${mxNet.toLocaleString("es-MX")} MXN
                </span>
              </div>
              {isAdmin && (
                <Link href="/finances/import" className="block">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Importar CSV Airbnb
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {showNorway && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Noruega</CardTitle>
                <Badge variant="outline">NOK</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ingresos</span>
                <span className="font-medium text-green-700">
                  {Number(nokIncome._sum.amount ?? 0).toLocaleString("nb-NO")} kr
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gastos</span>
                <span className="font-medium text-red-600">
                  {Number(nokExpenses._sum.amount ?? 0).toLocaleString("nb-NO")} kr
                </span>
              </div>
              <div className="pt-2 border-t flex justify-between">
                <span className="font-medium text-sm">Utilidad neta</span>
                <span
                  className={`font-bold text-sm ${nokNet >= 0 ? "text-green-700" : "text-red-600"}`}
                >
                  {nokNet.toLocaleString("nb-NO")} NOK
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {isAdmin && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground text-center">
              Para agregar gastos e ingresos en detalle, usa el menu lateral.
              Importa el CSV de transacciones de Airbnb para actualizar los ingresos automaticamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
