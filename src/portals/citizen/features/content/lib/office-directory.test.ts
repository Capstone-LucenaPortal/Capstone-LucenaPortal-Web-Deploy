import { describe, it, expect } from 'vitest';
import { OFFICE_DIRECTORY, searchOffices } from './office-directory';

const names = (query: string) => searchOffices(query).map((office) => office.name);

describe('OFFICE_DIRECTORY', () => {
  it('holds all 51 offices supplied for the directory', () => {
    expect(OFFICE_DIRECTORY).toHaveLength(51);
  });

  it('has no two offices with the same name, since the list keys on it', () => {
    expect(new Set(OFFICE_DIRECTORY.map((office) => office.name)).size).toBe(51);
  });

  it('keeps the first and last entries as supplied', () => {
    expect(OFFICE_DIRECTORY[0]).toEqual({
      name: 'Bureau of Agricultural Statistics',
      address: 'Landing Road, Lucena City, Quezon 4301',
      phone: '(042) 710-7626',
      hours: 'Monday–Friday, 8:00 AM–5:00 PM',
    });
    expect(OFFICE_DIRECTORY[50]).toEqual({
      name: 'Schools Division Office – Lucena City',
      address: 'M.L. Tagarao Street, Lucena City, Quezon 4301',
      phone: '(042) 660-3276',
      hours: 'Monday–Friday, 8:00 AM–5:00 PM',
    });
  });
});

describe('searchOffices', () => {
  it('returns every office for a blank search', () => {
    expect(searchOffices('   ')).toHaveLength(51);
  });

  it('matches words in any order, ignoring case', () => {
    expect(names('MAYOR office')).toEqual(['Office of the City Mayor']);
  });

  it('matches on the address', () => {
    expect(names('Landing Road')).toEqual(['Bureau of Agricultural Statistics']);
  });

  it('matches on the telephone number', () => {
    expect(names('373-4772')).toEqual(['Lucena City Veterinary Office']);
  });

  it('treats a typed hyphen like the dash in an office name', () => {
    expect(names('Commission on Elections - Lucena')).toEqual(['Commission on Elections – Lucena City']);
  });

  it('finds nothing when one of the words matches no office', () => {
    expect(names('mayor zzz')).toEqual([]);
  });
});
