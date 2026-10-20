"use client";

import { BottomSheet } from "@/portals/responder/components/ui/bottom-sheet";
import { useOnlinePush } from "@/portals/responder/lib/use-online";
import { AfterPhotoUploader } from "@/portals/responder/features/incidents/components/after-photo-uploader";

/**
 * The sheet is chrome; `AfterPhotoUploader` is the thing that works. Splitting
 * them keeps the three-step reserve → PUT → confirm sequence in one file that
 * can be reasoned about without the dialog around it.
 */
export function AddPhotoSheet({
  closeHref,
  incidentId,
}: {
  closeHref: string;
  incidentId: string;
}) {
  // Closing navigates; offline it is held, so the sheet stays (issue #7).
  const push = useOnlinePush();

  return (
    <BottomSheet
      open
      onClose={() => push(closeHref)}
      title="Add the after photo"
      description="Shoot the finished work from roughly where the citizen's photo was taken."
    >
      <AfterPhotoUploader incidentId={incidentId} />
    </BottomSheet>
  );
}
