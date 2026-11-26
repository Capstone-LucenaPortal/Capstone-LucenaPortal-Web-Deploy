import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SystemIssueSubmission } from '@/portals/citizen/features/system-issues/types';
import {
  mapSystemIssueToParams,
  SystemIssueSubmitError,
  translateSystemIssueError,
  submitSystemIssue,
  attachSystemIssueScreenshot,
  SystemIssueScreenshotError,
} from '@/portals/citizen/features/system-issues/lib/system-issues';
import { requestService } from '@/portals/citizen/lib/mock/request-store';
import * as supabaseClientModule from '@/portals/citizen/lib/supabase/client';

const base: SystemIssueSubmission = {
  category: 'yellow_card',
  description: 'I pressed Submit on my Yellow Card application and nothing happened.',
  page: '/yellow-card',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36',
};

describe('mapSystemIssueToParams', () => {
  it('maps the form and the captured context onto the submit_system_issue params', () => {
    expect(mapSystemIssueToParams(base)).toEqual({
      p_category: 'yellow_card',
      p_description: 'I pressed Submit on my Yellow Card application and nothing happened.',
      p_page: '/yellow-card',
      p_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36',
    });
  });

  it('trims the description', () => {
    expect(mapSystemIssueToParams({ ...base, description: '  Page is blank.  ' }).p_description).toBe('Page is blank.');
  });

  it('throws SystemIssueSubmitError when no part of the website was chosen', () => {
    expect(() => mapSystemIssueToParams({ ...base, category: null })).toThrow(SystemIssueSubmitError);
  });

  it('throws SystemIssueSubmitError when the description is blank or whitespace-only', () => {
    expect(() => mapSystemIssueToParams({ ...base, description: '' })).toThrow(SystemIssueSubmitError);
    expect(() => mapSystemIssueToParams({ ...base, description: ' \n ' })).toThrow(SystemIssueSubmitError);
  });

  it('throws SystemIssueSubmitError when the description is over 2000 characters', () => {
    expect(() => mapSystemIssueToParams({ ...base, description: 'a'.repeat(2001) })).toThrow(SystemIssueSubmitError);
    expect(mapSystemIssueToParams({ ...base, description: 'a'.repeat(2000) }).p_description).toHaveLength(2000);
  });
});

describe('translateSystemIssueError', () => {
  // submit_system_issue raises PT429 on the 6th report in 24 hours (DB l128).
  it('turns the daily limit into the helpdesk message', () => {
    expect(translateSystemIssueError('PT429')).toBe(
      "You've sent 5 reports in the last 24 hours. If something is still wrong, please email helpdesk@lucena-city.gov.ph.",
    );
  });

  it('asks a caller who is not a signed-in Citizen to sign in', () => {
    expect(translateSystemIssueError('42501')).toBe('Please sign in to report a website problem.');
  });

  it('names the two required fields for a refused category or description', () => {
    expect(translateSystemIssueError('22023')).toBe(
      'Please choose which part of the website and tell us what went wrong, in 2,000 characters or fewer.',
    );
  });

  it('falls back to a plain message for anything else, never the raw database text', () => {
    const generic = 'We could not send your report right now. Please try again later.';
    expect(translateSystemIssueError(undefined)).toBe(generic);
    expect(translateSystemIssueError('22P02')).toBe(generic);
    expect(translateSystemIssueError('PGRST202')).toBe(generic);
  });
});

describe('submitSystemIssue in mock mode (no backend)', () => {
  beforeEach(() => localStorage.clear());

  it('fabricates an SI- reference and keeps the report in the dev store', async () => {
    const result = await submitSystemIssue(base);

    expect(result.mode).toBe('mock');
    expect(result.referenceNumber).toMatch(/^SI-\d{4}-\d{6}$/);
    const stored = requestService.getRequests().filter((r) => r.type === 'System Issue');
    expect(stored).toHaveLength(1);
    expect(stored[0].ticketNumber).toBe(result.referenceNumber);
    expect(stored[0].details).toMatchObject({ category: 'yellow_card', page: '/yellow-card' });
  });

  it('refuses a 6th report inside 24 hours with the helpdesk message, as the RPC does', async () => {
    for (let i = 0; i < 5; i++) await submitSystemIssue(base);

    await expect(submitSystemIssue(base)).rejects.toThrow(
      new SystemIssueSubmitError(translateSystemIssueError('PT429')),
    );
  });

  it('refuses a blank description without storing anything', async () => {
    await expect(submitSystemIssue({ ...base, description: '  ' })).rejects.toThrow(SystemIssueSubmitError);
    expect(requestService.getRequests()).toEqual([]);
  });
});

