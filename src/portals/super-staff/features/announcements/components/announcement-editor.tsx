"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { HistoryTimeline } from "@/portals/super-staff/components/ui/history-timeline";
import { ImageField } from "@/portals/super-staff/components/media/image-field";
import { Input } from "@/portals/super-staff/components/ui/input";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import { Select } from "@/portals/super-staff/components/ui/select";
import { Textarea } from "@/portals/super-staff/components/ui/textarea";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { useAuditHistory } from "@/portals/super-staff/features/audit-log/hooks/use-audit-history";
import { useEditableRecord } from "@/portals/super-staff/lib/hooks/use-editable-record";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { formatDate } from "@/portals/super-staff/lib/utils";
import { localInputToIso } from "@/portals/super-staff/lib/datetime";
import { EMPTY, toFormValue, toInput, type FormValue } from "../lib/form-value";
import { previewPublishedStatus } from "../lib/lifecycle";
import { toCreatePostArgs, toUpdatePostArgs } from "../lib/post-args";
import { getAnnouncement, listPostCategories } from "../lib/queries";
import { validateAnnouncement, type AnnouncementErrors } from "../lib/validation";
import type {
  Announcement,
  AnnouncementInput,
  ContentType,
  PostCategoryOption,
} from "../types";
import { StatusBadge } from "./announcement-badges";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "announcement", label: "Announcement" },
  { value: "news", label: "News" },
];

