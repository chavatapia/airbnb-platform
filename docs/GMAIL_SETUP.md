# Gmail Synchronization Setup (Personal Gmail Account)

## Which path applies to you

This repo has **two ways** to turn Airbnb confirmation emails into `Reservation` rows:

1. **Primary: the existing SendGrid Inbound Parse webhook** (`/api/webhooks/airbnb-email`). Your personal Gmail already forwards Airbnb mail here (this is how guest-message replies via WhatsApp already work). It's been extended to also detect reservation confirmation/cancellation subjects and upsert reservations — **no new setup needed**, since the forwarding is already in place.
2. **Fallback: the Gmail OAuth sync** (`/api/sync/gmail`), documented below. Use this only if the SendGrid forwarding breaks, or as a redundant scheduled sync. It requires creating a Google Cloud OAuth app and granting consent, which is more setup than option 1.

If reservations are already showing up correctly via WhatsApp/guest messages, option 1 is doing its job and you likely don't need to set up OAuth at all. The rest of this document covers option 2.

## Overview (OAuth fallback)

The Gmail sync endpoint fetches Airbnb confirmation emails from your Gmail inbox via the Gmail API and imports them into the database, extracting:
- Confirmation codes (HM-format)
- Guest names
- Check-in and check-out dates
- Property information

Since Airbnb sends to your **personal Gmail account**, authentication uses **OAuth 2.0 with your explicit consent** — there's no service account or domain-wide delegation involved (those only work with Google Workspace).

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable the **Gmail API**:
   - Go to APIs & Services → Library
   - Search for "Gmail API"
   - Click it and press "Enable"

### 2. Configure the OAuth Consent Screen

1. Go to APIs & Services → OAuth consent screen
2. User type: **External** (unless you have Workspace)
3. Fill in app name (e.g. "Airbnb Platform Sync"), your email as support contact
4. Scopes: add `https://www.googleapis.com/auth/gmail.readonly`
5. Test users: add your own Gmail address (required while the app is "Testing" — it won't be publicly reviewed)

### 3. Create an OAuth 2.0 Client ID

1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: `airbnb-platform`
5. Authorized redirect URIs, add both:
   - `http://localhost:3000/api/auth/gmail/callback` (for local dev)
   - `https://YOUR_PRODUCTION_DOMAIN/api/auth/gmail/callback` (for production)
6. Click "Create" — copy the **Client ID** and **Client Secret**

### 4. Configure Environment Variables

Add to `.env.local` (and your production environment):

```bash
GMAIL_CLIENT_ID="XXXXXXXXXX.apps.googleusercontent.com"
GMAIL_CLIENT_SECRET="XXXXXXXXXXXXXXXXXXXXXXXX"
GMAIL_REDIRECT_URI="http://localhost:3000/api/auth/gmail/callback"
```

Leave `GMAIL_REFRESH_TOKEN` unset for now — you'll get it in the next step.

### 5. Grant Consent and Get a Refresh Token

1. Start (or redeploy) the app with the variables above set
2. In your browser, while logged into the **Gmail account that receives Airbnb emails**, visit:

   ```
   http://localhost:3000/api/auth/gmail?secret=YOUR_CRON_SECRET
   ```

3. You'll be redirected to Google's consent screen — approve read-only Gmail access
4. Google redirects back to `/api/auth/gmail/callback`, which displays a **refresh token**
5. Copy that value into `.env.local`:

   ```bash
   GMAIL_REFRESH_TOKEN="1//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
   ```

6. Restart the app so it picks up the new variable

**Important:** Google only shows the refresh token the first time you grant consent for a given app. If you lose it, revoke access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and repeat step 5 — the `prompt=consent` flag forces a new refresh token to be issued.

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

### Error: "GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REDIRECT_URI must be set"

**Solution:** Make sure all three are in `.env.local` and the dev server was restarted.

### Error: "GMAIL_REFRESH_TOKEN environment variable not set"

**Solution:** Complete step 5 (the consent flow) — this token can only be obtained by visiting `/api/auth/gmail` in a browser.

### Error: "No refresh token returned"

**Cause:** You already granted consent before, so Google skipped issuing a new refresh token.
**Solution:** Revoke access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) for the app, then visit `/api/auth/gmail?secret=...` again.

### Error: "invalid_grant" when syncing

**Cause:** The refresh token was revoked or expired (this can happen if the OAuth consent screen is still in "Testing" mode — Google expires test tokens after 7 days).
**Solution:** Either publish the OAuth consent screen (moves it out of testing) or repeat the consent flow periodically. For long-term production use, publishing the app (even without full verification, since you're the only user) avoids the 7-day expiry.

### No emails found

**Possible causes:**
1. The search query doesn't match how Airbnb emails look in your inbox
2. All matching emails are older than expected, or already read (if using `is:unread`)

**Solution:** Adjust the query passed to `getAirbnbEmails()` in `app/api/sync/gmail/route.ts` — e.g. remove `is:unread`, or change the sender filter to match what actually shows in your inbox (check the "from" address on a real Airbnb confirmation email).

## How It Works

1. The sync endpoint is called every 30 minutes by Vercel Cron (configure this in `vercel.json`)
2. It fetches Airbnb emails from the last 30 days using the Gmail API (via your OAuth refresh token)
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
- HTML and plain-text emails (including nested multipart MIME structures)
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
