import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgramImage from './program-image';

describe('ProgramImage', () => {
  it('shows the photo once one has been supplied', () => {
    render(<ProgramImage image={{ src: '/programs/wedding/one.jpg', alt: 'Couples at the ceremony' }} />);
    expect(screen.getByRole('img', { name: 'Couples at the ceremony' })).toHaveAttribute(
      'src',
      '/programs/wedding/one.jpg',
    );
  });

  it('holds the space with a labelled placeholder until then', () => {
    const { container } = render(<ProgramImage image={{ src: null, alt: 'Wedding image placeholder' }} />);
    expect(screen.getByRole('img', { name: 'Wedding image placeholder' })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});
