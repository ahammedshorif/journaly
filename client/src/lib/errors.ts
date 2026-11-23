/**
 * Recovery for errors during in-app navigation.
 *
 * A full page reload fixes most navigation-time failures (a new deployment replaced the JS chunks,
 * a route payload request failed, a session cookie was refreshed mid-navigation…). So the error
 * boundary reloads once automatically; if the same thing fails again within 30 s it stops and shows
 * the error instead, so a genuinely broken page can never cause a reload loop.
 */

const RELOAD_KEY = "tj-auto-reloaded-at";
const LAST_ERROR_KEY = "tj-last-error";
const WINDOW_MS = 30_000;

/** Reloads the page unless we already auto-reloaded in the last 30 s. Returns true if reloading. */
export function reloadOnce(error: Error & { digest?: string }): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    // Keep the message so it can be shown (and reported) if the reload doesn't fix it.
    sessionStorage.setItem(
      LAST_ERROR_KEY,
      JSON.stringify({ message: error.message, digest: error.digest, path: window.location.pathname, at: new Date().toISOString() }),
    );
  } catch {
    return false; // no sessionStorage → can't guard against loops, so don't auto-reload
  }
  window.location.reload();
  return true;
}

/** The error that triggered the last automatic reload, if any (for the error screen / console). */
export function lastAutoReloadError(): { message: string; digest?: string; path: string; at: string } | null {
  try {
    const raw = sessionStorage.getItem(LAST_ERROR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
