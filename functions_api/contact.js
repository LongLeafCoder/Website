const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const MAX_REQUEST_BYTES = 16_384;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const hasConfiguration = (env) =>
  Boolean(
    env.TURNSTILE_SITE_KEY &&
    env.TURNSTILE_SECRET_KEY &&
    env.RESEND_API_KEY &&
    env.CONTACT_EMAIL_FROM &&
    env.CONTACT_EMAIL_TO,
  );

export async function onRequestGet({ env }) {
  if (!hasConfiguration(env)) {
    return json({ error: "The contact form is not configured." }, 503);
  }

  return json({ siteKey: env.TURNSTILE_SITE_KEY });
}

export async function onRequestPost({ request, env }) {
  if (!hasConfiguration(env)) {
    return json({ error: "The contact form is not configured." }, 503);
  }

  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return json({ error: "Invalid request origin." }, 403);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "The submitted form is too large." }, 413);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Submit the contact form to send a message." }, 400);
  }

  if (String(form.get("company") || "").trim()) {
    return json({ ok: true });
  }

  const name = String(form.get("name") || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
  const email = String(form.get("email") || "").trim();
  const message = String(form.get("message") || "").trim();
  const token = String(form.get("cf-turnstile-response") || "");

  if (!name || name.length > 100) {
    return json({ error: "Enter a name of 1 to 100 characters." }, 400);
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid email address." }, 400);
  }
  if (!message || message.length > 5000) {
    return json({ error: "Enter a message of 1 to 5,000 characters." }, 400);
  }
  if (!token || token.length > 2048) {
    return json(
      { error: "Complete the verification challenge and try again." },
      400,
    );
  }

  const verificationBody = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) verificationBody.set("remoteip", clientIp);

  try {
    const verificationResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: verificationBody,
    });
    if (!verificationResponse.ok) {
      return json(
        { error: "Verification is temporarily unavailable. Please try again." },
        502,
      );
    }

    const verification = await verificationResponse.json();
    const expectedHostname = new URL(request.url).hostname;
    if (
      !verification.success ||
      verification.hostname !== expectedHostname ||
      verification.action !== "contact"
    ) {
      return json({ error: "Verification failed. Please try again." }, 400);
    }

    const emailResponse = await fetch(RESEND_EMAIL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_EMAIL_FROM,
        to: [env.CONTACT_EMAIL_TO],
        reply_to: email,
        subject: `Website contact from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      }),
    });

    if (!emailResponse.ok) {
      console.error(
        "Contact email provider returned status",
        emailResponse.status,
      );
      return json(
        {
          error:
            "Your message could not be sent right now. Please try again later.",
        },
        502,
      );
    }

    return json({ ok: true });
  } catch {
    return json(
      {
        error:
          "Your message could not be sent right now. Please try again later.",
      },
      502,
    );
  }
}
