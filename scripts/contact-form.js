(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById("form-status");
  let widgetId;

  const showStatus = (message, state = "") => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const loadTurnstile = () =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });

  const prepareForm = async () => {
    try {
      const response = await fetch("/api/contact", {
        headers: { Accept: "application/json" },
      });
      const config = await response.json();
      if (!response.ok || !config.siteKey) throw new Error();

      await loadTurnstile();
      widgetId = window.turnstile.render("#turnstile-widget", {
        sitekey: config.siteKey,
        action: "contact",
        "error-callback": () =>
          showStatus("Verification failed. Please try again.", "error"),
      });
      button.disabled = false;
      showStatus("");
    } catch {
      showStatus(
        "The form is temporarily unavailable. Please use the email link instead.",
        "error",
      );
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    button.disabled = true;
    showStatus("Sending your message…");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Your message could not be sent. Please try again.",
        );

      form.reset();
      window.turnstile.reset(widgetId);
      showStatus("Thanks. Your message has been sent.", "success");
    } catch (error) {
      if (widgetId !== undefined) window.turnstile.reset(widgetId);
      showStatus(
        error.message || "A network error occurred. Please try again.",
        "error",
      );
    } finally {
      button.disabled = widgetId === undefined;
    }
  });

  prepareForm();
})();
