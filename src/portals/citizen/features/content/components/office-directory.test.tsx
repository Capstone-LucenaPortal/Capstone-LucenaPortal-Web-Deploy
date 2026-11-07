import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OfficeDirectory from './office-directory';

const search = (value: string) =>
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search the directory' }), { target: { value } });

describe('OfficeDirectory', () => {
  it('lists every office with its details before any search', () => {
    render(<OfficeDirectory />);
    expect(screen.getAllByRole('listitem')).toHaveLength(51);
    expect(screen.getByRole('status')).toHaveTextContent('51 offices');
    expect(screen.getByRole('heading', { level: 3, name: 'Guard House' })).toBeInTheDocument();
    expect(screen.getByText('Government Complex Compound, Lucena City, Quezon 4301')).toBeInTheDocument();
  });

  it('narrows the list as the resident types', () => {
    render(<OfficeDirectory />);
    search('veterinary');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('1 office');
    expect(screen.getByRole('heading', { level: 3, name: 'Lucena City Veterinary Office' })).toBeInTheDocument();
    expect(screen.getByText('Ground Floor, City Hall Annex, Isabang, Lucena City, Quezon 4301')).toBeInTheDocument();
  });

  it('makes a landline callable with its area code', () => {
    render(<OfficeDirectory />);
    search('veterinary');
    expect(screen.getByRole('link', { name: '(042) 373-4772' })).toHaveAttribute('href', 'tel:+63423734772');
  });

  it('makes a mobile number callable', () => {
    render(<OfficeDirectory />);
    search('Cooperative Insular');
    expect(screen.getByRole('link', { name: '0919-817-2980' })).toHaveAttribute('href', 'tel:+639198172980');
  });

  it('says so when nothing matches', () => {
    render(<OfficeDirectory />);
    search('zzz');
    expect(screen.queryAllByRole('listitem')).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('No offices match "zzz".');
  });
});
