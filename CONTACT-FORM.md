# Contact form deployment

The contact form posts to `/api/contact`. Its Worker entry point is `functions_api/contact.js`, which handles only the contact API. Cloudflare Workers Static Assets serves the site's static files; the handler does not require an `ASSETS` binding. The implementation validates submissions, verifies Cloudflare Turnstile server-side, and sends email through Resend. Provider secrets are never included in the site's frontend code.

## Configure the Cloudflare Worker

1. Create a Turnstile widget for the production site hostname and a Resend account. Verify the sender domain/address with Resend.
2. Set `functions_api/contact.js` as the Worker entry point and configure the site's static asset directory. Ensure `/api/*` requests reach the Worker before any asset fallback (for Wrangler, configure `assets.run_worker_first = ["/api/*"]`).
3. In the Worker settings, configure these variables and secrets for each environment:
   - `TURNSTILE_SITE_KEY`: Turnstile's public site key.
   - `TURNSTILE_SECRET_KEY`: Turnstile's secret key; store as a secret.
   - `RESEND_API_KEY`: Resend API key; store as a secret.
   - `CONTACT_EMAIL_FROM`: verified sender, for example `Tarheel Maker <contact@example.com>`.
   - `CONTACT_EMAIL_TO`: destination inbox for submissions.
4. Deploy the Worker after changing its settings or variables.

The function checks field lengths and email format, confirms the Turnstile token's hostname and `contact` action, and sets the visitor's email as `Reply-To`. Test a successful submission, invalid email, overlong message, failed verification, and email-provider failure after configuring the production variables.
