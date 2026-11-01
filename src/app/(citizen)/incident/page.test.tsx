import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import IncidentPage from '@/app/(citizen)/incident/page';

const submitIncident = vi.fn();
const uploadIncidentPhoto = vi.fn();

// The subject is the photo box, so everything the page loads on mount is a
// stub that answers empty; the incidents lib is the boundary a submit crosses.
vi.mock('@/portals/citizen/features/incidents/lib/incidents', () => {
  class IncidentSubmitError extends Error {}
  class IncidentPhotoError extends Error {}
  return {
    submitIncident: (...args: unknown[]) => submitIncident(...args),
    uploadIncidentPhoto: (...args: unknown[]) => uploadIncidentPhoto(...args),
    getMyIncidents: async () => [],
    IncidentSubmitError,
    IncidentPhotoError,
  };
});

vi.mock('@/portals/citizen/lib/supabase/catalogs', () => ({
  catalogService: {
    getIncidentTypeDetails: async () => [],
    getBarangays: async () => [],
    getDepartments: async () => [],
    getIncidentConfig: async () => null,
    getEmergencyHotlines: async () => [],
    getSiteInfo: async () => null,
  },
}));

vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'citizen-1' } }),
}));

vi.mock('@/portals/citizen/features/auth/components/protected-route', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// No App Router is mounted under test (see the reset-password page test).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

function png(name: string) {
  return new File([new Uint8Array(PNG_BYTES)], name, { type: 'image/png' });
}

/** What a drop from the file manager carries: a file list, nothing else. */
function carrying(...files: File[]) {
  return { dataTransfer: { files, types: ['Files'] } };
}

const dropBox = () => screen.getByText(/drag & drop/i).closest('label')!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IncidentPage photo box', () => {
  it('attaches a photo dropped on the box, and the submit uploads that photo', async () => {
    submitIncident.mockResolvedValue({ referenceNumber: 'INC-1', incidentId: 'inc-1' });
    uploadIncidentPhoto.mockResolvedValue(undefined);
    render(<IncidentPage />);
    const photo = png('pothole.png');

    fireEvent.drop(dropBox(), carrying(photo));

    expect(await screen.findByText('✓ pothole.png')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /submit report/i }));
    await screen.findByText(/report submitted successfully/i);
    expect(uploadIncidentPhoto).toHaveBeenCalledWith('inc-1', photo, undefined);
  });

  // #21 holds for a drop as for a click: a refused file drops the one before it.
  it('refuses a dropped file of the wrong type with an error, and clears the earlier photo', async () => {
    render(<IncidentPage />);
    fireEvent.drop(dropBox(), carrying(png('first.png')));
    await screen.findByText('✓ first.png');

    fireEvent.drop(dropBox(), carrying(new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' })));

    expect(await screen.findByText('Please upload a JPG or PNG image.')).toBeInTheDocument();
    expect(screen.queryByText('✓ first.png')).not.toBeInTheDocument();
  });

  it('uses only the first of several dropped files', async () => {
    render(<IncidentPage />);

    fireEvent.drop(dropBox(), carrying(png('one.png'), png('two.png')));

    expect(await screen.findByText('✓ one.png')).toBeInTheDocument();
    expect(screen.queryByText('✓ two.png')).not.toBeInTheDocument();
  });

  it('does nothing with a drop that carries no files, such as dragged text', async () => {
    render(<IncidentPage />);
    const drop = createEvent.drop(dropBox(), { dataTransfer: { files: [], types: ['text/plain'] } });

    fireEvent(dropBox(), drop);

    expect(drop.defaultPrevented).toBe(false);
    expect(screen.queryByText(/^✓/)).not.toBeInTheDocument();
    expect(screen.queryByText(/please upload/i)).not.toBeInTheDocument();
  });

  // Without this the browser opens a photo dragged from the file manager in a new tab.
  it('takes over a drag and its drop so the browser does not open the file itself', async () => {
    render(<IncidentPage />);
    const dragOver = createEvent.dragOver(dropBox(), carrying(png('pothole.png')));
    const drop = createEvent.drop(dropBox(), carrying(png('pothole.png')));

    fireEvent(dropBox(), dragOver);
    fireEvent(dropBox(), drop);

    expect(dragOver.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    await screen.findByText('✓ pothole.png');
  });

  it('highlights the box while a file is over it, and clears it on leave and on drop', async () => {
    render(<IncidentPage />);
    const box = dropBox();
    const idle = box.style.borderColor;

    fireEvent.dragOver(box, carrying(png('pothole.png')));
    const over = box.style.borderColor;
    expect(over).not.toBe(idle);

    fireEvent.dragLeave(box, carrying(png('pothole.png')));
    expect(box.style.borderColor).toBe(idle);

    fireEvent.dragOver(box, carrying(png('pothole.png')));
    fireEvent.drop(box, carrying(png('pothole.png')));
    expect(box.style.borderColor).toBe(idle);
    await screen.findByText('✓ pothole.png');
  });

  it('still attaches a photo picked by clicking the box', async () => {
    render(<IncidentPage />);
    await userEvent.upload(screen.getByLabelText(/drag & drop/i), png('picked.png'));

    expect(await screen.findByText('✓ picked.png')).toBeInTheDocument();
  });
});
