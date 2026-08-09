# Gmail Synchronization Setup

This document explains how to set up Gmail synchronization for Airbnb reservation emails.

## Overview

The Gmail sync endpoint automatically fetches Airbnb confirmation emails from your Gmail inbox and imports them into the database. This is the most reliable data source since Airbnb emails contain:
- Confirmation codes (HM-format)
- Guest names
- Check-in and check-out dates
- Property information

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable the **Gmail API**:
   - Go to APIs & Services → Library
   - Search for "Gmail API"
   - Click it and press "Enable"

### 2. Create a Service Account

1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "Service Account"
3. Fill in the service account details:
   - Name: `airbnb-sync`
   - Description: "Airbnb reservation email parser"
4. Click "Create and Continue"
5. Grant the service account access (you can skip this for now)
6. Click "Done"

### 3. Generate Service Account Key

1. Click on the service account you just created
2. Go to the "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose **JSON** format
5. Click "Create"
6. This will download a JSON file with your credentials

### 4. Share Your Gmail with the Service Account

The service account needs access to your Gmail. You have two options:

**Option A: Share your email directly (Recommended for testing)**
1. Copy the `client_email` from your downloaded JSON file (format: `xxx@xxx.iam.gserviceaccount.com`)
2. Forward your Gmail inbox permissions to this service account
3. This is not possible through Gmail UI directly—you'll need to:
   - Create a shared mailbox in Google Workspace, OR
   - Use Gmail delegation (if using Google Workspace)

**Option B: Use Gmail API with OAuth (Better for production)**
1. Set up OAuth 2.0 consent screen
2. Create OAuth credentials (Desktop application)
3. Implement OAuth flow in the app

For now, we'll use **domain-wide delegation** if you have Google Workspace.

### 5. Configure Environment Variables

1. Take the JSON file you downloaded
2. Convert it to a single-line string (remove newlines)
3. Add to your `.env.local`:

```bash
GMAIL_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**Important:** Keep the `\n` in the private_key as literal characters (not actual newlines).

### 6. Test the Sync

Run the sync endpoint manually:

```bash
curl -H 'Authorization: Bearer YOUR_CRON_SECRET' \
  http://localhost:3000/api/sync/gmail
```

Expected response:
```json
{
  "imported": 5,
  "updated": 2,
  "skipped": 0,
  "total": 7,
  "results": [
    "Created: HM1A2B3C4D (John Doe)",
    "Updated: HM5E6F7G8H (Jane Smith)"
  ]
}
```

## Troubleshooting

### Error: "GMAIL_SERVICE_ACCOUNT_KEY environment variable not set"

**Solution:** Make sure you've added the environment variable to `.env.local` and restarted the dev server.

### Error: "Invalid credentials"

**Solution:**
1. Double-check that the JSON key is valid (no missing quotes, proper escaping)
2. Make sure the Gmail API is enabled in Google Cloud Console
3. Verify the service account has access to read Gmail

### No emails found

**Possible causes:**
1. The service account doesn't have access to your Gmail inbox
2. There are no Airbnb emails with the search query
3. All emails have been marked as read

**Solution:** Try adjusting the search query in `getAirbnbEmails()` to include older emails or read messages.

## How It Works

1. The sync endpoint is called every 30 minutes by Vercel Cron (you can configure this)
2. It fetches unread Airbnb emails from the last 30 days
3. For each email, it:
   - Extracts the confirmation code, guest name, and dates
   - Finds the matching property in the database
   - Creates a new reservation or updates an existing one
4. Results are logged to the `SyncLog` table

## Parser Capabilities

The email parser (`lib/gmail-parser.ts`) can extract:

- **Confirmation codes:** HM-format codes (e.g., HM1A2B3C4D)
- **Guest names:** From the "Guest" field or email content
- **Dates:** Check-in and check-out dates (English and Spanish formats)
- **Property names:** From the email subject or body
- **Status:** CONFIRMED or PENDING based on email content

It supports:
- HTML and plain-text emails
- English and Spanish date formats
- Multiple email patterns from Airbnb

## Manual CSV Import (Fallback)

If Gmail sync doesn't work, you can still import reservations from CSV:

```bash
curl -X POST http://localhost:3000/api/sync/csv-import \
  -H 'Authorization: Bearer YOUR_CRON_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"csv": "Propiedad,Huesped,Listing,Check_in,Check_out,Noches,Moneda,Monto,Codigo\n..."}'
```

See the CSV format requirements in the CSV import documentation.
