"use client";

import { useEffect, useState } from "react";
import { loadSystemIssueScreenshot } from "../lib/system-issue-queries";

/** The bucket's own allowlist (l128b). Anything else is never given an object URL. */
const IMAGE_TYPES = ["image/png", "image/jpeg"];

type Shot = { kind: "loading" } | { kind: "error" } | { kind: "ready"; url: string };

/**
 * The Citizen's optional screenshot (l128b), as a thumbnail that opens full
 * size in a new tab, or "None". The image is downloaded with the Super-staff
 * session and shown from an object URL, released when the panel moves on.
 */
export function IssueScreenshot({ path }: { path: string | null }) {
  if (path === null) return <>None</>;
  // Keyed on the path, so another issue's screenshot starts from Loading.
  return <LoadedScreenshot key={path} path={path} />;
}

function LoadedScreenshot({ path }: { path: string }) {
  const [shot, setShot] = useState<Shot>({ kind: "loading" });

  useEffect(() => {
    let url: string | null = null;
    let live = true;
    loadSystemIssueScreenshot(path)
      .then((blob) => {
        if (!live) return;
        // The object URL opens in a new tab on this origin: only a raster image
        // type may reach it, never HTML or SVG, whatever Storage reports.
        if (!IMAGE_TYPES.includes(blob.type)) throw new Error(`Not a screenshot type: ${blob.type}`);
        url = URL.createObjectURL(new Blob([blob], { type: blob.type }));
        setShot({ kind: "ready", url });
      })
      .catch(() => {
        if (live) setShot({ kind: "error" });
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (shot.kind === "loading") return <span className="text-gray-500">Loading…</span>;
  if (shot.kind === "error") return <span className="text-red-700">Couldn&apos;t load the screenshot.</span>;
  return (
    <a
      href={shot.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open the screenshot full size"
      className="block w-fit rounded border border-gray-300 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL, which next/image cannot load */}
      <img src={shot.url} alt="The Citizen's screenshot" className="max-h-32 max-w-full rounded object-contain" />
    </a>
  );
}
