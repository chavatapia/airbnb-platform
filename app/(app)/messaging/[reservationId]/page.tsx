import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { MessageGenerator } from "@/components/messaging/message-generator";
import { buildAirbnbReservationLink } from "@/lib/ical";
import { Badge } from "@/components/ui/badge";

export default async function MessagingPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const session = await auth();
  if (!["ADMIN", "GUEST_COORDINATOR"].includes(session?.user.role ?? "")) {
    redirect("/dashboard");
  }

  const { reservationId } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      property: true,
      messages: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!reservation) notFound();

  const userRegion = session?.user.region;
  if (userRegion && reservation.property.region !== userRegion) {
    redirect("/dashboard");
  }

  const airbnbLink = reservation.confirmationCode
    ? buildAirbnbReservationLink(reservation.confirmationCode)
    : null;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Reservation Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {reservation.property.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {reservation.guestName ?? "Huesped sin nombre"} ·{" "}
            {new Date(reservation.checkin).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
            })}{" "}
            →{" "}
            {new Date(reservation.checkout).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {reservation.property.region === "MEXICO" ? "Mexico" : "Noruega"}
          </Badge>
          {airbnbLink && (
            <a
              href={airbnbLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-blue-600 hover:text-blue-800"
            >
              Abrir en Airbnb →
            </a>
          )}
        </div>
      </div>

      {/* Message Generator */}
      <MessageGenerator
        reservationId={reservationId}
        region={reservation.property.region}
        recentMessages={reservation.messages}
      />
    </div>
  );
}
