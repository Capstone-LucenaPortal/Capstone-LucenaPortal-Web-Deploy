"use client";

import { useRef, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import {
  imageSrc,
  putImage,
  validateImageFile,
  type ImageKind,
} from "@/portals/super-staff/lib/storage/site-content";

/**
 * An image slot backed by a STABLE path.
 *
 * There is NO Remove button: no bucket exposes a delete policy to any role, so
 * "remove" cannot be honoured and offering it would be a lie. Replacing reuses
 * the same path, which is what keeps `image_path` unchanged — so the editor's
 * update RPC logs no spurious "Image changed" and no orphan is created.
 *
 * The slot itself is `site-content`'s business — this field never parses or
 * builds a path. It hands `putImage` the current one and stores what comes
 * back. No row id is involved, so create and edit behave identically.
 *
 * Lives in `components/media/`, not `components/ui/`: the COMPONENTS in `ui/`
 * are styling-only primitives that any page could drop in, and this one reaches
 * into the storage seam to upload. It is shared by the announcement, event and
 * place editors, so it belongs to no single feature either.
 */
export function ImageField({
  kind,
  imagePath,
  version,
  onUploaded,
  disabled,
}: {
  kind: ImageKind;
  /** The row's current image_path, or null when it has never had one. */
  imagePath: string | null;
  /** The row's own updated_at. Busts the CDN cache, which the path cannot:
   *  image_path is stable by design, so the public URL never changes.
   *  Absent while the row is still being created, which is also when there is
   *  no stored image to show. */
  version?: string;
  /** Called with the stored path after a successful upload. */
  onUploaded: (path: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Covers the window between a replacement and the save that moves the row's
  // own updated_at. Null after a remount, by which point the save has landed
  // and `version` is itself fresh — which a render-local counter never was,
  // because it reset to the value it held BEFORE the replacement.
  //
  // ⚠️ Residual: replace, then LEAVE without saving. The stamp is gone and the
  // row's own never moved, so the preview shows the old bytes while storage
  // holds the new ones. Harmless — the next save fixes it — but real.
  const [freshVersion, setFreshVersion] = useState<string | null>(null);

  const preview = imageSrc(imagePath, freshVersion ?? version);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImageFile(file);
    setError(problem);
    if (problem) return;

    setBusy(true);
    try {
      // The slot is the module's business: it reuses `imagePath` on a replace
      // and mints one only on first upload.
      const stored = await putImage(kind, imagePath, file);
      onUploaded(stored.path);
      setFreshVersion(stored.version);
    } catch (e: unknown) {
      setError(rpcErrorMessage(e, "Upload failed. Try again."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-900">Image</span>

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="h-40 w-full max-w-sm rounded-lg border border-gray-200 object-cover"
        />
      ) : (
        <div className="flex h-40 w-full max-w-sm items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">
          No image
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        aria-label="Image"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : imagePath ? "Replace image" : "Upload image"}
        </Button>
      </div>

      <p className="text-xs text-gray-500">JPEG or PNG, up to 5 MB.</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
