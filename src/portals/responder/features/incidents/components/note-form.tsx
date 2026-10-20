import { postNote } from "@/portals/responder/features/incidents/actions";
import { NOTE_MAX_LENGTH } from "@/portals/responder/features/incidents/lib/work";

/**
 * A note is a standalone timeline entry, not an annotation on a stage: one
 * posted an hour after arriving is about now, not about arriving.
 *
 * Uncontrolled — React resets a form after a function action succeeds, so the
 * box empties itself without any state. `maxLength` is a courtesy; the real cap
 * is the 140 characters hardcoded inside `add_incident_note`, which raises and
 * lands as `?notice=note_limit`.
 */
export function NoteForm({ incidentId }: { incidentId: string }) {
  return (
    <form action={postNote} className="mt-2.75 flex gap-2">
      <input type="hidden" name="incidentId" value={incidentId} />
      <input
        name="note"
        type="text"
        maxLength={NOTE_MAX_LENGTH}
        aria-label="Add a note to the timeline"
        placeholder="Add a note to the timeline (optional)"
        className="h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 text-[13.5px] text-gray-900"
      />
      <button
        type="submit"
        className="h-10 rounded-md border border-gray-300 bg-gray-100 px-3.5 text-[13.5px] font-semibold text-gray-900"
      >
        Post
      </button>
    </form>
  );
}
