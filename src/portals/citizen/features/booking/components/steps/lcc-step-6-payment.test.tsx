import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LCCStep6Payment from '@/portals/citizen/features/booking/components/steps/lcc-step-6-payment';

afterEach(() => {
  vi.restoreAllMocks();
});

const receipt = () => new File(['%PDF-1.4'], 'gcash-receipt.pdf', { type: 'application/pdf' });
// A PNG renamed .jpg (the report's FILE-PNG-AS-JPG): validateUploadFile refuses it on the magic bytes.
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const spoofed = () => new File([PNG_MAGIC], 'renamed.jpg', { type: 'image/jpeg' });

function renderPayment() {
  render(<LCCStep6Payment bookingId="bk-1" totalFee={60000} downpaymentAmount={30000} onSuccess={vi.fn()} />);
}

describe('LCCStep6Payment, choosing the receipt', () => {
  it('drops the earlier receipt when a later file is refused, so Submit is disabled (#21)', async () => {
    const user = userEvent.setup();
    renderPayment();
    const submit = screen.getByRole('button', { name: /submit downpayment proof/i });

    await user.type(screen.getByLabelText('Reference Number'), '1234567890');
    await user.upload(screen.getByLabelText('Upload Proof of Payment'), receipt());
    expect(await screen.findByText('Selected: gcash-receipt.pdf')).toBeInTheDocument();
    expect(submit).toBeEnabled();

    await user.upload(screen.getByLabelText('Upload Proof of Payment'), spoofed());

    expect(await screen.findByText(/does not match its file type/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Selected:/)).toBeNull();
    expect(submit).toBeDisabled();
  });

  it('takes a valid file picked after a refused one', async () => {
    const user = userEvent.setup();
    renderPayment();

    await user.type(screen.getByLabelText('Reference Number'), '1234567890');
    await user.upload(screen.getByLabelText('Upload Proof of Payment'), spoofed());
    expect(await screen.findByText(/does not match its file type/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText('Upload Proof of Payment'), receipt());

    expect(await screen.findByText('Selected: gcash-receipt.pdf')).toBeInTheDocument();
    expect(screen.queryByText(/does not match its file type/i)).toBeNull();
    expect(screen.getByRole('button', { name: /submit downpayment proof/i })).toBeEnabled();
  });
});
