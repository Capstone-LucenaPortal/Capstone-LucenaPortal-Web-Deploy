'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import ModalShell, { ModalCloseButton } from '@/portals/citizen/components/ui/modal-shell';
import { Button } from '@/portals/citizen/components/ui/button';
import { LIMITS } from '@/portals/citizen/lib/validation';
import { MAX_UPLOAD_BYTES, validateUploadFile } from '@/portals/citizen/lib/storage/file-validation';
import {
  attachSystemIssueScreenshot,
  submitSystemIssue,
  SystemIssueSubmitError,
} from '@/portals/citizen/features/system-issues/lib/system-issues';
import { capturePage, describeBrowser } from '@/portals/citizen/features/system-issues/lib/capture-context';
import { SYSTEM_ISSUE_CATEGORY_LABEL } from '@/portals/citizen/features/system-issues/lib/labels';
import type { SystemIssueCategory } from '@/portals/citizen/features/system-issues/types';

const BLUE = '#003DA5';
const TITLE_ID = 'website-problem-title';
const SCREENSHOT_INPUT_ID = 'website-problem-screenshot';
/** What a sent report hands back to the dialog. */
interface SentReport {
  reference: string;
  /** A screenshot was chosen but did not attach. The report itself was saved. */
  screenshotFailed: boolean;
}

/** The data module's own fallback copy, for a failure it did not translate. */
const GENERIC_FAILURE = 'We could not send your report right now. Please try again later.';

/**
 * `system_issue_category`, in the order the Citizen sees it. An enum, not a
 * `public_*` catalog: there is no table to read the five parts from. The
 * wording is the slice's one map, which the Dashboard card reads too.
 */
const CATEGORIES: { code: SystemIssueCategory; label: string }[] = (
  ['yellow_card', 'incidents', 'lcc', 'accounts', 'website'] as const
).map((code) => ({ code, label: SYSTEM_ISSUE_CATEGORY_LABEL[code] }));

/**
 * The incident page's side door (ADR 0013, variant C): a slim banner that opens
 * the System issue form in a dialog. A problem with the website is never an
 * Incident Report, so it never touches the incident form above which it sits.
 */
export function WebsiteProblemBanner() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <section style={{ padding: '32px clamp(16px, 5vw, 48px) 0', maxWidth: 1400, margin: '0 auto' }}>
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#C9D6EE] bg-[#EEF3FB] text-sm text-[#333333]"
          style={{ padding: '12px 16px' }}
        >
          <span>
            Did you run into a problem with <strong>this website</strong>?
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-semibold underline"
            style={{ color: BLUE, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Report a website problem
          </button>
        </div>
      </section>
      {open && <WebsiteProblemDialog onClose={close} />}
    </>
  );
}

