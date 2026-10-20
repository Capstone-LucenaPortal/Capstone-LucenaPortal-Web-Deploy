import { Info } from "lucide-react";
import { noticeText } from "@/portals/responder/features/incidents/lib/notice";

/**
 * A `?notice=` code, said in a sentence. A SERVER component — decision E3: the
 * portal already encodes outcomes in the URL by policy (`?report=`, `?sheet=`,
 * `?lost=`), so a failure is a URL too and nothing here becomes client state.
 *
 * ⚠️ AN UNKNOWN CODE RENDERS NOTHING — not an empty box, and not a generic
 * "something went wrong". `noticeFor` already re-throws anything unmapped, so a
 * code reaching here that we do not know came from a hand-edited URL, and a
 * hand-edited URL deserves silence rather than a scary banner.
 *
 * ⚠️ `heldRef` IS A ROW, NOT A QUERY PARAMETER. Issue #8: `blocked` names the
 * ticket in the way, and the caller supplies that name from the record it has
 * just rendered. Carrying it in the URL instead would let a hand-edited link
 * write the reference the sentence accuses a responder of holding. Callers with
 * nothing to name pass nothing -- and `blocked` then renders NOTHING rather
 * than an unnamed accusation (issue #9); `notice.ts` owns that rule, so both
 * pages get it without either one branching on the code.
 */
export function NoticeBanner({
  code,
  heldRef,
}: {
  code: string | undefined;
  heldRef?: string | null;
}) {
  const text = noticeText(code, heldRef);
  if (!text) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-start gap-2.5 border-b border-yellow-100 bg-yellow-50 px-4 py-2.75 text-amber-800"
    >
      <Info size={17} className="mt-px shrink-0" aria-hidden />
      <span className="text-[13px] font-semibold text-pretty">{text}</span>
    </div>
  );
}
