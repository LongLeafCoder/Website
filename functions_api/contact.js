const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const MAX_REQUEST_BYTES = 16_384;
const CHAT_META_KEY = "tarheel-maker-secret-chat-v3:meta";
const CHAT_MESSAGE_PREFIX = "tarheel-maker-secret-chat-v3:message:";
const MAX_CHAT_VAULT_BYTES = 4 * 1024 * 1024;
const MAX_CHAT_MESSAGE_BYTES = 128 * 1024;
const textEncoder = new TextEncoder();
let cachedAccessKeys;
let cachedAccessKeysAt = 0;

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

async function handleChatVault(request, env) {
  if (!env.CHAT_VAULTS) {
    return json({ error: "Encrypted chat storage is not configured." }, 503);
  }
  const hostname = new URL(request.url).hostname;
  const isLocalDevelopment = hostname === "localhost" || hostname === "127.0.0.1";
  let claims;
  if (!isLocalDevelopment) {
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
      return json({ error: "Protected chat access is not configured." }, 503);
    }

    let validAccess;
    try {
      validAccess = await verifyAccessRequest(request, env);
    } catch {
      return json({ error: "Protected chat access is unavailable." }, 503);
    }
    if (!validAccess) return json({ error: "Access denied." }, 401);
    claims = validAccess;
  } else {
    claims = {
      email: null,
      localAccountId: request.headers.get("X-Chat-Local-Account"),
    };
  }

  const url = new URL(request.url);
  if (url.pathname === "/api/chat/vault") {
    const stored = await env.CHAT_VAULTS.get(CHAT_META_KEY, { type: "json" });
    if (request.method === "GET") {
      if (!stored) {
        return json({ vault: null, authIndex: null, identityAccountId: null });
      }
      const account = isLocalDevelopment
        ? stored.directory.accounts.find((entry) => entry.id === claims.localAccountId)
        : await findChatAccount(stored.directory, claims.email);
      if (!account && !isLocalDevelopment) {
        return json({ error: "This identity is not invited to chat." }, 403);
      }
      if (isLocalDevelopment && !account) {
        return json({
          vault: stored.vault,
          authIndex: stored.authIndex,
          identityAccountId: null,
          directory: stored.directory,
        });
      }
      if (account && account.role !== "owner") {
        const recipientAuth = stored.authIndex.recipients.find((entry) => entry.accountId === account.id);
        if (!recipientAuth) return json({ error: "Recipient login is not configured." }, 403);
        return json({
          vault: null,
          authIndex: {
            version: stored.authIndex.version,
            admin: null,
            recipients: [{
              accountId: recipientAuth.accountId,
              codeHash: recipientAuth.codeHash,
              publicKey: recipientAuth.publicKey,
              signingPublicKey: recipientAuth.signingPublicKey,
              privateKeyWrapper: recipientAuth.privateKeyWrapper,
            }],
          },
          identityAccountId: account.id,
          directoryView: buildAccountDirectoryView(stored.directory, account.id),
        });
      }
      return json({
        vault: stored.vault,
        authIndex: stored.authIndex,
        identityAccountId: account?.id || null,
        directory: stored.directory,
      });
    }

    if (request.method === "DELETE") {
      const originError = validateRequestOrigin(request);
      if (originError) return originError;
      if (!stored) return json({ ok: true });
      if (isLocalDevelopment) {
        if (claims.localAccountId !== stored.directory.adminAccountId) {
          return json({ error: "Only the admin can erase the vault." }, 403);
        }
      } else if (await hashAccessEmail(claims.email) !== stored.directory.adminEmailHash) {
        return json({ error: "Only the admin can erase the vault." }, 403);
      }
      await deleteChatMessages(env.CHAT_VAULTS);
      await env.CHAT_VAULTS.delete(CHAT_META_KEY);
      return json({ ok: true });
    }

    if (request.method !== "PUT") {
      return new Response(null, { status: 405, headers: { Allow: "GET, PUT, DELETE" } });
    }
    const originError = validateRequestOrigin(request);
    if (originError) return originError;

    const payload = await readJsonBody(request, MAX_CHAT_VAULT_BYTES);
    if (payload instanceof Response) return payload;
    if (!isValidChatMetadata(payload)) {
      return json({ error: "Invalid encrypted chat metadata." }, 400);
    }
    const owner = payload.directory.accounts.find(
      (account) => account.id === payload.directory.adminAccountId && account.role === "owner",
    );
    if (!owner || owner.emailHash !== payload.directory.adminEmailHash) {
      return json({ error: "The admin directory entry is invalid." }, 400);
    }
    if (isLocalDevelopment) {
      if (claims.localAccountId !== payload.directory.adminAccountId) {
        return json({ error: "Only the admin can update chat membership." }, 403);
      }
    } else {
      if (!env.CHAT_ADMIN_EMAIL) {
        return json({ error: "Admin identity is not configured." }, 503);
      }
      const callerHash = await hashAccessEmail(claims.email);
      const configuredAdminHash = await hashAccessEmail(env.CHAT_ADMIN_EMAIL);
      if (payload.directory.adminEmailHash !== configuredAdminHash || callerHash !== configuredAdminHash) {
        return json({ error: "Only the configured admin can update chat membership." }, 403);
      }
      if (stored && stored.directory.adminEmailHash !== callerHash) {
        return json({ error: "Only the existing admin can replace chat metadata." }, 403);
      }
    }

    await env.CHAT_VAULTS.put(CHAT_META_KEY, JSON.stringify(payload));
    return json({ ok: true, updatedAt: payload.vault.updatedAt || null });
  }

  if (url.pathname === "/api/chat/messages" && request.method === "POST") {
    const originError = validateRequestOrigin(request);
    if (originError) return originError;
    const stored = await env.CHAT_VAULTS.get(CHAT_META_KEY, { type: "json" });
    if (!stored) return json({ error: "The chat has not been initialized." }, 404);
    const account = isLocalDevelopment
      ? stored.directory.accounts.find((entry) => entry.id === claims.localAccountId)
      : await findChatAccount(stored.directory, claims.email);
    if (!account) return json({ error: "This identity is not invited to chat." }, 403);

    const message = await readJsonBody(request, MAX_CHAT_MESSAGE_BYTES);
    if (message instanceof Response) return message;
    const memberIds = stored.directory.threads[message?.threadId];
    if (!Array.isArray(memberIds) || !memberIds.includes(account.id) || message.authorId !== account.id) {
      return json({ error: "You are not allowed to send to this conversation." }, 403);
    }
    const envelopeIds = Array.isArray(message.keyEnvelopes)
      ? message.keyEnvelopes.map((entry) => entry.accountId).sort()
      : [];
    if (JSON.stringify(envelopeIds) !== JSON.stringify([...memberIds].sort())) {
      return json({ error: "The encrypted message recipient list does not match the conversation." }, 400);
    }
    const author = stored.directory.accounts.find((entry) => entry.id === account.id);
    if (!author?.signingPublicKey || !(await verifyChatMessage(message, author.signingPublicKey))) {
      return json({ error: "The message signature is invalid." }, 400);
    }
    const key = `${CHAT_MESSAGE_PREFIX}${message.id}`;
    if (await env.CHAT_VAULTS.get(key)) return json({ error: "This message already exists." }, 409);
    await env.CHAT_VAULTS.put(key, JSON.stringify(message));
    return json({ ok: true, messageId: message.id }, 201);
  }

  if (url.pathname === "/api/chat/messages" && request.method === "GET") {
    const stored = await env.CHAT_VAULTS.get(CHAT_META_KEY, { type: "json" });
    if (!stored) return json({ messages: [] });
    const account = isLocalDevelopment
      ? stored.directory.accounts.find((entry) => entry.id === claims.localAccountId)
      : await findChatAccount(stored.directory, claims.email);
    if (!account) return json({ error: "This identity is not invited to chat." }, 403);
    const messages = await readChatMessages(env.CHAT_VAULTS);
    return json({
      messages: messages.filter((message) =>
        stored.directory.threads[message.threadId]?.includes(account.id),
      ),
    });
  }

  if (url.pathname === "/api/chat/messages" && request.method === "DELETE") {
    const originError = validateRequestOrigin(request);
    if (originError) return originError;
    const stored = await env.CHAT_VAULTS.get(CHAT_META_KEY, { type: "json" });
    if (!stored) return json({ ok: true, deleted: 0 });
    if (isLocalDevelopment
      ? claims.localAccountId !== stored.directory.adminAccountId
      : await hashAccessEmail(claims.email) !== stored.directory.adminEmailHash) {
      return json({ error: "Only the admin can wipe message history." }, 403);
    }
    const deleted = await deleteChatMessages(env.CHAT_VAULTS);
    return json({ ok: true, deleted });
  }

  return json({ error: "Not found." }, 404);
}

