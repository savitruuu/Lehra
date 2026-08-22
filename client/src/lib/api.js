/**
 * The only file in the client that talks to the server.
 *
 * Everything it can reach is under /api/auth. Practice logs and settings have
 * no function here and must not gain one - see the note at the top of
 * practiceLog.js.
 */

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
  const res = await fetch(`/api${path}`, {
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