export function AnnouncementEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [errors, setErrors] = useState<AnnouncementErrors>({});
  const [categories, setCategories] = useState<PostCategoryOption[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);

  // Matched on the row id, never the title — a rename must not orphan a history.
  const { history, refresh: refreshHistory } = useAuditHistory();

  const {
    isEdit,
    record: announcement,
    setRecord: setAnnouncement,
    notFound,
    value,
    setValue,
    set,
    loading,
    setLoading,
    busy,
    setBusy,
  } = useEditableRecord({
    id,
    load: getAnnouncement,
    toFormValue,
    empty: EMPTY,
    onLoaded: (r) => void refreshHistory(r.id),
  });

  useEffect(() => {
    let active = true;
    listPostCategories()
      .then((rows) => {
        if (active) setCategories(rows);
      })
      .catch(() => {
        // A missing category list is reported by validation on save, not by a
        // toast on mount — the editor is still usable for the other fields.
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);


  const status = announcement?.status ?? "Draft";
  const isPublished = announcement?.isPublished ?? false;

  const validate = (): AnnouncementInput | null => {
    const input = toInput(value);
    const found = validateAnnouncement(input);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast("Fix the highlighted fields.", "error");
      return null;
    }
    return input;
  };

  // Refetching after every write is deliberate: status is derived server-side,
  // so the only honest way to know the new status is to read it back.
  async function reload(postId: string) {
    const fresh = await getAnnouncement(postId);
    if (fresh) {
      setAnnouncement(fresh);
      setValue(toFormValue(fresh));
      await refreshHistory(fresh.id);
    }
  }

  async function handleSave() {
    const input = validate();
    if (!input) return;
    setBusy(true);
    try {
      if (!isEdit) {
        const created = await callRpc("create_post", toCreatePostArgs(input));
        toast("Draft saved.", "success");
        router.push(`/super-staff/announcements/${created.id}`);
        return;
      }
      await callRpc("update_post", toUpdatePostArgs(announcement!.id, input));
      await reload(id!);
      toast("Changes saved.", "success");
    } catch (e: unknown) {
      toast(rpcErrorMessage(e, "Could not save. Try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  // Publication is a SECOND rpc: update_post takes no p_is_published, because
  // status is derived from is_published plus the date window.
  async function handlePublish() {
    const input = validate();
    if (!input) return;
    setBusy(true);
    let savedId = id ?? null;
    try {
      if (!isEdit) {
        const created = await callRpc("create_post", toCreatePostArgs(input));
        savedId = created.id;
      } else {
        await callRpc("update_post", toUpdatePostArgs(announcement!.id, input));
      }
    } catch (e: unknown) {
      toast(rpcErrorMessage(e, "Could not save. Try again."), "error");
      setBusy(false);
      return;
    }

    try {
      await callRpc("set_post_published", {
        p_id: savedId!,
        p_is_published: true,
      });
      setPublishOpen(false);
      toast("Announcement published.", "success");
    } catch (e: unknown) {
      // The field edits already persisted. Say so — "could not publish" alone
      // would imply nothing was saved.
      toast(
        rpcErrorMessage(e, "Your edits were saved, but publishing failed."),
        "error",
      );
    } finally {
      setBusy(false);
    }

    if (!isEdit && savedId) {
      router.push(`/super-staff/announcements/${savedId}`);
      return;
    }
    await reload(savedId!);
  }

  async function handleUnpublish() {
    if (!isEdit || !announcement) return;
    setBusy(true);
    try {
      await callRpc("set_post_published", {
        p_id: announcement.id,
        p_is_published: false,
      });
      await reload(announcement.id);
      setUnpublishOpen(false);
      toast("Reverted to draft.", "success");
    } catch (e: unknown) {
      toast(rpcErrorMessage(e, "Could not unpublish. Try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-gray-500">Loading…</p>;
  }
  if (notFound) {
    return <p className="mt-6 text-sm text-gray-500">Announcement not found.</p>;
  }

  // What Publish would produce, for the confirm-modal copy only.
  const preview = previewPublishedStatus(
    localInputToIso(value.startLocal),
    localInputToIso(value.endLocal),
    new Date(),
  );

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">
          {isEdit ? value.title || "Untitled announcement" : "New announcement"}
        </h1>
        <p className="text-gray-500 mt-2">
          Front-page notices for the Citizen Portal.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-col gap-1">
                <label htmlFor="title" className="text-sm font-medium text-gray-900">
                  Title
                </label>
                <Input
                  id="title"
                  value={value.title}
                  error={errors.title}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="body" className="text-sm font-medium text-gray-900">
                  Body
                </label>
                <Textarea
                  id="body"
                  rows={10}
                  value={value.body}
                  error={errors.body}
                  onChange={(e) => set({ body: e.target.value })}
                />
              </div>
              <ImageField
                kind="post"
                imagePath={value.imagePath}
                version={announcement?.lastEditedAt}
                disabled={busy}
                onUploaded={(path) => set({ imagePath: path })}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Publishing</CardTitle>
              <StatusBadge status={status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="contentType" className="text-sm font-medium text-gray-900">
                  Type
                </label>
                <Select
                  id="contentType"
                  value={value.contentType}
                  onChange={(e) =>
                    set({ contentType: e.target.value as ContentType })
                  }
                  disabled={isEdit}
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                {isEdit && (
                  <p className="text-xs text-gray-500">
                    update_post cannot change the type.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="category" className="text-sm font-medium text-gray-900">
                  Category
                </label>
                <Select
                  id="category"
                  value={value.categoryCode}
                  onChange={(e) => set({ categoryCode: e.target.value })}
                >
                  <option value="">Choose a category…</option>
                  {categories.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                {errors.categoryCode && (
                  <p className="text-xs text-red-600">{errors.categoryCode}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="start" className="text-sm font-medium text-gray-900">
                  Start
                </label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={value.startLocal}
                  error={errors.startAt}
                  onChange={(e) => set({ startLocal: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="end" className="text-sm font-medium text-gray-900">
                  End (optional)
                </label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={value.endLocal}
                  error={errors.endAt}
                  onChange={(e) => set({ endLocal: e.target.value })}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => router.push("/super-staff/announcements")}
                  disabled={busy}
                >
                  Cancel
                </Button>
                {!isPublished ? (
                  <>
                    <Button variant="secondary" onClick={handleSave} disabled={busy}>
                      Save draft
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (validate()) setPublishOpen(true);
                      }}
                      disabled={busy}
                    >
                      Publish
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setUnpublishOpen(true)}
                      disabled={busy}
                    >
                      Unpublish
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={busy}>
                      Save changes
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {isEdit && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <HistoryTimeline items={history} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)}>
        <h3 className="text-lg font-semibold text-gray-900">
          {preview === "Scheduled"
            ? "Schedule this announcement?"
            : "Publish this announcement?"}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {preview === "Scheduled"
            ? `This will be scheduled to go live on ${formatDate(
                localInputToIso(value.startLocal) ?? new Date().toISOString(),
              )}.`
            : preview === "Expired"
              ? "The end date has already passed, so this will publish as Expired and stay off the portal until you extend or clear it."
              : "This goes live on the Citizen Portal now."}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setPublishOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handlePublish} disabled={busy}>
            {preview === "Scheduled" ? "Schedule" : "Publish"}
          </Button>
        </div>
      </Modal>

      <Modal open={unpublishOpen} onClose={() => setUnpublishOpen(false)}>
        <h3 className="text-lg font-semibold text-gray-900">
          Revert to draft?
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          This takes the notice off the Citizen Portal and returns it to a draft.
          Recorded in the audit log.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setUnpublishOpen(false)}
            disabled={busy}
          >
            Keep published
          </Button>
          <Button variant="destructive" onClick={handleUnpublish} disabled={busy}>
            Revert to draft
          </Button>
        </div>
      </Modal>
    </div>
  );
}
