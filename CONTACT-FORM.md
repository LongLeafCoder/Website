# Contact form deployment

The contact form posts to `/api/contact`. Its implementation lives in `functions_api/contact.js`; `functions/api/contact.js` is the small route adapter Cloudflare Pages requires to expose that endpoint. The implementation validates submissions, verifies Cloudflare Turnstile server-side, and sends email through Resend. Provider secrets are never included in the site's frontend code.

## Configure Cloudflare Pages

1. Create a Turnstile widget for the production site hostname and a Resend account. Verify the sender domain/address with Resend.
2. In the Cloudflare Pages project, open **Settings → Variables and Secrets**. Configure these for the production environment and any preview environment you use:
   - `TURNSTILE_SITE_KEY`: Turnstile's public site key.
   - `TURNSTILE_SECRET_KEY`: Turnstile's secret key; store as a secret.
   - `RESEND_API_KEY`: Resend API key; store as a secret.
   - `CONTACT_EMAIL_FROM`: verified sender, for example `Tarheel Maker <contact@example.com>`.
   - `CONTACT_EMAIL_TO`: destination inbox for submissions.
3. Redeploy after adding or changing variables.

The function checks field lengths and email format, confirms the Turnstile token's hostname and `contact` action, and sets the visitor's email as `Reply-To`. Test a successful submission, invalid email, overlong message, failed verification, and email-provider failure after configuring the production variables.
