import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders labelled via htmlFor/id with role checkbox', () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByLabelText('Accept terms')).toHaveAttribute('role', 'checkbox');
  });

  it('appends a required indicator to the label when required', () => {
    render(<Checkbox label="Accept terms" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('toggles and invokes onCheckedChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Checkbox label="Accept terms" onCheckedChange={handleChange} />);

    await user.click(screen.getByRole('checkbox'));
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('supports uncontrolled usage via defaultChecked', () => {
    render(<Checkbox label="Accept terms" defaultChecked />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('supports an indeterminate state', () => {
    render(<Checkbox label="Select all" checked="indeterminate" onCheckedChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('applies error styling and aria-invalid', () => {
    render(<Checkbox label="Accept terms" error helperText="Required" />);
    const control = screen.getByRole('checkbox');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control.className).toContain('border-red-500');
  });

  it('omits the helper text node entirely when helperText is undefined', () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it('disables interaction when disabled', () => {
    render(<Checkbox label="Accept terms" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('forwards the ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Checkbox label="Accept terms" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
