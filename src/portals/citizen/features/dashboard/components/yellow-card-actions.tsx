'use client';

import { useState } from 'react';
import {
  isYellowCardApplicationStatus,
  type MyYellowCardApplication,
  type YellowCardApplicationStatus,
} from '@/portals/citizen/features/yellow-card/types';
import { yellowCardService } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import { actionRow, inlineError, inlineNotice, primaryAction, secondaryAction } from '../lib/action-styles';

interface Props {
  application: MyYellowCardApplication;
  onChanged: () => void;
}

/**
 * Statuses `withdraw_yellow_card_application` accepts: `pending` and
 * `revision_requested`. `resubmitted` is live but excluded, because staff are
 * actively holding it and the SLA is running against them. The DB remains the
 * authority; this only decides whether to render a control at all.
 */
const WITHDRAWABLE: ReadonlySet<YellowCardApplicationStatus> = new Set<YellowCardApplicationStatus>([
  'pending',
  'revision_requested',
]);

/**
 * Withdraw an application whose status is in `WITHDRAWABLE`.
 *
 * `submit_yellow_card_application`'s own 23505 duplicate error tells the
 * citizen to withdraw before applying again — an instruction the portal used to
 * drop, because no withdraw control existed anywhere. A citizen who had
 * abandoned a revision was simply stuck.
 */
export default function YellowCardActions({ application, onChanged }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A status the frontend does not know renders nothing.
  const { status } = application;
  if (!isYellowCardApplicationStatus(status)) return null;
  if (!WITHDRAWABLE.has(status)) return null;

  const withdraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await yellowCardService.withdrawApplication(application.id);
      setConfirming(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not withdraw that application right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {!confirming ? (
        <div style={actionRow}>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={secondaryAction()}
          >
            Withdraw application
          </button>
        </div>
      ) : (
        <>
          <div style={inlineNotice}>
            Withdrawing cancels this application. You can apply again afterwards, but the review
            already done on it will not carry over.
          </div>
          <div style={actionRow}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void withdraw()}
              style={primaryAction('#DC2626', busy)}
            >
              {busy ? 'Withdrawing…' : 'Yes, withdraw it'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              style={secondaryAction(busy)}
            >
              Keep my application
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" style={inlineError}>
          {error}
        </p>
      )}
    </div>
  );
}
