import { CONFIRMATION_CODE_REGEX } from "@/lib/ical";

export interface ParsedAirbnbEmail {
  guestName: string | null;
  guestMessage: string;
  confirmationCode: string | null;
}

export function parseAirbnbEmail(
  subject: string,
  text: string
): ParsedAirbnbEmail {
  // Extract confirmation code from subject or body
  const codeMatch =
    subject.match(CONFIRMATION_CODE_REGEX) ||
    text.match(CONFIRMATION_CODE_REGEX);
  const confirmationCode = codeMatch ? codeMatch[1].toUpperCase() : null;

  // Extract guest name from subject patterns:
  // "[Name] sent you a message"
  // "Re: [Name] sent you a message"
  // "New message from [Name]"
  let guestName: string | null = null;
  const nameFromSent = subject.match(/^(?:Re:\s*)?(.+?)\s+sent you a message/i);
  const nameFromNew = subject.match(/New message from\s+(.+?)(?:\s*[-–]|$)/i);
  if (nameFromSent) {
    guestName = nameFromSent[1].trim();
  } else if (nameFromNew) {
    guestName = nameFromNew[1].trim();
  }

  // Extract guest message from plain text body.
  // Airbnb email text bodies follow patterns like:
  //   "[Name] sent you a message:\n\n[message]\n\n---"
  //   "Hi [Host],\n\n[Name] sent you a message:\n\n[message]\n\n"
  const guestMessage = extractMessageBody(text);

  return { guestName, guestMessage, confirmationCode };
}

function extractMessageBody(text: string): string {
  const lines = text.split("\n");
  let messageStart = -1;
  let messageEnd = lines.length;

  // Find the line that ends with "sent you a message:" or "message about [property]:"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      /sent you a message[:\s]*$/i.test(line) ||
      /message about .+[:\s]*$/i.test(line)
    ) {
      // Skip blank lines after the intro
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      messageStart = j;
      break;
    }
  }

  if (messageStart === -1) {
    // Fallback: use everything before the first "---" divider
    const dividerIndex = lines.findIndex((l) => /^-{3,}/.test(l.trim()));
    if (dividerIndex > 0) {
      return lines.slice(0, dividerIndex).join("\n").trim();
    }
    // Last resort: return whole text trimmed
    return text.trim().slice(0, 1000);
  }

  // Find end of message (first "---" divider or Airbnb footer)
  for (let i = messageStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      /^-{3,}/.test(line) ||
      /^Reply\s*(here|to this message)?:/i.test(line) ||
      /airbnb\.com/i.test(line) ||
      /unsubscribe/i.test(line)
    ) {
      messageEnd = i;
      break;
    }
  }

  return lines
    .slice(messageStart, messageEnd)
    .join("\n")
    .trim()
    .slice(0, 2000); // cap at 2000 chars
}
