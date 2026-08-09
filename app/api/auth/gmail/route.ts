import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/gmail";

// GET /api/auth/gmail?secret=YOUR_CRON_SECRET
// Starts the one-time OAuth consent flow to grant this app read access
// to your personal Gmail inbox. Visit this URL in a browser (with the
// secret query param) while logged into the Gmail account that receives
// Airbnb reservation emails. A query param is used instead of a header
// because this endpoint is meant to be opened directly in a browser.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const oauth2Client = getOAuthClient();

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    });

    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
