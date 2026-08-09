import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/gmail";

// GET /api/auth/gmail/callback
// Google redirects here after the user grants consent. Exchanges the
// authorization code for tokens and displays the refresh token so it can
// be copied into GMAIL_REFRESH_TOKEN. This page is shown only once —
// Google does not let you retrieve the refresh token again later, so if
// you lose it, redo the flow at /api/auth/gmail (using prompt=consent it
// will issue a new one).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          error:
            "No refresh token returned. This usually means you already granted consent before. " +
            "Revoke access at https://myaccount.google.com/permissions and try /api/auth/gmail again.",
        },
        { status: 400 }
      );
    }

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>✅ Gmail conectado</h2>
        <p>Copia este valor y guárdalo como <code>GMAIL_REFRESH_TOKEN</code> en tus variables de entorno. No se volverá a mostrar.</p>
        <pre style="background:#f4f4f4;padding:1rem;border-radius:8px;word-break:break-all">${tokens.refresh_token}</pre>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
