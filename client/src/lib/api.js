/**
 * The only file in the client that talks to the server.
 *
 * Everything it can reach is under /api/auth. Practice logs and settings have
 * no function here and must not gain one - see the note at the top of
 * practiceLog.js.
 *
 * The API is same-origin in development (Vite proxies /api, see
 * vite.config.js) but a genuinely separate Render service in production - a
 * static site cannot run the rewrite-to-another-service trick Netlify-style
 * hosts offer, so production instead points straight at the API's own URL and
 * relies on CORS + a SameSite=None cookie. VITE_API_URL is baked in at build
 * time; see render.yaml.
 */
const API_ORIGIN = import.meta.env.VITE_API_URL || "";

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    // The full body, so a caller that needs more than the message - e.g.
    // login's needsVerification/pendingEmail flags - doesn't need a second
    // ad-hoc error shape.
    this.data = data;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    // The session is an httpOnly cookie, so it has to be sent explicitly.
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // A non-JSON body (a proxy error page, say) is still a failure worth
    // reporting - just not one with a message we can quote.
  }

  if (!res.ok) {
    throw new ApiError(
      data?.error || "Could not reach the server. Check your connection.",
      res.status,
      data
    );
  }
  return data;
}

export const api = {
  signup: (email, password, name) =>
    request("/auth/signup", { method: "POST", body: { email, password, name } }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  verifyOtp: (email, code) =>
    request("/auth/verify-otp", { method: "POST", body: { email, code } }),
  resendOtp: (email) => request("/auth/resend-otp", { method: "POST", body: { email } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me")
};

export { ApiError };
