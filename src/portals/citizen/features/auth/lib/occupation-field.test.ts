import { describe, it, expect } from 'vitest';
import { occupationField } from '@/portals/citizen/features/auth/lib/occupation-field';

describe('occupationField', () => {
  it('blanks and disables the box, and submits no occupation, when not working in Lucena', () => {
    expect(occupationField(false, 'Teacher')).toEqual({
      value: '',
      disabled: true,
      submit: { occupation: '', worksInLucena: false },
    });
  });

  it('shows and submits the occupation when working in Lucena', () => {
    expect(occupationField(true, 'Teacher')).toEqual({
      value: 'Teacher',
      disabled: false,
      submit: { occupation: 'Teacher', worksInLucena: true },
    });
  });
});
