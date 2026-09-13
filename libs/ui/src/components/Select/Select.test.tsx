import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select, SelectItem } from './Select';

const renderSelect = (props: Partial<ComponentProps<typeof Select>> = {}) =>
  render(
    <Select label="Country" placeholder="Choose a country" {...props}>
      <SelectItem value="us">United States</SelectItem>
      <SelectItem value="ca">Canada</SelectItem>
    </Select>,
  );

describe('Select', () => {
  it('renders a trigger labelled via htmlFor/id', () => {
    renderSelect();
    expect(screen.getByLabelText('Country')).toHaveAttribute('role', 'combobox');
  });

  it('appends a required indicator to the label when required', () => {
    renderSelect({ required: true });
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows the placeholder until a value is chosen', () => {
    renderSelect();
    expect(screen.getByText('Choose a country')).toBeInTheDocument();
  });

  it('opens the listbox and selects an item, invoking onValueChange', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const handleChange = vi.fn();
    renderSelect({ onValueChange: handleChange });

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Canada' }));

    expect(handleChange).toHaveBeenCalledWith('ca');
  });

  it('supports uncontrolled usage via defaultValue', () => {
    renderSelect({ defaultValue: 'us' });
    expect(screen.getByRole('combobox')).toHaveTextContent('United States');
  });

  it('applies error styling and aria-invalid', () => {
    renderSelect({ error: true, helperText: 'Required' });
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger.className).toContain('border-red-500');
  });

  it('omits the helper text node entirely when helperText is undefined', () => {
    renderSelect();
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it('disables the trigger when disabled', () => {
    renderSelect({ disabled: true });
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
