import { createRef, type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup, RadioGroupItem } from './RadioGroup';

const renderGroup = (props: Partial<ComponentProps<typeof RadioGroup>> = {}) =>
  render(
    <RadioGroup label="Plan" {...props}>
      <RadioGroupItem value="free" label="Free" />
      <RadioGroupItem value="pro" label="Pro" />
    </RadioGroup>,
  );

describe('RadioGroup', () => {
  it('renders a group labelled via aria-labelledby', () => {
    renderGroup();
    expect(screen.getByRole('radiogroup', { name: 'Plan' })).toBeInTheDocument();
  });

  it('appends a required indicator to the label when required', () => {
    renderGroup({ required: true });
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders one radio per item, each labelled via htmlFor/id', () => {
    renderGroup();
    expect(screen.getByLabelText('Free')).toHaveAttribute('role', 'radio');
    expect(screen.getByLabelText('Pro')).toHaveAttribute('role', 'radio');
  });

  it('selects an item and invokes onValueChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    renderGroup({ onValueChange: handleChange });

    await user.click(screen.getByLabelText('Pro'));
    expect(handleChange).toHaveBeenCalledWith('pro');
  });

  it('supports uncontrolled usage via defaultValue', () => {
    renderGroup({ defaultValue: 'pro' });
    expect(screen.getByLabelText('Pro')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Free')).toHaveAttribute('aria-checked', 'false');
  });

  it('applies error styling to each item', () => {
    renderGroup({ error: true, helperText: 'Choose a plan' });
    expect(screen.getByLabelText('Free').className).toContain('border-red-500');
  });

  it('omits the helper text node entirely when helperText is undefined', () => {
    renderGroup();
    expect(screen.queryByText(/choose a plan/i)).not.toBeInTheDocument();
  });

  it('disables every item when the group is disabled', () => {
    renderGroup({ disabled: true });
    expect(screen.getByLabelText('Free')).toBeDisabled();
    expect(screen.getByLabelText('Pro')).toBeDisabled();
  });

  it('forwards the ref to the underlying group element', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <RadioGroup label="Plan" ref={ref}>
        <RadioGroupItem value="free" label="Free" />
      </RadioGroup>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
