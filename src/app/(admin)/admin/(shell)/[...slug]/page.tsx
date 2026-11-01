// src/app/(admin)/admin/(shell)/[...slug]/page.tsx
//
// Every /admin address no other page matches. An unmatched URL goes to
// global-not-found, which is the Citizen 404; matching it here instead keeps
// the (shell) layout and its role gate, and notFound() renders this group's
// not-found inside them. A catch-all has the lowest priority, so every real
// page still resolves as before.
import { notFound } from "next/navigation";

// The not-found's own title reaches only the server-rendered HTML; a 404 is
// rendered again in the browser from this page's metadata, so it carries the
// same title.
export { metadata } from "../not-found";

export default function UnknownAddress(): never {
  notFound();
}
