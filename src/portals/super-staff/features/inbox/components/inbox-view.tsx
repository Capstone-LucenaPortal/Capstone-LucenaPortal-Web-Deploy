"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/portals/super-staff/components/ui/badge";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/portals/super-staff/components/ui/card";
import { useToast } from "@/portals/super-staff/components/providers/toast-provider";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { cn, formatDate, formatDateTime } from "@/portals/super-staff/lib/utils";
import { listContactMessages } from "../lib/queries";
import { CONTACT_STATUSES, countUnread, statusLabel } from "../lib/status";
import type { ContactMessage, ContactStatus } from "../types";

const STATUS_VARIANT: Record<ContactStatus, "info" | "default"> = {
  new: "info",
  read: "default",
  archived: "default",
};

function preview(message: string): string {
  const flat = message.replace(/\s+/g, " ").trim();
  return flat.length > 70 ? `${flat.slice(0, 70)}…` : flat;
}

export function InboxView() {
  const { toast } = useToast();
  const [all, setAll] = useState<ContactMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listContactMessages()
      .then((rows) => {
        if (!active) return;
        setAll(rows);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(rpcErrorMessage(e, "Could not load the inbox."));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const unread = useMemo(() => countUnread(all), [all]);
  const selected = useMemo(
    () => all.find((m) => m.id === selectedId) ?? null,
    [all, selectedId],
  );

  // Opening a message must NOT auto-mark it read: the RPC stamps handled_by and
  // handled_at, so marking is a record of staff action and has to be a click.
  async function setStatus(id: string, status: ContactStatus) {
    setBusy(true);
    try {
      await callRpc("mark_contact_message_handled", {
        p_id: id,
        p_status: status,
      });
      setAll(await listContactMessages());
      toast(`Marked ${statusLabel(status).toLowerCase()}.`, "success");
    } catch (e: unknown) {
      toast(rpcErrorMessage(e, "Could not update the message."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-lucena-blue">Inbox</h1>
        <p className="text-gray-500 mt-2">
          Messages sent through the Citizen Portal&apos;s contact form.
          {unread > 0 ? ` ${unread} new.` : ""}
        </p>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : all.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No messages yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {all.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left hover:bg-gray-50",
                      selectedId === m.id && "bg-lucena-blue/5",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {m.status === "new" && (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full bg-lucena-blue"
                        />
                      )}
                      <span
                        className={cn(
                          "flex-1 truncate text-sm text-gray-900",
                          m.status === "new" && "font-semibold",
                        )}
                      >
                        {m.name}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {formatDate(m.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {preview(m.message)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            {selected === null ? (
              <p className="text-sm text-gray-500">
                Select a message to read it.
              </p>
            ) : (
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{selected.name}</CardTitle>
                    <p className="mt-1 text-sm text-gray-500">
                      <a
                        href={`mailto:${selected.email}`}
                        className="text-lucena-blue hover:text-lucena-blue-dark"
                      >
                        {selected.email}
                      </a>
                      {" · "}
                      {formatDateTime(selected.createdAt)}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[selected.status]}>
                    {statusLabel(selected.status)}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                    {selected.message}
                  </p>

                  {selected.handledAt && (
                    // "Last touched by", not "Handled by" — a revert to new also
                    // stamps these columns.
                    <p className="text-xs text-gray-500">
                      Last touched by {selected.handledByName ?? "a staff member"}{" "}
                      on {formatDateTime(selected.handledAt)}.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4">
                    {CONTACT_STATUSES.map((s) => (
                      <Button
                        key={s}
                        variant={s === selected.status ? "primary" : "secondary"}
                        onClick={() => setStatus(selected.id, s)}
                        disabled={busy || s === selected.status}
                      >
                        Mark {statusLabel(s).toLowerCase()}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
