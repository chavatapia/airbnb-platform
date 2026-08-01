import { CONFIRMATION_CODE_REGEX } from "@/lib/ical";

export interface ParsedAirbnbEmail {
  guestName: string | null;
  guestMessage: string;
  confirmationCode: string | null;
  threadUrl: string | null;
}

export function parseAirbnbEmail(
  subject: string,
  text: string,
  html?: string
): ParsedAirbnbEmail {
  const codeMatch =
    subject.match(CONFIRMATION_CODE_REGEX) ||
    text.match(CONFIRMATION_CODE_REGEX) ||
    (html ? html.match(CONFIRMATION_CODE_REGEX) : null);
  const confirmationCode = codeMatch ? codeMatch[1].toUpperCase() : null;

  // Extract thread URL (direct link to the Airbnb conversation)
  const threadMatch = text.match(/airbnb\.com\/hosting\/thread\/(\d+)/) ||
    (html ? html.match(/airbnb\.com\/hosting\/thread\/(\d+)/) : null);
  const threadUrl = threadMatch
    ? `https://www.airbnb.com/hosting/thread/${threadMatch[1]}`
    : null;

  // Extract guest name from subject
  let guestName: string | null = null;
  const nameFromSent = subject.match(/^(?:Re:\s*)?(.+?)\s+sent you a message/i);
  const nameFromNew  = subject.match(/New message from\s+(.+?)(?:\s*[-–]|$)/i);
  if (nameFromSent) guestName = nameFromSent[1].trim();
  else if (nameFromNew) guestName = nameFromNew[1].trim();

  const guestMessage = extractMessageBody(text);

  return { guestName, guestMessage, confirmationCode, threadUrl };
}

function extractMessageBody(text: string): string {
  // Airbnb "digest" format: multiple messages with "NAME\n\nBooker\n\nMESSAGE"
  // Try to extract from digest first
  const digest = extractFromDigest(text);
  if (digest) return digest;

  const lines = text.split("\n");
  let messageStart = -1;
  let messageEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      /sent you a message[:\s]*$/i.test(line) ||
      /message about .+[:\s]*$/i.test(line)
    ) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      messageStart = j;
      break;
    }
  }

  if (messageStart === -1) {
    const dividerIndex = lines.findIndex((l) => /^-{3,}/.test(l.trim()));
    if (dividerIndex > 0) {
      return cleanMessageText(lines.slice(0, dividerIndex).join("\n"));
    }
    return cleanMessageText(text.slice(0, 2000));
  }

  for (let i = messageStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      /^-{3,}/.test(line) ||
      /^Reply\s*(here|to this message)?:/i.test(line) ||
      /unsubscribe/i.test(line)
    ) {
      messageEnd = i;
      break;
    }
  }

  return cleanMessageText(lines.slice(messageStart, messageEnd).join("\n"));
}

// Handle Airbnb digest emails where multiple messages are grouped together
// Pattern: NAME\n\nBooker\n\nMESSAGE\n\nAutomatically translated...\n\nORIGINAL
function extractFromDigest(text: string): string | null {
  // Detect digest format by presence of "Booker" label
  if (!/^\s*Booker\s*$/m.test(text)) return null;

  const messages: string[] = [];
  // Split on "Booker" sections to get each message block
  const blocks = text.split(/\n\s*Booker\s*\n/);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    // Remove the guest name line at the start of next block (if any)
    // and anything after "Automatically translated"
    const translationSplit = block.split(/Automatically translated from original message[:\s]*/i);
    // Use the FIRST part (what they actually wrote, before translation)
    const rawMessage = translationSplit[0];

    const cleaned = cleanMessageText(rawMessage);
    if (cleaned.length > 5) messages.push(cleaned);
  }

  if (messages.length === 0) return null;
  return messages.join("\n\n");
}

function cleanMessageText(text: string): string {
  return text
    .split("\n")
    .map(l => l.trim())
    // Remove tracking pixels, URLs, and boilerplate lines
    .filter(l => {
      if (l === "") return false;
      if (l.startsWith("%opentrack%")) return false;
      if (/^https?:\/\//i.test(l)) return false;
      if (/^\[https?:\/\//i.test(l)) return false;
      if (/^RESERVATION FOR /i.test(l)) return false;
      if (/For your protection and safety/i.test(l)) return false;
      if (/always communicate through Airbnb/i.test(l)) return false;
      if (/^Reply$/i.test(l)) return false;
      return true;
    })
    .join("\n")
    .trim()
    .slice(0, 2000);
}
