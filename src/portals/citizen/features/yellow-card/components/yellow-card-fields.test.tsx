import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { YellowCardFields } from './yellow-card-fields';
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

  it('keeps the ids unique when the fields render twice', () => {
    renderFields();
    renderFields();
    expect(screen.getAllByLabelText(/First Name/)).toHaveLength(2);
  });
});
