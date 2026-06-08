/**
 * PocketBase client for PGMS
 * ------------------------------------------------------------------
 * PocketBase URL comes from VITE_POCKETBASE_URL when set.
 * Dynamic fallback uses window.location (browser only)
 * Server fallback: http://localhost:8090
 * ------------------------------------------------------------------
 */
import PocketBase from "pocketbase";

export const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8090` : "http://localhost:8090");

// Single shared client instance (auth state is auto-persisted in localStorage)
export const pb = new PocketBase(POCKETBASE_URL);

// Disable auto-cancellation globally — it was firing "request was autocancelled"
// errors in the UI when components re-mounted or fired parallel requests
// (voting + refresh, etc.). For a production grievance portal we prefer to
// let every request complete and dedupe at the call-site if needed.
pb.autoCancellation(false);

/** True when an error is just an aborted/cancelled fetch (safe to ignore in UI). */
export function isAbortError(err: any) {
  if (!err) return false;
  return (
    err.isAbort === true ||
    err.name === "AbortError" ||
    err.name === "ClientResponseError 0" ||
    /autocancelled|aborted/i.test(err.message ?? "")
  );
}

/** Convenience helpers used across the app. */
export const isLoggedIn = () => pb.authStore.isValid;
export const currentUser = () => pb.authStore.model;
export const logout = () => pb.authStore.clear();

/** Build a public file URL for any record file field. */
export function fileUrl(record: { id: string; collectionId: string; collectionName: string }, filename: string) {
  return pb.files.getURL(record as any, filename);
}
