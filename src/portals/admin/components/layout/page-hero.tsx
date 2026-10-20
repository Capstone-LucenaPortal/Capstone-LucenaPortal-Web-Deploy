// src/portals/admin/components/layout/page-hero.tsx
import { ReactNode } from "react";
import Image from "next/image";

export function PageHero({
  title,
  subtitle,
  image,
  imagePosition = "50% 62%",
  children,
}: {
  title: string;
  subtitle: string;
  image: string;
  imagePosition?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 bg-slate-100" />
      {/* Negative margin cancels out the content wrapper's own gutter
          (src/app/(admin)/admin/(shell)/layout.tsx's `p-4 md:p-8`) so the hero bleeds full-width
          and flush to the top; it must stay in lockstep with that wrapper's
          padding at every breakpoint, not just track a fixed p-8. */}
      <div className="relative -mx-4 -mt-4 overflow-hidden bg-blue-950 md:-mx-8 md:-mt-8">
        <Image
          src={image}
          alt=""
          aria-hidden
          fill
          // This hero photo is the LCP element on every module page, so it
          // should start loading immediately rather than lazily.
          preload
          sizes="100vw"
          className="object-cover opacity-90 [filter:saturate(1.25)]"
          style={{ objectPosition: imagePosition }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/95 via-blue-950/70 to-blue-900/30" />
        <div className="relative flex flex-wrap items-start justify-between gap-3 px-4 py-8 md:px-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="text-sm text-blue-100/80">{subtitle}</p>
            <div aria-hidden className="mt-3 h-0.5 w-10 bg-amber-400" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
