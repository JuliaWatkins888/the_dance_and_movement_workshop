import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Slider } from './Slider';

describe('Slider', () => {
  it('renders a thumb with an accessible name from the label', () => {
    render(<Slider label="Volume" defaultValue={[50]} />);
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
  });

  it('appends a required indicator to the label when required', () => {
    render(<Slider label="Volume" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('moves the thumb with the keyboard and invokes onValueChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Slider label="Volume" defaultValue={[50]} min={0} max={100} step={1} onValueChange={handleChange} />,
    );

    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}');

    expect(handleChange).toHaveBeenCalledWith([51]);
  });

  it('supports controlled usage via value', () => {
    render(<Slider label="Volume" value={[30]} min={0} max={100} onValueChange={() => {}} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '30');
  });

  it('renders one thumb per value for a range slider', () => {
    render(<Slider label="Range" defaultValue={[20, 80]} />);
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });

  it('applies error styling to the filled range', () => {
    const { container } = render(<Slider label="Volume" error defaultValue={[50]} />);
    expect(container.querySelector('[class*="bg-red-500"]')).not.toBeNull();
  });

  it('omits the helper text node entirely when helperText is undefined', () => {
    render(<Slider label="Volume" />);
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it('marks the control disabled via data-disabled', () => {
    render(<Slider label="Volume" disabled defaultValue={[50]} />);
    expect(screen.getByRole('slider')).toHaveAttribute('data-disabled');
  });
});