function validateRequestOrigin(request) {
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return json({ error: "Invalid request origin." }, 403);
  }
  return null;
}

async function readJsonBody(request, maxBytes) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > maxBytes) return json({ error: "Request body is too large." }, 413);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Submit a valid JSON request." }, 400);
  }
  if (textEncoder.encode(JSON.stringify(payload)).byteLength > maxBytes) {
    return json({ error: "Request body is too large." }, 413);
  }
  return payload;
}

function isValidChatMetadata(payload) {
  return Boolean(
    payload?.vault?.version === 3 &&
    typeof payload.vault.iv === "string" &&
    typeof payload.vault.ciphertext === "string" &&
    payload.authIndex?.version === 3 &&
    payload.authIndex.admin &&
    Array.isArray(payload.authIndex.recipients) &&
    typeof payload.directory?.adminAccountId === "string" &&
    typeof payload.directory?.adminEmailHash === "string" &&
    Array.isArray(payload.directory.accounts) &&
    payload.directory.accounts.every((account) =>
      typeof account.id === "string" &&
      typeof account.emailHash === "string" &&
      typeof account.role === "string" &&
      Boolean(account.signingPublicKey),
    ) &&
    payload.directory.threads &&
    typeof payload.directory.threads === "object",
  );
}

async function hashAccessEmail(email) {
  if (typeof email !== "string" || !email.trim()) return "";
  const normalized = email.trim().toLowerCase();
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", textEncoder.encode(`chat-email-v1:${normalized}`)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findChatAccount(directory, email) {
  const emailHash = await hashAccessEmail(email);
  if (!directory || !emailHash) return null;
  return directory.accounts.find((account) => account.emailHash === emailHash) || null;
}

