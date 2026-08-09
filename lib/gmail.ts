import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";

interface GmailAuthConfig {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

let gmailClient: gmail_v1.Gmail | null = null;

function initializeGmailClient(): gmail_v1.Gmail {
  if (gmailClient) return gmailClient;

  const credentialsJson = process.env.GMAIL_SERVICE_ACCOUNT_KEY;
  if (!credentialsJson) {
    throw new Error("GMAIL_SERVICE_ACCOUNT_KEY environment variable not set");
  }

  const credentials: GmailAuthConfig = JSON.parse(credentialsJson);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  gmailClient = google.gmail({ version: "v1", auth });
  return gmailClient;
}

export async function getAirbnbEmails(
  query: string = "from:noreply@airbnb.com"
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
    return Buffer.from(str, "base64").toString("utf-8");
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
  const headers = payload.headers || [];
  const subjectHeader = headers.find((h: any) => h.name === "Subject");
  if (subjectHeader) {
    subject = subjectHeader.value;
  }

  // Extract body
  if (payload.parts) {
    for (const part of payload.parts) {
      const mimeType = part.mimeType;
      if (mimeType === "text/plain") {
        if (part.body?.data) {
          plaintext = decodeBase64(part.body.data);
        }
      } else if (mimeType === "text/html") {
        if (part.body?.data) {
          html = decodeBase64(part.body.data);
        }
      }
    }
  } else if (payload.body?.data) {
    plaintext = decodeBase64(payload.body.data);
  }

  return { subject, plaintext, html };
}
