"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { HistoryTimeline } from "@/portals/super-staff/components/ui/history-timeline";
import { Input } from "@/portals/super-staff/components/ui/input";
import { Select } from "@/portals/super-staff/components/ui/select";
import { ImageField } from "@/portals/super-staff/components/media/image-field";
import { Textarea } from "@/portals/super-staff/components/ui/textarea";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { useAuditHistory } from "@/portals/super-staff/features/audit-log/hooks/use-audit-history";
import { useEditableRecord } from "@/portals/super-staff/lib/hooks/use-editable-record";
import { localInputToIso } from "@/portals/super-staff/lib/datetime";
import { listPostCategories } from "@/portals/super-staff/features/announcements/lib/queries";
import type { PostCategoryOption } from "@/portals/super-staff/features/announcements/types";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { toCreateEventArgs, toUpdateEventArgs } from "../lib/event-args";
import { EMPTY, toFormValue, toInput, type FormValue } from "../lib/form-value";
import { getEvent } from "../lib/queries";
import type { CityEvent, EventInput } from "../types";

type FormErrors = Partial<
  Record<"title" | "locationText" | "startAt" | "endAt", string>
>;

/** `create_event` requires a title, a location and a start — those three have no
 *  default, so the database would reject a blank rather than accept it. */
function validateEvent(v: FormValue): FormErrors {
  const errors: FormErrors = {};
  if (!v.title.trim()) errors.title = "Title is required.";
  if (!v.locationText.trim()) errors.locationText = "Location is required.";

  const startAt = localInputToIso(v.startLocal);
  const endAt = localInputToIso(v.endLocal);
  if (!startAt) {
    errors.startAt = "Start is required.";
  } else if (endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    errors.endAt = "End must be after the start.";
  }
  return errors;
}

export function EventEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [errors, setErrors] = useState<FormErrors>({});
  const [categories, setCategories] = useState<PostCategoryOption[]>([]);

  const { history, refresh: refreshHistory } = useAuditHistory();

  const {
    isEdit,
    record: event,
    setRecord: setEvent,
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
    load: getEvent,
    toFormValue,
    empty: EMPTY,
    onLoaded: (r) => void refreshHistory(r.id),
  });

  // Events draw from the same platform_post_categories table as posts.
  useEffect(() => {
    let active = true;
    listPostCategories()
      .then((rows) => {
        if (active) setCategories(rows);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);


  function validate(): EventInput | null {
    const found = validateEvent(value);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast("Fix the highlighted fields.", "error");
      return null;
    }
    return toInput(value);
  }

  async function handleSave() {
    const input = validate();
    if (!input) return;
    setBusy(true);
    try {
      if (!isEdit) {
        const created = await callRpc("create_event", toCreateEventArgs(input));
        toast("Event saved.", "success");
        router.push(`/super-staff/events/${created.id}`);
        return;
      }
      // Unlike posts, publication is part of the same call — no second RPC.
      await callRpc("update_event", toUpdateEventArgs(event!.id, input));
      const fresh = await getEvent(id!);
      if (fresh) {
        setEvent(fresh);
        setValue(toFormValue(fresh));
        await refreshHistory(fresh.id);
      }
      toast("Changes saved.", "success");
    } catch (e: unknown) {
      toast(rpcErrorMessage(e, "Could not save. Try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-gray-500">Loading…</p>;
  }
  if (notFound) {
    return <p className="mt-6 text-sm text-gray-500">Event not found.</p>;
  }

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">
          {isEdit ? value.title || "Untitled event" : "New event"}
        </h1>
        <p className="text-gray-500 mt-2">
          City events shown on the Citizen Portal.
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
                <label
                  htmlFor="description"
                  className="text-sm font-medium text-gray-900"
                >
                  Description (optional)
                </label>
                <Textarea
                  id="description"
                  rows={8}
                  value={value.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="location"
                  className="text-sm font-medium text-gray-900"
                >
                  Location
                </label>
                <Input
                  id="location"
                  value={value.locationText}
                  error={errors.locationText}
                  onChange={(e) => set({ locationText: e.target.value })}
                />
              </div>
              <ImageField
                kind="event"
                imagePath={value.imagePath}
                version={event?.updatedAt}
                disabled={busy}
                onUploaded={(path) => set({ imagePath: path })}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scheduling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="category" className="text-sm font-medium text-gray-900">
                  Category (optional)
                </label>
                <Select
                  id="category"
                  value={value.categoryCode}
                  onChange={(e) => set({ categoryCode: e.target.value })}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
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

              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={value.isPublished}
                  onChange={(e) => set({ isPublished: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-lucena-blue focus:ring-lucena-blue"
                />
                Published on the Citizen Portal
              </label>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => router.push("/super-staff/events")}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={busy}>
                  {isEdit ? "Save changes" : "Save event"}
                </Button>
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
    </div>
  );
}
