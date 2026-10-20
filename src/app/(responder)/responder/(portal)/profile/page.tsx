"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Info } from "lucide-react";
import { createClient } from "@/shared/supabase/client";
import { BottomSheet } from "@/portals/responder/components/ui/bottom-sheet";
import { DutySwitch } from "@/portals/responder/components/ui/duty-switch";
import { useToast } from "@/portals/responder/components/ui/toast";
import { PhoneAlertsSetting } from "@/portals/responder/features/alerts/components/phone-alerts";
import { usePhoneAlerts } from "@/portals/responder/features/alerts/hooks/use-phone-alerts";
import { forgetDevice, unsubscribeDevice } from "@/portals/responder/features/alerts/lib/device";
import { PasswordSheet } from "@/portals/responder/features/auth/components/password-sheet";
import { useDuty, useSession } from "@/portals/responder/features/auth/hooks/use-session";
import { firstNameOf, initialsOf } from "@/portals/responder/features/auth/lib/name";

export default function ProfilePage() {
  const { onDuty } = useDuty();
  const { responder, duty } = useSession();
  const { showToast } = useToast();
  const { recheck: recheckAlerts } = usePhoneAlerts();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Session-only: there is no Storage bucket yet, so the photo lives here and
  // is gone on refresh.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);

    // ADR 0001: signing out takes this phone off the responder's alerts, so a
    // shared department phone does not ring for whoever used it last. The row
    // is deleted first because the RPC needs the session; forgetDevice()
    // never throws, so an alert can never block a sign-out.
    // ⚠️ Only here. The idle sign-out (idle-timeout.tsx) deliberately keeps
    // the sign-up: a phone left alone is exactly the phone an alert is for.
    await forgetDevice();

    // Clear the session BEFORE navigating, and await it. Navigating first only
    // hides the portal behind /login — the auth cookie survives, so typing
    // /pool walks straight back in with no credentials. On a shared field
    // device that hands the next person the previous responder's session.
    const { error } = await createClient().auth.signOut();

    if (error) {
      // supabase-js keeps the local session when the revoke call fails, so the
      // cookie is still live. Staying put with a visible error is the honest
      // outcome: bouncing to /login would show a sign-in form to someone who
      // is in fact still signed in, which is exactly the bug being fixed here.
      setSigningOut(false);
      setSignOutOpen(false);
      showToast("Could not sign you out. Check your connection and try again.");
      // The row may be gone already; let the setting say so.
      void recheckAlerts();
      return;
    }

    // Kill the endpoint in the browser too, so a row that survived the delete
    // above gets a 410 and is removed by the sender.
    await unsubscribeDevice();

    // replace(), not push(): the portal must not be one Back away.
    // refresh() drops the cached RSC render that still holds the profile.
    router.replace("/responder/login");
    router.refresh();
  }

  async function changePassword(
    current: string,
    next: string,
  ): Promise<string | null> {
    const supabase = createClient();

    // updateUser({password}) authorises on the SESSION and never checks the
    // current password. Without this re-authentication the "Current password"
    // field would be decorative, and an unattended unlocked device would be one
    // tap away from a password change by whoever is standing at it.
    //
    // A failed signInWithPassword does not clear the existing session, so a
    // wrong guess leaves the responder signed in and on this page.
    //
    // responder.email is the address the database holds, not one the user
    // typed, so a typo in the form cannot become a sign-in attempt against
    // somebody else's account.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: responder.email,
      password: current,
    });
    if (reauthError) return "That current password isn't right.";

    const { error: updateError } = await supabase.auth.updateUser({
      password: next,
    });
    if (updateError) return updateError.message;

    showToast("Password updated.");
    return null;
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const removePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 pb-6">
      <section className="flex items-center gap-3.5 rounded-lg border border-gray-200 bg-white p-4.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={photoUrl ? "Change profile photo" : "Add profile photo"}
          className="relative flex h-14.5 w-14.5 shrink-0 items-center justify-center rounded-full bg-lucena-blue text-xl font-bold text-white"
        >
          {photoUrl ? (
            <span
              role="img"
              aria-label="Profile photo"
              style={{ backgroundImage: `url(${photoUrl})` }}
              className="absolute inset-0 rounded-full bg-cover bg-center"
            />
          ) : (
            <span>{initialsOf(responder.full_name)}</span>
          )}
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-lucena-yellow text-gray-900"
          >
            <Camera size={13} />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-gray-900">
            {responder.full_name}
          </p>
          <p className="text-[13px] text-gray-500">
            {responder.department_label}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-gray-500">
            Employee ID {responder.employee_id}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-8 rounded-md border border-gray-300 bg-white px-3 text-[12.5px] font-semibold text-gray-900 hover:bg-gray-50"
            >
              {photoUrl ? "Change photo" : "Add photo"}
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={removePhoto}
                className="h-8 rounded-md border border-gray-200 bg-white px-3 text-[12.5px] font-semibold text-gray-500 hover:bg-gray-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="Profile photo"
          onChange={onPickFile}
          className="hidden"
        />
      </section>

      <section className="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p id="profile-duty-label" className="text-[14.5px] font-semibold">
              On duty
            </p>
            <p className="mt-0.5 text-[12.5px] text-pretty text-gray-500">
              {onDuty
                ? "Your department counts you in this shift."
                : "Your department doesn't count you in this shift. The pool stays browsable and claimable."}
            </p>
          </div>
          <DutySwitch size="lg" labelledBy="profile-duty-label" />
        </div>
        {/* ADR 0001: the opt-in lives under the switch, because duty is what
            decides whether a signed-up phone rings. */}
        <PhoneAlertsSetting onDuty={onDuty} />
        {duty && (
          <p className="mt-3 border-t border-gray-100 pt-3 text-[12.5px] text-gray-500">
            Department on duty right now:{" "}
            <b className="text-gray-900">
              {duty.onDuty} of {duty.total}
            </b>
          </p>
        )}
      </section>

      <section className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <InfoRow label="Email" value={responder.email} />
        <InfoRow label="Phone" value={responder.phone} numeric />
        <InfoRow label="Department" value={responder.department_label} last />
      </section>

      <section className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">Password</p>
          <p className="mt-0.5 text-[12.5px] text-gray-500">
            You&rsquo;ll need your current one to change it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPasswordOpen(true)}
          className="h-10 shrink-0 rounded-md border border-lucena-blue bg-white px-3.5 text-[13.5px] font-semibold text-lucena-blue hover:bg-blue-50"
        >
          Reset password
        </button>
      </section>

      <div className="mt-3 flex gap-2.5 rounded-lg bg-blue-50 px-3.5 py-3 text-blue-800">
        <Info size={17} className="mt-px shrink-0" aria-hidden />
        <p className="text-[12.5px] text-pretty">
          Citizens see{" "}
          <b>
            {firstNameOf(responder.full_name)} from {responder.department_label}
          </b>{" "}
          — never your full name. Admin manages your account and department.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setSignOutOpen(true)}
        className="mt-3 h-11 w-full rounded-md border border-gray-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50"
      >
        Sign out
      </button>

      {/* The "Reset the prototype" card is GONE. It cleared the claim cookie,
          and there is no prototype state left to reset — the claim is a row now
          and clearing it would mean releasing a ticket, which has its own sheet
          and demands a reason. A button that clears nothing is worse than no
          button. */}

      <PasswordSheet
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onSubmit={changePassword}
      />

      <BottomSheet
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out?"
        description="You'd need your LGU email and password to get back in."
      >
        <div className="mt-4.5 flex gap-2.5">
          <button
            type="button"
            disabled={signingOut}
            onClick={() => setSignOutOpen(false)}
            className="h-12 flex-1 rounded-md border border-gray-300 bg-white text-[15px] font-semibold text-gray-900 hover:bg-gray-50 disabled:text-gray-400"
          >
            Stay signed in
          </button>
          {/* The sheet is NOT closed before the call. Closing first and then
              failing would leave the responder on a profile page with a toast
              and no idea whether they are signed in. */}
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className="h-12 flex-1 rounded-md bg-red-600 text-[15px] font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function InfoRow({
  label,
  value,
  numeric = false,
  last = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 px-4 py-3.25 ${last ? "" : "border-b border-gray-100"}`}
    >
      <span className="text-[13px] text-gray-500">{label}</span>
      <span
        className={`text-[13px] font-medium text-gray-900 ${numeric ? "tabular-nums" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