function buildAccountDirectoryView(directory, accountId) {
  const visibleThreads = Object.entries(directory.threads).filter(([, memberIds]) =>
    memberIds.includes(accountId),
  );
  const visibleAccountIds = new Set([directory.adminAccountId, accountId]);
  for (const [, memberIds] of visibleThreads) {
    for (const memberId of memberIds) visibleAccountIds.add(memberId);
  }
  return {
    ownerId: directory.adminAccountId,
    accountId,
    accounts: directory.accounts
      .filter((account) => visibleAccountIds.has(account.id))
      .map(({ id, name, role, publicKey, signingPublicKey }) => ({ id, name, role, publicKey, signingPublicKey })),
    groups: (directory.groups || [])
      .filter((group) => group.memberIds.includes(accountId))
      .map(({ id, name, memberIds }) => ({ id, name, memberIds })),
    threads: Object.fromEntries(visibleThreads),
  };
}

async function readChatMessages(namespace) {
  const messages = [];
  let cursor;
  do {
    const result = await namespace.list({ prefix: CHAT_MESSAGE_PREFIX, limit: 1000, cursor });
    const page = await Promise.all(result.keys.map((key) => namespace.get(key.name, { type: "json" })));
    messages.push(...page.filter(Boolean));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return messages.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

async function deleteChatMessages(namespace) {
  let deleted = 0;
  let cursor;
  do {
    const result = await namespace.list({ prefix: CHAT_MESSAGE_PREFIX, limit: 1000, cursor });
    await Promise.all(result.keys.map((key) => namespace.delete(key.name)));
    deleted += result.keys.length;
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return deleted;
}

function chatMessageSignaturePayload(message) {
  return textEncoder.encode(JSON.stringify({
    id: message.id,
    threadId: message.threadId,
    authorId: message.authorId,
    createdAt: message.createdAt,
    ephemeralPublicKey: message.ephemeralPublicKey,
    messageIv: message.messageIv,
    ciphertext: message.ciphertext,
    keyEnvelopes: message.keyEnvelopes,
  }));
}

async function verifyChatMessage(message, publicKeyJwk) {
  if (!message?.signature || !Array.isArray(message.keyEnvelopes) || !message.ephemeralPublicKey) return false;
  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      decodeBase64Url(message.signature),
      chatMessageSignaturePayload(message),
    );
  } catch {
    return false;
  }
}

const decodeBase64Url = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const decodeJwtJson = (value) =>
  JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));

