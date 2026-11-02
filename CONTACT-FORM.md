# Contact form deployment

The contact form posts to `/api/contact`. Its Worker entry point is `functions_api/contact.js`, which handles only the contact API. Cloudflare Workers Static Assets serves the site's static files; the handler does not require an `ASSETS` binding. The implementation validates submissions, verifies Cloudflare Turnstile server-side, and sends email through Resend. Provider secrets are never included in the site's frontend code.

## Configure the Cloudflare Worker

1. Create a Turnstile widget for the production site hostname and a Resend account. Verify the sender domain/address with Resend.
2. The repository's `wrangler.jsonc` sets `functions_api/contact.js` as the Worker entry point and the root as the static asset directory. `.assetsignore` limits published files to the site content. `/api/*` requests run through the Worker before asset fallback.
3. Set these values for the Worker in Cloudflare's dashboard:
   - `TURNSTILE_SITE_KEY`: Turnstile's public site key.
   - `TURNSTILE_SECRET_KEY`: Turnstile's secret key; store as a secret.
   - `RESEND_API_KEY`: Resend API key; store as a secret.
   - `CONTACT_EMAIL_FROM`: verified sender, for example `Tarheel Maker <contact@example.com>`.
   - `CONTACT_EMAIL_TO`: destination inbox for submissions.
4. From the repository root, authenticate with `npx wrangler login`. If the Worker is already deployed, you can set its secrets with `npx wrangler secret put TURNSTILE_SECRET_KEY` and `npx wrangler secret put RESEND_API_KEY`. If it is a new Worker, deploy it first, then run those secret commands.
5. Run `npx wrangler deploy --dry-run` to validate the bundle, then deploy with `npx wrangler deploy --keep-vars` so dashboard-configured variables are preserved. Change `name` in `wrangler.jsonc` to your existing Worker name if it is not `longleaf-website`, otherwise Wrangler will create/update a Worker with the configured name.
6. In the Worker dashboard, attach the production domain under **Settings → Domains & Routes** if it is not already attached.

The function checks field lengths and email format, confirms the Turnstile token's hostname and `contact` action, and sets the visitor's email as `Reply-To`. Test a successful submission, invalid email, overlong message, failed verification, and email-provider failure after configuring the production variables.
