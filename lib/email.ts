import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendCleaningTaskNotification({
  to,
  propertyName,
  checkoutDate,
  guestName,
  platformUrl,
}: {
  to: string;
  propertyName: string;
  checkoutDate: Date;
  guestName?: string | null;
  platformUrl: string;
}) {
  const formattedDate = checkoutDate.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `Nueva tarea de limpieza — ${propertyName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">🧹 Nueva tarea de limpieza</h2>
        <p><strong>Propiedad:</strong> ${propertyName}</p>
        <p><strong>Fecha checkout:</strong> ${formattedDate}</p>
        ${guestName ? `<p><strong>Huesped:</strong> ${guestName}</p>` : ""}
        <a href="${platformUrl}" style="
          display: inline-block;
          margin-top: 16px;
          padding: 12px 24px;
          background: #1a1a1a;
          color: #fff;
          text-decoration: none;
          border-radius: 6px;
        ">Ver tarea</a>
      </div>
    `,
  });
}

export async function sendMaintenanceAssignmentNotification({
  to,
  propertyName,
  title,
  priority,
  platformUrl,
}: {
  to: string;
  propertyName: string;
  title: string;
  priority: string;
  platformUrl: string;
}) {
  const priorityLabels: Record<string, string> = {
    URGENT: "🔴 Urgente",
    NORMAL: "🟡 Normal",
    LOW: "🟢 Baja",
  };

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `Solicitud de mantenimiento — ${propertyName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">🔧 Nueva solicitud de mantenimiento</h2>
        <p><strong>Propiedad:</strong> ${propertyName}</p>
        <p><strong>Titulo:</strong> ${title}</p>
        <p><strong>Prioridad:</strong> ${priorityLabels[priority] ?? priority}</p>
        <a href="${platformUrl}" style="
          display: inline-block;
          margin-top: 16px;
          padding: 12px 24px;
          background: #1a1a1a;
          color: #fff;
          text-decoration: none;
          border-radius: 6px;
        ">Ver solicitud</a>
      </div>
    `,
  });
}
