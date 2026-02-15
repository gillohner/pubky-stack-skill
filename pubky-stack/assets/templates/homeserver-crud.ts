/**
 * Pubky Homeserver CRUD Template
 *
 * Typed helpers for common homeserver operations using @synonymdev/pubky v0.6.0.
 *
 * All code in this file uses ONLY methods verified from the official npm documentation.
 *
 * Key SDK concepts:
 * - Pubky: Main facade. Reuse one instance across your app.
 * - Signer: Bound to a keypair. Handles signup/signin.
 * - Session: Returned by signup/signin. Has .storage for read/write.
 * - SessionStorage: Read/write your data using ABSOLUTE paths ("/pub/...")
 * - PublicStorage: Read any user's data using ADDRESSED paths ("<pk>/pub/...")
 */

import { Pubky, Keypair, PublicKey } from "@synonymdev/pubky";

// --- Configuration ---

/** Your app's namespace on the homeserver */
const APP_NAMESPACE = "my-cool-app";

// --- Singleton Pubky facade ---

let _pubky: Pubky | null = null;

function getPubky(): Pubky {
  if (!_pubky) {
    _pubky = new Pubky();
    // For testnet: _pubky = Pubky.testnet();
  }
  return _pubky;
}

// --- Auth ---

/**
 * Generate a new random identity.
 * CRITICAL: Store the keypair securely. Loss = permanent identity loss.
 */
function createIdentity(): Keypair {
  return Keypair.random();
}

/**
 * Restore identity from an encrypted recovery file.
 */
function restoreIdentity(recoveryFile: Uint8Array, passphrase: string): Keypair {
  return Keypair.fromRecoveryFile(recoveryFile, passphrase);
}

/**
 * Signup to a homeserver (first time).
 * Returns a Session with .storage for read/write.
 */
async function signup(keypair: Keypair, homeserverPk: string, inviteCode: string | null = null) {
  const pubky = getPubky();
  const signer = pubky.signer(keypair);
  const homeserver = PublicKey.from(homeserverPk);
  return await signer.signup(homeserver, inviteCode);
}

/**
 * Signin (subsequent times). Fast — publishes PKDNS in background.
 * Returns a Session with .storage for read/write.
 */
async function signin(keypair: Keypair) {
  const pubky = getPubky();
  const signer = pubky.signer(keypair);
  return await signer.signin();
}

/**
 * Signin blocking — waits for PKDNS publish to complete. Slower but safer.
 */
async function signinBlocking(keypair: Keypair) {
  const pubky = getPubky();
  const signer = pubky.signer(keypair);
  return await signer.signinBlocking();
}

// --- Session Storage (write your own data — absolute paths) ---

// All write operations use session.storage with absolute paths like:
//   /pub/my-cool-app/data.json
//
// Example usage after obtaining a session:
//
//   const session = await signin(keypair);
//
//   // Write
//   await session.storage.putJson(`/pub/${APP_NAMESPACE}/events/001`, {
//     title: "My Event",
//     date: "2026-03-01"
//   });
//
//   // Read
//   const event = await session.storage.getJson(`/pub/${APP_NAMESPACE}/events/001`);
//
//   // Other write methods
//   await session.storage.putText(`/pub/${APP_NAMESPACE}/notes/hello.txt`, "Hello world");
//   await session.storage.putBytes(`/pub/${APP_NAMESPACE}/files/icon.bin`, new Uint8Array([...]));
//
//   // Metadata
//   const exists = await session.storage.exists(`/pub/${APP_NAMESPACE}/events/001`);
//   const stats = await session.storage.stats(`/pub/${APP_NAMESPACE}/events/001`);
//   // stats: { content_length, content_type, etag, last_modified } | null
//
//   // List (trailing slash required)
//   const entries = await session.storage.list(`/pub/${APP_NAMESPACE}/events/`, null, false, 100, false);
//
//   // Delete
//   await session.storage.delete(`/pub/${APP_NAMESPACE}/events/001`);
//
//   // Signout
//   await session.signout();

// --- Public Storage (read any user's data — addressed paths) ---

// All public reads use pubky.publicStorage with addressed paths like:
//   <user_pk_z32>/pub/my-cool-app/data.json
//
// Example usage:
//
//   const pubky = getPubky();
//   const userPk = "8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo"; // z32 format
//
//   // Read another user's data (no auth needed)
//   const event = await pubky.publicStorage.getJson(`${userPk}/pub/${APP_NAMESPACE}/events/001`);
//   const text = await pubky.publicStorage.getText(`${userPk}/pub/${APP_NAMESPACE}/notes/hello.txt`);
//   const bytes = await pubky.publicStorage.getBytes(`${userPk}/pub/${APP_NAMESPACE}/files/icon.bin`);
//   const raw = await pubky.publicStorage.get(`${userPk}/pub/${APP_NAMESPACE}/data.json`); // raw Response
//
//   // Metadata
//   const exists = await pubky.publicStorage.exists(`${userPk}/pub/${APP_NAMESPACE}/events/001`);
//
//   // List
//   const entries = await pubky.publicStorage.list(`${userPk}/pub/${APP_NAMESPACE}/events/`, null, false, 100, false);

// --- Cross-app profile reading ---

/**
 * Read any user's pubky.app profile (cross-app standard).
 * Uses PublicStorage (no auth needed).
 */
async function getProfile(userPkZ32: string) {
  const pubky = getPubky();
  try {
    return await pubky.publicStorage.getJson(`${userPkZ32}/pub/pubky.app/profile.json`);
  } catch (e: any) {
    if (e.name === "RequestError" && e.data?.statusCode === 404) {
      return null;
    }
    throw e;
  }
}

/**
 * Write current user's pubky.app profile.
 * Requires an active session.
 */
async function setProfile(session: any, profile: {
  name: string;
  bio?: string;
  image?: string;
  links?: Array<{ title: string; url: string }>;
  status?: string;
}) {
  await session.storage.putJson("/pub/pubky.app/profile.json", profile);
}

// --- Session Persistence (Browser) ---

// Save:
//   const snapshot = session.export();
//   localStorage.setItem("pubky-session", snapshot);
//
// Restore:
//   const pubky = getPubky();
//   const session = await pubky.restoreSession(localStorage.getItem("pubky-session")!);
//   // Browser must still have the HTTP-only cookie for this to work

// --- Recovery File ---

// Create:
//   const recoveryFile = keypair.createRecoveryFile("strong passphrase");
//   // recoveryFile is Uint8Array — save to file
//
// Restore:
//   const keypair = Keypair.fromRecoveryFile(recoveryFileBytes, "strong passphrase");

export {
  getPubky,
  createIdentity,
  restoreIdentity,
  signup,
  signin,
  signinBlocking,
  getProfile,
  setProfile,
  APP_NAMESPACE,
};
