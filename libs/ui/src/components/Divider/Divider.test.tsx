import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Divider } from './Divider';

describe('Divider', () => {
  it('renders an <hr> with the implicit separator role', () => {
    const { getByRole } = render(<Divider />);
    expect(getByRole('separator').tagName).toBe('HR');
  });

  it('applies a default thickness of 1px and width of 100%', () => {
    const { getByRole } = render(<Divider />);
    const hr = getByRole('separator') as HTMLElement;
    expect(hr.style.borderTopWidth).toBe('1px');
    expect(hr.style.width).toBe('100%');
  });

  it('applies a custom numeric thickness and width as pixel values', () => {
    const { getByRole } = render(<Divider thickness={4} width={240} />);
    const hr = getByRole('separator') as HTMLElement;
    expect(hr.style.borderTopWidth).toBe('4px');
    expect(hr.style.width).toBe('240px');
  });

  it('accepts a string width as a raw CSS value', () => {
    const { getByRole } = render(<Divider width="50%" />);
    expect((getByRole('separator') as HTMLElement).style.width).toBe('50%');
  });

  it('applies a tailwind/theme border color from a ColorSpec', () => {
    const { getByRole } = render(<Divider color={{ color: 'primary', intensity: 500 }} />);
    expect(getByRole('separator')).toHaveClass('border-primary-500');
  });
});
