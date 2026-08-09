import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";

let gmailClient: gmail_v1.Gmail | null = null;

export function getOAuthClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REDIRECT_URI must be set"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function initializeGmailClient(): gmail_v1.Gmail {
  if (gmailClient) return gmailClient;

  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "GMAIL_REFRESH_TOKEN environment variable not set. Complete the OAuth flow at /api/auth/gmail first."
    );
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  gmailClient = google.gmail({ version: "v1", auth: oauth2Client });
  return gmailClient;
}

export async function getAirbnbEmails(
  query: string = "from:automated@airbnb.com OR from:noreply@airbnb.com"
): Promise<Array<{ id: string; messageId: string; payload: any }>> {
  const gmail = initializeGmailClient();

  try {
    // Search for Airbnb emails
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50,
    });

    const messages = listResponse.data.messages || [];

    // Get full message details for each email
    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        const response = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });
        return {
          id: msg.id!,
          messageId: response.data.id!,
          payload: response.data.payload,
        };
      })
    );

    return fullMessages;
  } catch (error) {
    console.error("[gmail] Error fetching emails:", error);
    throw error;
  }
}

export function decodeBase64(str: string): string {
  try {
    // Gmail uses URL-safe base64
    const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return str;
  }
}

export function extractEmailBody(payload: any): {
  subject: string;
  plaintext: string;
  html?: string;
} {
  let subject = "";
  let plaintext = "";
  let html = "";

  // Extract subject from headers
  const headers = payload?.headers || [];
  const subjectHeader = headers.find((h: any) => h.name === "Subject");
  if (subjectHeader) {
    subject = subjectHeader.value;
  }

  // Recursively walk MIME parts (Airbnb emails are often nested
  // multipart/alternative inside multipart/related)
  function walk(node: any) {
    if (!node) return;

    if (node.mimeType === "text/plain" && node.body?.data && !plaintext) {
      plaintext = decodeBase64(node.body.data);
    } else if (node.mimeType === "text/html" && node.body?.data && !html) {
      html = decodeBase64(node.body.data);
    }

    if (node.parts) {
      for (const part of node.parts) {
        walk(part);
      }
    }
  }

  if (payload?.parts) {
    walk(payload);
  } else if (payload?.body?.data) {
    plaintext = decodeBase64(payload.body.data);
  }

  return { subject, plaintext, html };
}
