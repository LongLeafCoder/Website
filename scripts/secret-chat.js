(() => {
  const STORAGE_KEY = "tarheel-maker-secret-chat-e2ee-v2";
  const AUTH_INDEX_KEY = "tarheel-maker-secret-chat-e2ee-auth-v2";
  const REMEMBER_DB_NAME = "tarheel-maker-secret-chat-session-v1";
  const CHAT_VAULT_API = "/api/chat/vault";
  const ITERATIONS = 310000;
  const app = document.getElementById("chat-app");
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let vaultKey;
  let activeIdentity;
  let state;
  let activeUserId;
  let selectedThreadId;
  let latestInvite;
  let cloudSyncStatus = "Checking encrypted cloud backup…";
  let cloudIdentityAccountId;
  let messageHistory = [];
  let sessionDbPromise;

  const bytesToBase64 = (bytes) => {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  };

  const base64ToBytes = (value) =>
    Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
    );

  const makeId = () => crypto.randomUUID();

  const isLocalRuntime = () =>
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  const chatApiHeaders = (includeJson = false) => {
    const headers = new Headers({ Accept: "application/json" });
    if (includeJson) headers.set("Content-Type", "application/json");
    if (isLocalRuntime() && activeUserId) {
      headers.set("X-Chat-Local-Account", activeUserId);
    }
    return headers;
  };

  const deriveVaultKey = async (passphrase, salt) => {
    const material = await crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  };

  const createDataKey = async () =>
    crypto.subtle.importKey(
      "raw",
      crypto.getRandomValues(new Uint8Array(32)),
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );

  const wrapDataKey = async (code, dataKey) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappingKey = await deriveVaultKey(code, salt);
    const rawKey = await crypto.subtle.exportKey("raw", dataKey);
    const wrappedKey = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrappingKey,
      rawKey,
    );
    return {
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
    };
  };

  const unwrapDataKey = async (code, wrapper) => {
    const wrappingKey = await deriveVaultKey(code, base64ToBytes(wrapper.salt));
    const rawKey = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(wrapper.iv) },
      wrappingKey,
      base64ToBytes(wrapper.wrappedKey),
    );
    return crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
  };

  const wrapBytes = async (code, bytes) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappingKey = await deriveVaultKey(code, salt);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrappingKey,
      bytes,
    );
    return {
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
  };

  const unwrapBytes = async (code, wrapper) => {
    const wrappingKey = await deriveVaultKey(code, base64ToBytes(wrapper.salt));
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(wrapper.iv) },
      wrappingKey,
      base64ToBytes(wrapper.ciphertext),
    );
  };

  const createIdentity = async (code) => {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const signingPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const privateJwk = {
      ecdh: await crypto.subtle.exportKey("jwk", pair.privateKey),
      signing: await crypto.subtle.exportKey("jwk", signingPair.privateKey),
    };
    return {
      publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey),
      signingPublicKey: await crypto.subtle.exportKey("jwk", signingPair.publicKey),
      ecdhPrivateKey: pair.privateKey,
      signingPrivateKey: signingPair.privateKey,
      privateKeyWrapper: await wrapBytes(code, encoder.encode(JSON.stringify(privateJwk))),
    };
  };

  const unlockIdentity = async (code, wrapper) => {
    const privateJwk = JSON.parse(decoder.decode(await unwrapBytes(code, wrapper)));
    const [ecdhPrivateKey, signingPrivateKey] = await Promise.all([
      crypto.subtle.importKey(
        "jwk",
        privateJwk.ecdh,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveBits"],
      ),
      crypto.subtle.importKey(
        "jwk",
        privateJwk.signing,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      ),
    ]);
    return { ecdhPrivateKey, signingPrivateKey };
  };

  const hashCode = async (code) =>
    bytesToBase64(
      new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(code))),
    );

  const hashAccessEmail = async (email) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          encoder.encode(`chat-email-v1:${email.trim().toLowerCase()}`),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");

  const deriveMessageWrappingKey = async (privateKey, publicJwk, salt, info) => {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      publicJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const sharedBits = await crypto.subtle.deriveBits(
      { name: "ECDH", public: publicKey },
      privateKey,
      256,
    );
    const material = await crypto.subtle.importKey(
      "raw",
      sharedBits,
      "HKDF",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: encoder.encode(info) },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  };

  const messageSignaturePayload = (message) =>
    encoder.encode(JSON.stringify({
      id: message.id,
      threadId: message.threadId,
      authorId: message.authorId,
      createdAt: message.createdAt,
      ephemeralPublicKey: message.ephemeralPublicKey,
      messageIv: message.messageIv,
      ciphertext: message.ciphertext,
      keyEnvelopes: message.keyEnvelopes,
    }));

  const encryptMessage = async (text, threadId, authorId, participants, signingPrivateKey) => {
    const id = makeId();
    const messageIv = crypto.getRandomValues(new Uint8Array(12));
    const contentKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const contentKey = await crypto.subtle.importKey(
      "raw",
      contentKeyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: messageIv },
      contentKey,
      encoder.encode(text),
    );
    const ephemeralPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const ephemeralPublicKey = await crypto.subtle.exportKey("jwk", ephemeralPair.publicKey);
    const uniqueParticipants = [...new Map(participants.map((account) => [account.id, account])).values()];
    const keyEnvelopes = [];

    for (const participant of uniqueParticipants) {
      if (!participant.publicKey) throw new Error("A conversation member is missing an encryption key.");
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const wrappingIv = crypto.getRandomValues(new Uint8Array(12));
      const wrappingKey = await deriveMessageWrappingKey(
        ephemeralPair.privateKey,
        participant.publicKey,
        salt,
        `chat-v1:${id}:${threadId}:${participant.id}`,
      );
      const wrappedKey = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: wrappingIv },
        wrappingKey,
        contentKeyBytes,
      );
      keyEnvelopes.push({
        accountId: participant.id,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(wrappingIv),
        wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
      });
    }

    const message = {
      id,
      threadId,
      authorId,
      createdAt: new Date().toISOString(),
      ephemeralPublicKey,
      messageIv: bytesToBase64(messageIv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
      keyEnvelopes,
    };
    message.signature = bytesToBase64(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          signingPrivateKey,
          messageSignaturePayload(message),
        ),
      ),
    );
    return message;
  };

  const decryptMessage = async (message, accountId, privateKey, signingPublicJwk) => {
    const envelope = message.keyEnvelopes.find((item) => item.accountId === accountId);
    if (!envelope) throw new Error("This account is not a recipient of the message.");
    if (!signingPublicJwk || !message.signature) throw new Error("Message signature is missing.");
    const signingPublicKey = await crypto.subtle.importKey(
      "jwk",
      signingPublicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const isAuthentic = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      signingPublicKey,
      base64ToBytes(message.signature),
      messageSignaturePayload(message),
    );
    if (!isAuthentic) throw new Error("Message signature is invalid.");
    const wrappingKey = await deriveMessageWrappingKey(
      privateKey,
      message.ephemeralPublicKey,
      base64ToBytes(envelope.salt),
      `chat-v1:${message.id}:${message.threadId}:${accountId}`,
    );
    const contentKeyBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      wrappingKey,
      base64ToBytes(envelope.wrappedKey),
    );
    const contentKey = await crypto.subtle.importKey(
      "raw",
      contentKeyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(message.messageIv) },
      contentKey,
      base64ToBytes(message.ciphertext),
    );
    return decoder.decode(plaintext);
  };

  const persistVault = async (syncMetadata = false) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      vaultKey,
      encoder.encode(JSON.stringify(state)),
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 3,
        updatedAt: new Date().toISOString(),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
      }),
    );
    return syncMetadata ? syncVaultToCloud() : true;
  };

  const persistAuthIndex = (authIndex) =>
    localStorage.setItem(AUTH_INDEX_KEY, JSON.stringify(authIndex));

  const openSessionDatabase = () => {
    if (!sessionDbPromise) {
      sessionDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(REMEMBER_DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("sessions");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return sessionDbPromise;
  };

  const saveRememberedSession = async () => {
    try {
      const database = await openSessionDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("sessions", "readwrite");
        transaction.objectStore("sessions").put(
          { accountId: activeUserId, vaultKey, identity: activeIdentity },
          "active",
        );
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      return true;
    } catch {
      return false;
    }
  };

  const loadRememberedSession = async () => {
    try {
      const database = await openSessionDatabase();
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction("sessions", "readonly");
        const request = transaction.objectStore("sessions").get("active");
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  };

  const clearRememberedSession = async () => {
    try {
      const database = await openSessionDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("sessions", "readwrite");
        transaction.objectStore("sessions").delete("active");
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      sessionDbPromise = undefined;
    }
  };

  const buildChatDirectory = () => {
    const owner = state.accounts.find((account) => account.id === state.ownerId);
    const threads = {};
    for (const recipient of state.accounts.filter((account) => account.id !== state.ownerId)) {
      const members = [state.ownerId, recipient.id];
      const threadId = `direct:${[state.ownerId, recipient.id].sort().join(":")}`;
      threads[threadId] = members;
    }
    for (const group of state.groups) threads[`group:${group.id}`] = [...group.memberIds];
    return {
      adminAccountId: state.ownerId,
      adminEmailHash: owner.accessEmailHash,
      accounts: state.accounts.map((account) => ({
        id: account.id,
        emailHash: account.accessEmailHash,
        role: account.role,
        signingPublicKey: account.signingPublicKey,
      })),
      threads,
    };
  };

  const syncVaultToCloud = async () => {
    const vaultText = localStorage.getItem(STORAGE_KEY);
    const authIndexText = localStorage.getItem(AUTH_INDEX_KEY);
    if (!vaultText || !authIndexText) return false;

    try {
      const response = await fetch(CHAT_VAULT_API, {
        method: "PUT",
        headers: chatApiHeaders(true),
        body: JSON.stringify({
          vault: JSON.parse(vaultText),
          authIndex: JSON.parse(authIndexText),
          directory: buildChatDirectory(),
        }),
      });
      if (!response.ok) throw new Error("Cloud vault update failed");
      cloudSyncStatus = "Encrypted history synced to Cloudflare";
      return true;
    } catch {
      cloudSyncStatus = "Cloud sync unavailable; changes are only on this device";
      return false;
    }
  };

  const refreshMessageHistory = async () => {
    const response = await fetch("/api/chat/messages", {
      headers: chatApiHeaders(),
    });
    if (!response.ok) throw new Error("Could not load encrypted message history");
    const result = await response.json();
    messageHistory = result.messages || [];
  };

  const restoreCloudVault = async () => {
    try {
      const response = await fetch(CHAT_VAULT_API, {
        headers: chatApiHeaders(),
      });
      if (!response.ok) throw new Error("Cloud vault could not be loaded");
      const remote = await response.json();
      cloudIdentityAccountId = remote.identityAccountId || null;

      if (remote.vault && remote.authIndex) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote.vault));
        localStorage.setItem(AUTH_INDEX_KEY, JSON.stringify(remote.authIndex));
        cloudSyncStatus = "Encrypted history synced to Cloudflare";
        return true;
      }

      cloudSyncStatus = "Cloud vault ready; create the admin code to initialize it";
      return true;
    } catch {
      cloudSyncStatus = "Cloud vault unavailable; this browser cannot sync yet";
      return false;
    }
  };

  const decryptState = async (envelope, dataKey) => {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      dataKey,
      base64ToBytes(envelope.ciphertext),
    );
    return JSON.parse(decoder.decode(plaintext));
  };

  const unlockVault = async (code) => {
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const savedIndex = localStorage.getItem(AUTH_INDEX_KEY);
    const authIndex = savedIndex ? JSON.parse(savedIndex) : null;

    let accountId;
    if (authIndex?.admin) {
      try {
        vaultKey = await unwrapDataKey(code, authIndex.admin);
        accountId = authIndex.admin.accountId;
        activeIdentity = await unlockIdentity(code, authIndex.admin.privateKeyWrapper);
      } catch {
        const codeHash = await hashCode(code);
        const recipient = authIndex.recipients.find((entry) => entry.codeHash === codeHash);
        if (!recipient) throw new Error("Code not found");
        vaultKey = await unwrapDataKey(code, recipient);
        activeIdentity = await unlockIdentity(code, recipient.privateKeyWrapper);
        accountId = recipient.accountId;
      }
    } else {
      throw new Error("Login codes are unavailable");
    }

    if (envelope.version !== 3 || authIndex.version !== 3) {
      throw new Error("Unsupported encrypted-vault version");
    }
    state = await decryptState(envelope, vaultKey);
    if (!state.accounts.some((account) => account.id === accountId)) {
      throw new Error("Account not found");
    }
    if (cloudIdentityAccountId && cloudIdentityAccountId !== accountId) {
      throw new Error("This login code belongs to a different Access identity.");
    }
    return { accountId };
  };

  const createVault = async (adminCode, adminEmail) => {
    const identity = await createIdentity(adminCode);
    state = {
      ownerId: "owner",
      accounts: [{
        id: "owner",
        name: "Admin",
        role: "owner",
        accessEmailHash: await hashAccessEmail(adminEmail),
        publicKey: identity.publicKey,
        signingPublicKey: identity.signingPublicKey,
      }],
      invites: [],
      groups: [],
      messages: [],
    };
    vaultKey = await createDataKey();
    activeIdentity = {
      ecdhPrivateKey: identity.ecdhPrivateKey,
      signingPrivateKey: identity.signingPrivateKey,
    };
    persistAuthIndex({
      version: 3,
      admin: {
        accountId: state.ownerId,
        publicKey: identity.publicKey,
        signingPublicKey: identity.signingPublicKey,
        privateKeyWrapper: identity.privateKeyWrapper,
        ...(await wrapDataKey(adminCode, vaultKey)),
      },
      recipients: [],
    });
    activeUserId = state.ownerId;
    await persistVault();
    if (!(await syncVaultToCloud())) {
      throw new Error("Could not initialize the encrypted cloud vault.");
    }
    return { accountId: state.ownerId };
  };

  const showAuth = (message = "") => {
    const hasVault = Boolean(localStorage.getItem(STORAGE_KEY));
    const hasLegacyVault = [
      "tarheel-maker-secret-chat-prototype-v1",
      "tarheel-maker-secret-chat-e2ee-v1",
    ].some((key) => localStorage.getItem(key));
    app.innerHTML = `
      <section class="auth-panel">
        <div class="eyebrow">Invite-only / local prototype</div>
        <h2>${hasVault ? "Sign in" : "Create admin access"}</h2>
        <p>${hasVault
          ? "Enter your admin code or the login code created for you."
          : "Create an admin code to protect the encrypted vault keys. Keep it safe; it cannot be reset."}</p>
        <p class="local-note" role="status">${escapeHtml(cloudSyncStatus)}</p>
        ${!hasVault && hasLegacyVault ? `<p>Older prototype history uses a shared key and will not be imported into this E2EE test vault.</p>` : ""}
        <form id="vault-form">
          ${hasVault ? "" : `<div class="field"><label for="admin-email">Admin email in Cloudflare Access</label><input id="admin-email" name="adminEmail" type="email" autocomplete="email" required /></div>`}
          <div class="field">
            <label for="login-code">${hasVault ? "Admin code or invite code" : "Admin code"}</label>
            <input id="login-code" name="code" type="password" autocomplete="${hasVault ? "current-password" : "new-password"}" minlength="12" required />
            <button class="button button-secondary" id="toggle-login-code" type="button" aria-controls="login-code" aria-pressed="false">Show code</button>
          </div>
          <label class="remember-row"><input name="rememberDevice" type="checkbox" checked /> Remember this device</label>
          <p class="remember-warning">Keeps unlocked keys in this browser’s IndexedDB. Use only on a device you trust.</p>
          <p class="auth-error" id="auth-error" role="alert">${escapeHtml(message)}</p>
          <button class="button" type="submit">${hasVault ? "Sign in" : "Create admin code"}</button>
        </form>
      </section>`;

    const loginCode = app.querySelector("#login-code");
    const toggleLoginCode = app.querySelector("#toggle-login-code");
    toggleLoginCode.addEventListener("click", () => {
      const showCode = loginCode.type === "password";
      loginCode.type = showCode ? "text" : "password";
      toggleLoginCode.textContent = showCode ? "Hide code" : "Show code";
      toggleLoginCode.setAttribute("aria-pressed", String(showCode));
    });

    app.querySelector("#vault-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const code = String(form.get("code") || "").trim();
      const adminEmail = String(form.get("adminEmail") || "").trim();
      const error = app.querySelector("#auth-error");
      if (code.length < 12) {
        error.textContent = "Use a code with at least 12 characters.";
        return;
      }
      if (!hasVault && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        error.textContent = "Enter the admin email allowed by Cloudflare Access.";
        return;
      }

      try {
        const result = hasVault ? await unlockVault(code) : await createVault(code, adminEmail);
        if (cloudIdentityAccountId && result.accountId !== cloudIdentityAccountId) {
          throw new Error("This code belongs to a different Access identity.");
        }
        activeUserId = result.accountId;
        if (!cloudIdentityAccountId) cloudIdentityAccountId = activeUserId;
        await refreshMessageHistory();
        if (form.get("rememberDevice") === "on") {
          await saveRememberedSession();
        } else {
          await clearRememberedSession();
        }
        await renderWorkspace();
      } catch {
        vaultKey = undefined;
        activeIdentity = undefined;
        state = undefined;
        showAuth(hasVault ? "That code was not recognized on this browser." : "Could not create the local vault in this browser.");
      }
    });
  };

  const activeAccount = () =>
    state.accounts.find((account) => account.id === activeUserId) ||
    state.accounts.find((account) => account.id === state.ownerId);

  const isOwner = () => activeAccount()?.role === "owner";

  const directThreadId = (firstAccountId, secondAccountId) =>
    `direct:${[firstAccountId, secondAccountId].sort().join(":")}`;

  const visibleThreads = () => {
    const current = activeAccount();
    const owner = state.accounts.find((account) => account.id === state.ownerId);
    const directThreads = isOwner()
      ? state.accounts
          .filter((account) => account.id !== state.ownerId)
          .map((account) => ({
            id: directThreadId(owner.id, account.id),
            type: "direct",
            title: account.name,
            members: [owner, account],
          }))
      : [{ id: directThreadId(owner.id, current.id), type: "direct", title: owner.name, members: [owner, current] }];
    const groupThreads = state.groups
      .filter((group) => group.memberIds.includes(current.id))
      .map((group) => ({
        id: `group:${group.id}`,
        type: "group",
        title: group.name,
        members: state.accounts.filter((account) => group.memberIds.includes(account.id)),
      }));
    return { directThreads, groupThreads, all: [...directThreads, ...groupThreads] };
  };

  const removeRecipientFromState = (vault, accountId) => {
    const recipient = vault.accounts.find(
      (account) => account.id === accountId && account.role === "recipient",
    );
    if (!recipient) return null;

    const removedGroups = new Set();
    const updatedGroups = vault.groups.map((group) => {
      const memberIds = group.memberIds.filter((memberId) => memberId !== accountId);
      if (memberIds.length <= 1) removedGroups.add(group.id);
      return { ...group, memberIds };
    });
    vault.accounts = vault.accounts.filter((account) => account.id !== accountId);
    vault.invites = vault.invites.filter((invite) => invite.accountId !== accountId);
    vault.groups = updatedGroups.filter((group) => !removedGroups.has(group.id));
    vault.messages = vault.messages
      .map((message) =>
        message.authorId === accountId
          ? {
              ...message,
              authorName: recipient.name,
              authorSigningPublicKey: recipient.signingPublicKey,
            }
          : message,
      )
      .filter((message) => {
        if (message.threadId === `direct:${accountId}`) return false;
        if (message.threadId.startsWith("group:")) {
          return !removedGroups.has(message.threadId.slice("group:".length));
        }
        return true;
      });

    return { recipient, removedGroups };
  };

  const makeMessageMarkup = (message) => {
    const author = state.accounts.find((account) => account.id === message.authorId);
    const mine = message.authorId === activeAccount().id;
    const date = new Date(message.createdAt);
    return `<article class="message${mine ? " mine" : ""}">
      <div class="message-author">${escapeHtml(author?.name || message.authorName || "Unknown account")}</div>
      <div class="message-text">${escapeHtml(message.text)}</div>
      <div class="message-time">${escapeHtml(date.toLocaleString())}</div>
    </article>`;
  };

  const adminToolsMarkup = () => {
    if (!isOwner()) return "";
    const recipients = state.accounts.filter((account) => account.id !== state.ownerId);
    const inviteRows = state.invites.length
      ? state.invites.map((invite) => `
          <div class="invite-code">
            <strong>${escapeHtml(invite.label)}</strong><br />
            ${latestInvite?.accountId === invite.accountId
              ? `<code>${escapeHtml(latestInvite.code)}</code><button class="button button-secondary" type="button" data-action="copy-invite" data-code="${escapeHtml(latestInvite.code)}">Copy code</button>`
              : `<span>Code issued; not stored. Remove and re-invite if lost.</span>`}
          </div>`).join("")
      : `<p>No invitations created yet.</p>`;
    const recipientRows = recipients.length
      ? recipients.map((account) => `
          <div class="recipient-row">
            <span>${escapeHtml(account.name)}</span>
            <button class="button button-danger" type="button" data-action="remove-recipient" data-account-id="${escapeHtml(account.id)}">Remove</button>
          </div>`).join("")
      : `<p>No recipients yet.</p>`;
    const memberChecks = recipients.map((account) => `
      <label class="member-check"><input type="checkbox" name="memberId" value="${escapeHtml(account.id)}" /> ${escapeHtml(account.name)}</label>`).join("");

    return `<div class="admin-menu" aria-label="Admin menus">
      <details class="admin-menu-section">
        <summary>Recipients <span>${recipients.length}</span></summary>
        <div class="admin-menu-content">
          <form id="invite-form">
            <div class="field"><label for="invite-label">New recipient</label><input id="invite-label" name="label" maxlength="60" required /></div>
            <div class="field"><label for="invite-email">Recipient email allowed by Access</label><input id="invite-email" name="email" type="email" autocomplete="email" required /></div>
            <p class="form-error" data-form-error="invite" role="alert"></p>
            <button class="button" type="submit">Create login code</button>
          </form>
          <div class="recipient-list" aria-label="All recipients">${recipientRows}</div>
          <h3>Login codes</h3>
          <div aria-live="polite">${inviteRows}</div>
        </div>
      </details>
      <details class="admin-menu-section">
        <summary>Groups <span>${state.groups.length}</span></summary>
        <div class="admin-menu-content">
          <p>Only group members can see its conversation.</p>
          ${recipients.length ? `<form id="group-form">
            <div class="field"><label for="group-name">Group name</label><input id="group-name" name="groupName" maxlength="60" required /></div>
            <div class="member-checks">${memberChecks}</div>
            <p class="form-error" data-form-error="group" role="alert"></p>
            <button class="button" type="submit">Create group</button>
          </form>` : `<p>Add a recipient before creating a group.</p>`}
          ${state.groups.length ? `<div class="recipient-list">${state.groups.map((group) => `<div class="recipient-row"><span>${escapeHtml(group.name)}</span><span class="group-count">${group.memberIds.length} members</span></div>`).join("")}</div>` : ""}
        </div>
      </details>
      <details class="admin-menu-section">
        <summary>Admin controls</summary>
        <div class="admin-menu-content">
          <p>Wipe message history from this browser’s local vault.</p>
          <button class="button button-danger" type="button" data-action="wipe-messages">Wipe all messages</button>
          <button class="button button-danger" type="button" data-action="erase-vault">Erase local vault</button>
        </div>
      </details>
    </div>`;
  };

  const renderWorkspace = async () => {
    const current = activeAccount();
    const { directThreads, groupThreads, all } = visibleThreads();
    if (!all.some((thread) => thread.id === selectedThreadId)) {
      selectedThreadId = all[0]?.id || null;
    }
    const selected = all.find((thread) => thread.id === selectedThreadId);
    const encryptedMessages = selected
      ? messageHistory.filter((message) => message.threadId === selected.id)
      : [];
    const messages = await Promise.all(encryptedMessages.map(async (message) => {
      try {
        const author = state.accounts.find((account) => account.id === message.authorId);
        return {
          ...message,
          text: await decryptMessage(
            message,
            activeUserId,
            activeIdentity?.ecdhPrivateKey,
            author?.signingPublicKey || message.authorSigningPublicKey,
          ),
        };
      } catch {
        return { ...message, text: "This message could not be decrypted by this account." };
      }
    }));
    const members = selected?.type === "group"
      ? selected.members.map((account) => account.name).join(", ")
      : "Private conversation";
    const accountLabel = `<div class="account-row"><span class="eyebrow">Signed in as</span><strong>${isOwner() ? "Admin" : escapeHtml(current.name)}</strong></div>`;
    const threadButtons = (threads) => threads.map((thread) => `
      <button class="thread-button" type="button" data-thread-id="${escapeHtml(thread.id)}" aria-current="${thread.id === selectedThreadId}">
        <span class="thread-mark" aria-hidden="true">${thread.type === "group" ? "G" : escapeHtml(thread.title.slice(0, 1).toUpperCase())}</span>
        <span class="thread-label">${escapeHtml(thread.title)}</span>
      </button>`).join("");

    app.innerHTML = `<section class="workspace" aria-label="Private chat prototype">
      <aside class="chat-sidebar">
        ${accountLabel}
        <div class="list-heading">Direct messages</div>
        <div class="thread-list">${threadButtons(directThreads) || `<p class="message-empty">No invited recipients yet.</p>`}</div>
        <div class="list-heading">Groups</div>
        <div class="thread-list">${threadButtons(groupThreads) || `<p class="message-empty">No groups available.</p>`}</div>
        <div class="sidebar-actions">
          <button class="button button-secondary" type="button" data-action="lock-vault">Lock</button>
        </div>
        ${adminToolsMarkup()}
      </aside>
      <section class="chat-main" aria-label="Conversation">
        <header class="chat-topbar">
          <div><h2>${escapeHtml(selected?.title || "No conversation selected")}</h2><p>${selected?.type === "group" ? "Group conversation" : selected ? "Direct message" : "Create an invite to begin"}</p></div>
          ${selected ? `<div class="chat-members">${escapeHtml(members)}</div>` : ""}
        </header>
        <div class="message-list" id="message-list" aria-live="polite">
          ${messages.length ? messages.map(makeMessageMarkup).join("") : `<p class="message-empty">${selected ? "No messages in this conversation yet." : "Your conversations will appear here."}</p>`}
        </div>
        ${selected ? `<form class="composer" id="message-form"><label class="visually-hidden" for="message-input">Write a message</label><textarea id="message-input" name="message" maxlength="4000" placeholder="Write a message…" required></textarea><button class="button" type="submit">Send</button></form>` : ""}
      </section>
    </section>
    <div class="local-note">${escapeHtml(cloudSyncStatus)} · message bodies are encrypted for conversation members · Cloudflare stores ciphertext and key wrappers, not plaintext messages.</div>
    <div class="local-note" id="chat-status" role="status" aria-live="polite"></div>`;

    const messageList = app.querySelector("#message-list");
    if (messageList) messageList.scrollTop = messageList.scrollHeight;

    app.querySelectorAll("[data-thread-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedThreadId = button.dataset.threadId;
        renderWorkspace();
      });
    });

    app.querySelector("#message-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = event.currentTarget.elements.message;
      const text = input.value.trim();
      if (!text || !selectedThreadId) return;
      try {
        const message = await encryptMessage(
          text,
          selected.id,
          activeAccount().id,
          selected.members,
          activeIdentity?.signingPrivateKey,
        );
        const response = await fetch("/api/chat/messages", {
          method: "POST",
          headers: chatApiHeaders(true),
          body: JSON.stringify(message),
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Message was not saved.");
        }
        messageHistory.push(message);
        await renderWorkspace();
      } catch {
        window.alert("Could not securely save this message. Check the chat connection and try again.");
      }
    });

    app.querySelector("#invite-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const label = String(form.get("label") || "").trim();
      const email = String(form.get("email") || "").trim();
      const error = app.querySelector('[data-form-error="invite"]');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        error.textContent = "Enter the recipient email allowed by Cloudflare Access.";
        return;
      }
      const emailHash = await hashAccessEmail(email);
      if (state.accounts.some((account) => account.name.toLowerCase() === label.toLowerCase())) {
        error.textContent = "That recipient name is already in use.";
        return;
      }
      if (state.accounts.some((account) => account.accessEmailHash === emailHash)) {
        error.textContent = "That Access email already has an account.";
        return;
      }

      const recipientId = makeId();
      const code = makeId().replaceAll("-", "").toUpperCase();
      const identity = await createIdentity(code);
      const recipient = {
        id: recipientId,
        name: label,
        role: "recipient",
        accessEmailHash: emailHash,
        publicKey: identity.publicKey,
        signingPublicKey: identity.signingPublicKey,
      };
      const authIndex = JSON.parse(localStorage.getItem(AUTH_INDEX_KEY));
      authIndex.recipients.push({
        accountId: recipient.id,
        codeHash: await hashCode(code),
        publicKey: identity.publicKey,
        signingPublicKey: identity.signingPublicKey,
        privateKeyWrapper: identity.privateKeyWrapper,
        ...(await wrapDataKey(code, vaultKey)),
      });
      state.accounts.push(recipient);
      state.invites.push({
        id: makeId(),
        label,
        accountId: recipient.id,
        createdAt: new Date().toISOString(),
      });
      latestInvite = { accountId: recipient.id, code };
      persistAuthIndex(authIndex);
      await persistVault();
      if (!(await syncVaultToCloud())) {
        error.textContent = "Could not save this invitation to Cloudflare. Check Access and try again.";
        return;
      }
      selectedThreadId = directThreadId(state.ownerId, recipient.id);
      await renderWorkspace();
    });

    app.querySelector("#group-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const memberIds = form.getAll("memberId").map(String);
      const name = String(form.get("groupName") || "").trim();
      const error = app.querySelector('[data-form-error="group"]');
      if (!memberIds.length) {
        error.textContent = "Choose at least one recipient.";
        return;
      }
      const group = { id: makeId(), name, memberIds: [state.ownerId, ...memberIds], createdAt: new Date().toISOString() };
      state.groups.push(group);
      await persistVault();
      if (!(await syncVaultToCloud())) {
        window.alert("Could not save the group to Cloudflare.");
        state.groups = state.groups.filter((item) => item.id !== group.id);
        return;
      }
      selectedThreadId = `group:${group.id}`;
      await renderWorkspace();
    });

    app.querySelector('[data-action="wipe-messages"]')?.addEventListener("click", async () => {
      if (!window.confirm("Wipe all Cloudflare message history? Recipients may still have copies already downloaded.")) return;
      const response = await fetch("/api/chat/messages", {
        method: "DELETE",
        headers: chatApiHeaders(),
      });
      if (!response.ok) {
        window.alert("Could not wipe Cloudflare message history.");
        return;
      }
      messageHistory = [];
      selectedThreadId = null;
      await renderWorkspace();
    });

    app.querySelector('[data-action="erase-vault"]')?.addEventListener("click", async () => {
      if (!window.confirm("Erase the Cloudflare vault, recipients, groups, and stored messages? Recipients may still have downloaded copies.")) return;
      const response = await fetch(CHAT_VAULT_API, {
        method: "DELETE",
        headers: chatApiHeaders(),
      });
      if (!response.ok) {
        window.alert("Could not erase the Cloudflare vault.");
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(AUTH_INDEX_KEY);
      localStorage.removeItem("tarheel-maker-secret-chat-prototype-v1");
      localStorage.removeItem("tarheel-maker-secret-chat-prototype-auth-v1");
      localStorage.removeItem("tarheel-maker-secret-chat-e2ee-v1");
      localStorage.removeItem("tarheel-maker-secret-chat-e2ee-auth-v1");
      vaultKey = undefined;
      activeIdentity = undefined;
      state = undefined;
      activeUserId = undefined;
      cloudIdentityAccountId = undefined;
      messageHistory = [];
      latestInvite = undefined;
      await clearRememberedSession();
      showAuth();
    });

    app.querySelectorAll('[data-action="remove-recipient"]').forEach((button) => {
      button.addEventListener("click", async () => {
        const accountId = button.dataset.accountId;
        const recipient = state.accounts.find((account) => account.id === accountId);
        if (!recipient || !window.confirm(`Remove ${recipient.name}? This revokes their code in the shared vault and removes them from current groups. Copies already synced to their device cannot be remotely erased.`)) return;

        const result = removeRecipientFromState(state, accountId);
        if (!result) return;
        if (latestInvite?.accountId === accountId) latestInvite = undefined;

        const authIndex = JSON.parse(localStorage.getItem(AUTH_INDEX_KEY));
        authIndex.recipients = authIndex.recipients.filter((entry) => entry.accountId !== accountId);
        persistAuthIndex(authIndex);
        await persistVault();
        if (!(await syncVaultToCloud())) {
          window.alert("Could not update Cloudflare membership. The remote participant access was not changed.");
          return;
        }
        if (selectedThreadId === `direct:${accountId}` || (selectedThreadId?.startsWith("group:") && result.removedGroups.has(selectedThreadId.slice("group:".length)))) {
          selectedThreadId = null;
        }
        renderWorkspace();
      });
    });

    app.querySelector('[data-action="lock-vault"]')?.addEventListener("click", async () => {
      vaultKey = undefined;
      activeIdentity = undefined;
      state = undefined;
      activeUserId = undefined;
      selectedThreadId = undefined;
      latestInvite = undefined;
      await clearRememberedSession();
      showAuth();
    });

    app.querySelectorAll('[data-action="copy-invite"]').forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.code);
          button.textContent = "Copied";
        } catch {
          const status = app.querySelector("#chat-status");
          status.textContent = `Copy this invite code: ${button.dataset.code}`;
        }
      });
    });
  };

  if (!globalThis.crypto?.subtle || !globalThis.crypto?.randomUUID) {
    app.innerHTML = `<section class="auth-panel"><h2>Secure browser required</h2><p>This prototype needs Web Crypto. Open it over HTTPS or localhost in a current browser.</p></section>`;
    return;
  }

  const startPrototype = async () => {
    await restoreCloudVault();
    const remembered = await loadRememberedSession();
    const localVault = localStorage.getItem(STORAGE_KEY);
    if (remembered && localVault) {
      try {
        vaultKey = remembered.vaultKey;
        activeIdentity = remembered.identity;
        state = await decryptState(JSON.parse(localVault), vaultKey);
        if (
          state.accounts.some((account) => account.id === remembered.accountId) &&
          (!cloudIdentityAccountId || cloudIdentityAccountId === remembered.accountId)
        ) {
          activeUserId = remembered.accountId;
          await refreshMessageHistory();
          await renderWorkspace();
          return;
        }
      } catch {
        vaultKey = undefined;
        activeIdentity = undefined;
        state = undefined;
      }
      await clearRememberedSession();
    }
    showAuth();
  };

  startPrototype();
})();
