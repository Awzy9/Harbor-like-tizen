// Thin transport for the Stremio account backend at api.strem.io. This
// contract is NOT part of the public Stremio add-on protocol — it's the
// private API Stremio's own apps use for login/profile/add-on sync. Confirmed
// by reading Stremio's own officially-maintained, MIT-licensed
// `stremio-api-client` package (github.com/Stremio/stremio-api-client):
// every call is a POST to `{base}/api/{method}` with a JSON body of
// `{ authKey, ...params }`, and the response is either `{ result }` or
// `{ error }`. See docs/PROJECT_PLAN.md sections 13/59 (Risk 1) — this is
// the confirmed core account/sync contract; the TV-friendly QR/short-code
// pairing flow (link.stremio.com) is a *separate* mechanism whose backend
// contract could not be verified from public sources, so it is deliberately
// NOT implemented here. Login is by email/password only for now.

const API_BASE = "https://api.strem.io/api/";
const REQUEST_TIMEOUT_MS = 10000;

export class StremioApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = "StremioApiError";
  }
}

interface ApiEnvelope<T> {
  result?: T;
  error?: { message?: string; code?: number };
}

export async function callStremioApi<T>(
  method: string,
  params: object = {},
  authKey: string | null = null,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_BASE + method, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authKey, ...params }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new StremioApiError(`Stremio API returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as ApiEnvelope<T>;
    if (body.error) {
      throw new StremioApiError(body.error.message ?? "Stremio API returned an error", body.error.code);
    }
    if (body.result === undefined) {
      throw new StremioApiError("Stremio API response missing a result");
    }
    return body.result;
  } catch (err) {
    if (err instanceof StremioApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new StremioApiError(`Stremio API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new StremioApiError(err instanceof Error ? err.message : "Unknown Stremio API error");
  } finally {
    clearTimeout(timer);
  }
}
