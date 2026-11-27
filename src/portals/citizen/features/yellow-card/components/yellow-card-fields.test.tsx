import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YellowCardFields, PrintedCardQuestion, CorrectionNoteField } from './yellow-card-fields';
import type { YellowCardFieldValues } from '@/portals/citizen/features/yellow-card/types';

const VALUES: YellowCardFieldValues = {
  voterIdNumber: 'V-123',
  firstName: 'Juan',
  middleName: '',
  lastName: 'Dela Cruz',
  suffix: '',
  dateOfBirth: '1990-01-01',
  genderCode: '',
  civilStatusCode: '',
  barangayCode: '',
  completeAddress: '',
  contactNumber: '09171234567',
  emailAddress: '',
  yearsOfResidency: '',
};

function renderFields() {
  return render(
    <YellowCardFields values={VALUES} onChange={vi.fn()} genders={[]} civilStatuses={[]} barangays={[]} />,
  );
}

// SCRUM-155: every field is reachable by its visible label, not just by sight.
describe('YellowCardFields', () => {
  it('associates each visible label with its control', () => {
    renderFields();
    expect(screen.getByLabelText(/Voter's ID Number/)).toHaveValue('V-123');
    expect(screen.getByLabelText(/First Name/)).toHaveValue('Juan');
    expect(screen.getByLabelText(/Last Name/)).toHaveValue('Dela Cruz');
    expect(screen.getByLabelText(/Civil Status/).tagName).toBe('SELECT');
    expect(screen.getByLabelText(/Contact Number/)).toHaveValue('917 123 4567');
  });

  // #198: Eligibility needs at least 2 years in Lucena.
  it('asks for at least 2 years of residency', () => {
    renderFields();
    const years = screen.getByLabelText(/Years of Residency in Lucena/);
    expect(years).toHaveAttribute('min', '2');
    expect(years).toHaveAttribute('max', '120');
    expect(years).toHaveAccessibleDescription('At least 2 years.');
  });

  it('keeps the ids unique when the fields render twice', () => {
    renderFields();
    renderFields();
    expect(screen.getAllByLabelText(/First Name/)).toHaveLength(2);
  });
});

// DB l120: every applicant may say they already hold a printed Yellow Card.
describe('PrintedCardQuestion', () => {
  it('asks the question, with no number field until it is answered yes', () => {
    render(<PrintedCardQuestion values={{ holdsPrintedCard: false, printedCardNumber: '' }} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'I already hold a printed Yellow Card' })).not.toBeChecked();
    expect(screen.queryByLabelText(/Printed card number/)).not.toBeInTheDocument();
  });

  it('reports the answer when ticked', async () => {
    const onChange = vi.fn();
    render(<PrintedCardQuestion values={{ holdsPrintedCard: false, printedCardNumber: '' }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'I already hold a printed Yellow Card' }));
    expect(onChange).toHaveBeenCalledWith('holdsPrintedCard', true);
  });

  it('offers an optional printed card number, capped at the database limit', async () => {
    const onChange = vi.fn();
    render(<PrintedCardQuestion values={{ holdsPrintedCard: true, printedCardNumber: '04' }} onChange={onChange} />);

    const number = screen.getByLabelText(/Printed card number \(optional\)/);
    expect(number).toHaveValue('04');
    expect(number).toHaveAttribute('maxLength', '64');
    expect(number).not.toBeRequired();

    await userEvent.type(number, '5');
    expect(onChange).toHaveBeenCalledWith('printedCardNumber', '045');
  });
});

// ADR 0011: a Correction says what needs correcting.
describe('CorrectionNoteField', () => {
  it('is a required note, capped at the database limit', async () => {
    const onChange = vi.fn();
    render(<CorrectionNoteField value="" onChange={onChange} />);

    const note = screen.getByRole('textbox', { name: /What needs correcting\?/ });
    expect(note).toBeRequired();
    expect(note).toHaveAttribute('maxLength', '500');

    await userEvent.type(note, 'N');
    expect(onChange).toHaveBeenCalledWith('N');
  });
});
