import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoterIdUpload } from '@/portals/citizen/features/yellow-card/components/voter-id-upload';

const voterId = () => new File(['%PDF-1.4'], 'voter-id.pdf', { type: 'application/pdf' });
// A JPEG renamed .png: validateUploadFile refuses it on the magic bytes.
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const spoofed = () => new File([JPEG_MAGIC], 'renamed.png', { type: 'image/png' });

function Harness({ onFile }: { onFile: (file: File | null) => void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <VoterIdUpload
      file={file}
      onFile={(f) => { onFile(f); setFile(f); }}
      title="Upload Voter's ID"
      hint="Click to select file"
    />
  );
}

describe('VoterIdUpload', () => {
  it('drops the earlier ID when a later file is refused (#21)', async () => {
    const onFile = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<Harness onFile={onFile} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, voterId());
    expect(await screen.findByText('✓ voter-id.pdf')).toBeInTheDocument();

    await user.upload(input, spoofed());

    expect(await screen.findByText(/does not match its file type/i)).toBeInTheDocument();
    expect(onFile).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText(/✓/)).toBeNull();
  });
});
