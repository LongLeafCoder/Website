import { onRequestGet as __api_contact_js_onRequestGet } from "/workspaces/codespaces-blank/functions/api/contact.js"
import { onRequestPost as __api_contact_js_onRequestPost } from "/workspaces/codespaces-blank/functions/api/contact.js"

export const routes = [
    {
      routePath: "/api/contact",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_contact_js_onRequestGet],
    },
  {
      routePath: "/api/contact",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_contact_js_onRequestPost],
    },
  ]