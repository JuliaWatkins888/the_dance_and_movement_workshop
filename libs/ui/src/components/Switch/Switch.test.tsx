import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('renders labelled via htmlFor/id with role switch', () => {
    render(<Switch label="Notifications" />);
    expect(screen.getByLabelText('Notifications')).toHaveAttribute('role', 'switch');
  });

  it('appends a required indicator to the label when required', () => {
    render(<Switch label="Notifications" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('toggles and invokes onCheckedChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Switch label="Notifications" onCheckedChange={handleChange} />);

    await user.click(screen.getByRole('switch'));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('supports uncontrolled usage via defaultChecked', () => {
    render(<Switch label="Notifications" defaultChecked />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('applies error styling and aria-invalid', () => {
    render(<Switch label="Notifications" error helperText="Required" />);
    const control = screen.getByRole('switch');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control.className).toContain('data-[state=checked]:bg-red-500');
  });

  it('omits the helper text node entirely when helperText is undefined', () => {
    render(<Switch label="Notifications" />);
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it('disables interaction when disabled', () => {
    render(<Switch label="Notifications" disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('forwards the ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Switch label="Notifications" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
