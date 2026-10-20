// src/proxy.test.ts
//
// Sanity-checks the static-asset exclusion in proxy.ts's matcher config. The
// matcher used to only exclude image extensions, so every .css/.woff2/.txt/
// robots.txt request under public/ paid a full getUser() + DB read +
// redirect cycle.
//
// proxy.ts is not imported directly: it pulls in src/shared/guard/proxy.ts,
// which imports next/server (createServerClient/NextResponse), and those
// reference the web-platform `Request` global that isn't defined in this
// project's Vitest environment — importing it here would fail the suite for
// reasons unrelated to the matcher itself. Instead the matcher string is
// read straight out of the source file's `config.matcher` array and
// compiled as a plain JS RegExp. This is not an exact replica of Next's
// internal matcher compiler (path-to-regexp), but is sufficient to catch a
// regression in the exclusion list without building an elaborate test
// harness around Next's build internals.
import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.join(__dirname, "proxy.ts"), "utf8");
const match = source.match(/matcher:\s*\[[^"]*"((?:[^"\\]|\\.)*)"/);
if (!match) {
  throw new Error("Could not find config.matcher pattern in proxy.ts");
}
// The pattern is written as a JS string literal (with escaped backslashes),
// so it must be unescaped before use as a RegExp source.
const pattern = match[1].replace(/\\\\/g, "\\");

describe("proxy matcher", () => {
  const matcher = new RegExp(`^${pattern}$`);

  it("still matches real app routes", () => {
    for (const path of [
      "/admin/dashboard",
      "/admin/login",
      "/admin/accept-invite",
      "/admin/forbidden",
      "/admin",
      "/staff/dashboard",
      "/staff/login",
      "/staff/accept-invite",
      "/staff/forbidden",
      "/staff/login-history",
      "/staff/api/booking/documents/1",
      "/staff",
      "/super-staff/accounts",
      "/super-staff/login",
      "/super-staff/accept-invite",
      "/super-staff/forbidden",
      "/super-staff/configuration/site-info",
      "/super-staff",
      "/responder/pool",
      "/responder/login",
      "/responder/accept-invite",
      "/responder/forbidden",
      "/responder/incidents/inc-4501",
      "/responder",
    ]) {
      expect(matcher.test(path)).toBe(true);
    }
  });

  it("leaves paths outside the staff-side prefixes to the Citizen Portal", () => {
    for (const path of [
      "/",
      "/dashboard",
      "/complete-signup",
      "/reset-password",
      "/yellow-card/YC-1/revise",
      "/sitemap.xml",
      "/login",
      "/pool",
      "/administrator",
      "/staffing",
      "/super-staffing",
      "/responders",
    ]) {
      expect(matcher.test(path)).toBe(false);
    }
  });

  it("excludes Next's own static asset paths", () => {
    for (const path of ["/_next/static/chunks/foo.js", "/_next/image?url=x"]) {
      expect(matcher.test(path)).toBe(false);
    }
  });

  it("excludes favicon.ico", () => {
    expect(matcher.test("/favicon.ico")).toBe(false);
  });

  it("excludes the full static-file extension list, not just images", () => {
    const staticPaths = [
      "/admin/style.css",
      "/admin/bundle.js",
      "/admin/bundle.js.map",
      "/admin/robots.txt",
      "/admin/sitemap.xml",
      "/admin/manifest.json",
      "/admin/site.webmanifest",
      "/admin/font.woff",
      "/admin/font.woff2",
      "/admin/font.ttf",
      "/admin/font.otf",
      "/admin/logo.svg",
      "/admin/lucena-seal.png",
      "/admin/photo.jpg",
      "/admin/photo.jpeg",
      "/admin/anim.gif",
      "/admin/photo.webp",
      "/admin/icon.ico",
      "/staff/Lucena_City_Seal.png",
      "/staff/font.woff2",
      "/super-staff/Lucena_City_Seal.png",
      "/responder/manifest.webmanifest",
    ];
    for (const path of staticPaths) {
      expect(matcher.test(path)).toBe(false);
    }
  });
});
