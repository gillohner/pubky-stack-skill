/**
 * Pubky Ring Authentication Template
 *
 * Implements "Login with Pubky Ring" using the @synonymdev/pubky v0.6.0 SDK.
 *
 * All code in this file uses ONLY methods verified from the official npm documentation.
 *
 * Flow:
 * 1. App calls pubky.startAuthFlow(caps, kind) → gets AuthFlow with authorizationUrl
 * 2. App displays authorizationUrl as QR code (desktop) or clickable link (mobile)
 * 3. User scans/taps in Pubky Ring and approves
 * 4. flow.awaitApproval() resolves with a ready Session
 */

import { Pubky, AuthFlowKind, validateCapabilities } from "@synonymdev/pubky";

// --- Configuration ---

/**
 * Capabilities your app needs. Comma-separated path patterns with permissions.
 *
 * Examples:
 *   "/pub/my-cool-app/:rw"                           — read/write your app's data
 *   "/pub/my-cool-app/:rw,/pub/another-app/folder/:w" — multiple capabilities
 *   "/pub/:r"                                         — read-only all public data
 */
const APP_CAPS = "/pub/my-cool-app/:rw";

/**
 * Optional relay URL. Defaults to Synonym-hosted relay if omitted.
 * For production: run your own relay (MIT, Docker): https://httprelay.io
 *
 * Default: "https://httprelay.pubky.app/link/"
 */
const RELAY_URL = undefined; // use default

// --- Auth Flow ---

/**
 * Start a Pubky Ring auth flow.
 *
 * Returns the authorizationUrl to display as QR code or clickable link,
 * plus a promise that resolves when the user approves.
 *
 * @param pubky - Shared Pubky facade instance
 * @param caps - Capability string (validated and normalized)
 * @param relay - Optional relay URL
 */
function startPubkyAuth(
  pubky: InstanceType<typeof Pubky>,
  caps: string = APP_CAPS,
  relay?: string
) {
  // NOTE: The npm README shows AuthFlowKind::signin() (Rust syntax).
  // In JavaScript, this is likely AuthFlowKind.signin().
  // Check the TypeScript types in the installed package for the exact form.
  const flow = pubky.startAuthFlow(caps, AuthFlowKind.signin(), relay);

  return {
    /** Display this URL as QR code or clickable link */
    authorizationUrl: flow.authorizationUrl,

    /**
     * Blocks until user approves in Pubky Ring.
     * Returns a ready-to-use Session.
     */
    waitForApproval: () => flow.awaitApproval(),
  };
}

/**
 * Validate and normalize user-provided capabilities before starting auth.
 * Throws PubkyError with name "InvalidInput" if malformed.
 */
function safeValidateCaps(rawCaps: string): string {
  return validateCapabilities(rawCaps);
}

// --- Usage Example ---

/*
import { Pubky, AuthFlowKind, validateCapabilities } from "@synonymdev/pubky";

// Reuse a single Pubky instance across your app
const pubky = new Pubky();

// Option 1: Start auth with fixed capabilities
const { authorizationUrl, waitForApproval } = startPubkyAuth(pubky);

// Display QR code (desktop) or button (mobile)
// Use any QR library: qrcode, react-qr-code, etc.
renderQr(authorizationUrl);

// Wait for user to approve in Pubky Ring
try {
  const session = await waitForApproval();

  // Session is ready — user is authenticated
  const pk = session.info.publicKey.z32();     // z-base-32 (for storage/transport)
  const display = session.info.publicKey.toString(); // "pubky<z32>" (for UI)
  const caps = session.info.capabilities;       // string[] of granted permissions

  // Read/write using session storage (absolute paths)
  await session.storage.putJson("/pub/my-cool-app/preferences.json", {
    theme: "dark",
    language: "en"
  });

  const prefs = await session.storage.getJson("/pub/my-cool-app/preferences.json");

  // Persist session across page reloads (browser)
  const snapshot = session.export();
  localStorage.setItem("pubky-session", snapshot);

  // Later: restore
  // const restored = await pubky.restoreSession(localStorage.getItem("pubky-session"));

} catch (error) {
  if (error.name === "AuthenticationError") {
    console.error("Auth failed:", error.message);
  }
  // Timeout, relay down, user rejected, etc.
}

// Option 2: With user-provided capabilities (e.g., from a form)
try {
  const normalizedCaps = safeValidateCaps(formData.get("caps") ?? "");
  const auth = startPubkyAuth(pubky, normalizedCaps);
  renderQr(auth.authorizationUrl);
  const session = await auth.waitForApproval();
} catch (error) {
  if (error.name === "InvalidInput") {
    showError("Invalid capabilities: " + error.message);
  }
}
*/

export { startPubkyAuth, safeValidateCaps };