function WebsiteProblemDialog({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState<SentReport | null>(null);
  // Remounted by "Report something else", so the next report starts empty.
  const [formKey, setFormKey] = useState(0);

  return (
    <ModalShell
      labelledBy={TITLE_ID}
      onClose={onClose}
      panelClassName="relative w-full bg-white rounded shadow-lg"
      panelStyle={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', margin: 16, padding: '28px clamp(20px, 5vw, 32px)' }}
    >
      <ModalCloseButton onClose={onClose} />
      <h2 id={TITLE_ID} style={{ fontSize: 20, fontWeight: 700, color: BLUE, marginBottom: 6, paddingRight: 32 }}>
        Report a problem with this website
      </h2>
      {sent !== null ? (
        <div style={{ textAlign: 'center', padding: '16px 0 4px' }}>
          <div aria-hidden="true" style={{ fontSize: 40, color: '#16A34A', marginBottom: 8 }}>✓</div>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#333333', marginBottom: 8 }}>Thanks, we&apos;ve got it</p>
          <p style={{ fontSize: 14, color: '#555555', lineHeight: 1.6 }}>
            Your reference number is <strong style={{ fontFamily: 'monospace' }}>{sent.reference}</strong>. The city&apos;s IT office will
            look into it, and we&apos;ll let you know when it&apos;s fixed.
          </p>
          {sent.screenshotFailed && (
            <p
              role="status"
              style={{ marginTop: 12, padding: '10px 14px', background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 4, fontSize: 13, color: '#6D4C00' }}
            >
              Your screenshot didn&apos;t attach, but your report was sent. You can describe what you saw in a new report if it
              helps.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setFormKey((k) => k + 1);
            }}
            className="font-semibold underline"
            style={{ marginTop: 16, color: BLUE, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            Report something else
          </button>
        </div>
      ) : (
        <WebsiteProblemForm key={formKey} onSent={setSent} />
      )}
    </ModalShell>
  );
}

function WebsiteProblemForm({ onSent }: { onSent: (sent: SentReport) => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState<SystemIssueCategory | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState('');
  // Counts choices and removals, so a slow check of an earlier file can't land last.
  const screenshotChoice = useRef(0);
  // Captured once, when the form opens, so the note shows what is actually sent.
  const [context] = useState(() => ({
    page: capturePage(),
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  }));

  const ready = category !== null && description.trim() !== '';

  // Refused here, before anything is sent, with the incident photo's own copy.
  const chooseScreenshot = async (file: File | undefined) => {
    if (!file) return;
    const choice = ++screenshotChoice.current;
    const problem = await validateUploadFile(file, 'image');
    if (choice !== screenshotChoice.current) return;
    setScreenshotError(problem ?? '');
    setScreenshot(problem ? null : file);
  };

  const send = async () => {
    if (!ready || sending) return;
    setError('');
    setSending(true);
    let result;
    try {
      result = await submitSystemIssue({ category, description, ...context });
    } catch (err) {
      setError(err instanceof SystemIssueSubmitError ? err.message : GENERIC_FAILURE);
      setSending(false);
      return;
    }
    // The report is saved by now: a screenshot that fails to attach only adds a note.
    let screenshotFailed = false;
    if (screenshot) {
      try {
        await attachSystemIssueScreenshot(result.issueId, screenshot);
      } catch {
        screenshotFailed = true;
      }
    }
    onSent({ reference: result.referenceNumber, screenshotFailed });
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: '#666666', lineHeight: 1.6, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #DDDDDD' }}>
        A page that won&apos;t load, a button that does nothing, a form that won&apos;t submit. This goes to the city&apos;s IT
        office, not to a department.
      </p>
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
        <legend style={{ fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}>
          <span style={{ color: '#C62828' }}>*</span> Which part of the website?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CATEGORIES.map(({ code, label }) => (
            <label
              key={code}
              className={`flex cursor-pointer items-center gap-2 rounded border text-sm ${
                category === code ? 'border-[#003DA5] bg-[#EEF3FB] font-semibold text-[#003DA5]' : 'border-[#CCCCCC] text-[#333333] hover:border-[#003DA5]'
              }`}
              style={{ padding: '10px 12px' }}
            >
              <input
                type="radio"
                name="website-problem-category"
                value={code}
                checked={category === code}
                onChange={() => setCategory(code)}
                style={{ accentColor: BLUE }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="website-problem-description" style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}>
          <span style={{ color: '#C62828' }}>*</span> What went wrong?
        </label>
        <textarea
          id="website-problem-description"
          rows={4}
          maxLength={LIMITS.description}
          className="w-full rounded border border-[#CCCCCC] text-sm text-[#333333] outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
          style={{ padding: '12px 16px', width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="What were you trying to do, and what happened instead? For example: “I pressed Submit on my Yellow Card application and nothing happened.”"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label htmlFor={SCREENSHOT_INPUT_ID} style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 8 }}>
          Add a screenshot (optional)
          <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: '#666666', marginTop: 2 }}>
            JPG or PNG • Max {MAX_UPLOAD_BYTES / (1024 * 1024)}MB
          </span>
        </label>
        {/* The native input is visually hidden: its own "No file chosen" would contradict the chosen file below. */}
        <div className="rounded focus-within:ring-2 focus-within:ring-[#003DA5]" style={{ display: 'inline-block' }}>
          <input
            id={SCREENSHOT_INPUT_ID}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => {
              void chooseScreenshot(e.target.files?.[0]);
              // Cleared, so choosing the same file again after a remove still fires.
              e.target.value = '';
            }}
          />
          <label
            htmlFor={SCREENSHOT_INPUT_ID}
            className="cursor-pointer rounded border border-[#CCCCCC] bg-white text-sm font-semibold hover:border-[#003DA5]"
            style={{ display: 'inline-block', padding: '6px 12px', color: BLUE }}
          >
            {screenshot ? 'Choose a different image' : 'Choose an image'}
          </label>
        </div>
        {screenshotError && <p style={{ color: '#C62828', fontSize: 12, marginTop: 6 }}>{screenshotError}</p>}
        {screenshot && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#F0F8FF', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: BLUE, overflowWrap: 'anywhere' }}>{screenshot.name}</span>
            <button
              type="button"
              aria-label="Remove screenshot"
              onClick={() => {
                screenshotChoice.current += 1;
                setScreenshot(null);
              }}
              style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: 14 }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      <div style={{ marginBottom: 16, padding: 12, background: '#F5F7FA', borderRadius: 4, fontSize: 12, color: '#555555', lineHeight: 1.6 }}>
        <p>
          To help us find the problem, we&apos;ll also send the page you came from (<code>{context.page || '/'}</code>) and your
          browser and device ({describeBrowser(context.userAgent)}).
        </p>
        <p style={{ marginTop: 4 }}>
          {user?.email && (
            <>
              You&apos;re reporting as <strong>{user.email}</strong>.{' '}
            </>
          )}
          We&apos;ll let you know when it&apos;s fixed.
        </p>
      </div>
      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, fontSize: 13, color: '#B91C1C' }}>
          {error}
        </div>
      )}
      <Button
        variant="primary"
        onClick={send}
        disabled={!ready}
        loading={sending}
        style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 700 }}
      >
        Send report
      </Button>
    </div>
  );
}