describe('submitSystemIssue against the backend', () => {
  const rpc = vi.fn();
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(
      { rpc } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('calls submit_system_issue and returns the trigger-assigned reference', async () => {
    rpc.mockResolvedValue({
      data: [{ issue_id: 'si-1', issue_reference: 'SI-2026-000007', issue_created_at: '2026-11-26T06:00:00Z' }],
      error: null,
    });

    const result = await submitSystemIssue(base);

    expect(rpc).toHaveBeenCalledWith('submit_system_issue', mapSystemIssueToParams(base));
    expect(result).toEqual({ issueId: 'si-1', referenceNumber: 'SI-2026-000007', mode: 'live' });
  });

  it('refuses to report success when the RPC returns no reference', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(submitSystemIssue(base)).rejects.toThrow(SystemIssueSubmitError);
  });

  it('throws the translated copy when the RPC refuses', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PT429', message: 'submit_system_issue: daily limit reached' } });

    await expect(submitSystemIssue(base)).rejects.toThrow(
      new SystemIssueSubmitError(translateSystemIssueError('PT429')),
    );
  });
});

describe('attachSystemIssueScreenshot in mock mode (no backend)', () => {
  it('does nothing: inventing a storage object would misrepresent it', async () => {
    const png = new File([new Uint8Array([1, 2, 3])], 'screen.png', { type: 'image/png' });

    await expect(attachSystemIssueScreenshot('si-1', png)).resolves.toBeUndefined();
  });
});

describe('attachSystemIssueScreenshot against the backend (DB l128b)', () => {
  const rpc = vi.fn();
  const upload = vi.fn();
  const from = vi.fn(() => ({ upload }));
  const png = new File([new Uint8Array([1, 2, 3, 4])], 'screen.png', { type: 'image/png' });
  const reserved = {
    data: [{ row_id: 'ss-1', bucket: 'system-issue-screenshots', storage_path: 'si/si-1/abc.png' }],
    error: null,
  };

  /** Scripts `rpc` by function name, one answer per name. */
  function script(answers: Record<string, { data: unknown; error: unknown }>) {
    rpc.mockImplementation(async (name: string) => answers[name] ?? { data: null, error: { code: 'XX000', message: `unscripted ${name}` } });
  }
  const calls = (name: string) => rpc.mock.calls.filter(([n]) => n === name);

  beforeEach(() => {
    rpc.mockReset();
    upload.mockReset();
    from.mockClear();
    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(
      { rpc, storage: { from } } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('reserves, uploads to the reserved path, then confirms the landed size and type', async () => {
    script({ request_system_issue_screenshot_upload: reserved, confirm_upload: { data: true, error: null } });
    upload.mockResolvedValue({ data: { path: 'si/si-1/abc.png' }, error: null });

    await attachSystemIssueScreenshot('si-1', png);

    expect(calls('request_system_issue_screenshot_upload')).toEqual([
      ['request_system_issue_screenshot_upload', { p_system_issue_id: 'si-1', p_ext: 'png' }],
    ]);
    expect(from).toHaveBeenCalledWith('system-issue-screenshots');
    expect(upload).toHaveBeenCalledWith('si/si-1/abc.png', png, { contentType: 'image/png' });
    expect(calls('confirm_upload')).toEqual([
      ['confirm_upload', { p_kind: 'system_issue_screenshot', p_row_id: 'ss-1', p_size_bytes: 4, p_mime_type: 'image/png' }],
    ]);
  });

  it('refuses a non-image before asking the database for anything', async () => {
    const pdf = new File([new Uint8Array([1])], 'notes.pdf', { type: 'application/pdf' });

    await expect(attachSystemIssueScreenshot('si-1', pdf)).rejects.toThrow(SystemIssueScreenshotError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('stops when the reservation is refused, and uploads nothing', async () => {
    script({
      request_system_issue_screenshot_upload: {
        data: null,
        error: { code: 'PT409', message: 'request_system_issue_screenshot_upload: SI-2026-000007 already has a screenshot' },
      },
    });

    await expect(attachSystemIssueScreenshot('si-1', png)).rejects.toThrow(SystemIssueScreenshotError);
    expect(upload).not.toHaveBeenCalled();
  });

  it('stops when the storage upload fails, and confirms nothing', async () => {
    script({ request_system_issue_screenshot_upload: reserved });
    upload.mockResolvedValue({ data: null, error: { message: 'The object exceeded the maximum allowed size' } });

    await expect(attachSystemIssueScreenshot('si-1', png)).rejects.toThrow(SystemIssueScreenshotError);
    expect(calls('confirm_upload')).toEqual([]);
  });

  it('fails when confirm_upload refuses', async () => {
    script({
      request_system_issue_screenshot_upload: reserved,
      confirm_upload: { data: null, error: { code: '22023', message: 'confirm_upload: a System issue screenshot must be a JPEG or PNG image' } },
    });
    upload.mockResolvedValue({ data: { path: 'si/si-1/abc.png' }, error: null });

    await expect(attachSystemIssueScreenshot('si-1', png)).rejects.toThrow(SystemIssueScreenshotError);
  });
});