async function getAccessKeys(teamDomain, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAccessKeys && now - cachedAccessKeysAt < 5 * 60 * 1000) {
    return cachedAccessKeys;
  }

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error("Could not load Access signing keys");
  const document = await response.json();
  if (!Array.isArray(document.keys)) throw new Error("Invalid Access signing keys");
  cachedAccessKeys = document.keys;
  cachedAccessKeysAt = now;
  return cachedAccessKeys;
}

async function verifyAccessRequest(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  let header;
  let claims;
  try {
    header = decodeJwtJson(parts[0]);
    claims = decodeJwtJson(parts[1]);
  } catch {
    return false;
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return false;

  const teamDomain = env.ACCESS_TEAM_DOMAIN
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== `https://${teamDomain}` ||
    !Array.isArray(claims.aud) ||
    !claims.aud.includes(env.ACCESS_AUD) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    (Number.isFinite(claims.iat) && claims.iat > now + 30) ||
    (Number.isFinite(claims.nbf) && claims.nbf > now + 30)
  ) {
    return false;
  }

  let key = (await getAccessKeys(teamDomain)).find((candidate) => candidate.kid === header.kid);
  if (!key) {
    key = (await getAccessKeys(teamDomain, true)).find((candidate) => candidate.kid === header.kid);
  }
  if (!key) return false;

  const verificationKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    verificationKey,
    decodeBase64Url(parts[2]),
    textEncoder.encode(`${parts[0]}.${parts[1]}`),
  );
  return valid ? claims : null;
}

async function onRequestGet(env) {
  if (!hasConfiguration(env)) {
    return json({ error: "The contact form is not configured." }, 503);
  }

  return json({ siteKey: env.TURNSTILE_SITE_KEY });
}

async function onRequestPost(request, env) {
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
    if (!verification.success) {
  console.error("Turnstile rejected:", verification["error-codes"]);
  return json({ error: "Cloudflare rejected verification." }, 400);
  }

  if (verification.hostname !== expectedHostname) {
    console.error("Hostname mismatch:", {
      actual: verification.hostname,
      expected: expectedHostname,
    });
    return json({ error: "Hostname mismatch." }, 400);
  }

  if (verification.action !== "contact") {
    console.error("Action mismatch:", verification.action);
    return json({ error: "Action mismatch." }, 400);
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat/vault") {
      return handleChatVault(request, env);
    }
    if (url.pathname !== "/api/contact") {
      return json({ error: "Not found." }, 404);
    }

    if (request.method === "GET") return onRequestGet(env);
    if (request.method === "POST") return onRequestPost(request, env);

    return new Response(null, {
      status: 405,
      headers: { Allow: "GET, POST" },
    });
  },
};
