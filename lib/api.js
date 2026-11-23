export async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.success === false) {
    const details = Array.isArray(body.errors)
      ? body.errors.filter((item) => typeof item === "string").join(" ")
      : "";
    const error = new Error(details || body.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return body;
}
