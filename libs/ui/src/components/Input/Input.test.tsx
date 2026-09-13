import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('renders a label wired to the input via htmlFor/id', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it('appends a required indicator to the label when required', () => {
    render(<Input label="Email" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders helperText and links it via aria-describedby', () => {
    render(<Input label="Email" helperText="We will never share this" />);
    const input = screen.getByLabelText('Email');
    const helper = screen.getByText('We will never share this');
    expect(input).toHaveAttribute('aria-describedby', helper.id);
  });

  it('omits the helper text node entirely when helperText is undefined', () => {
    render(<Input label="Email" />);
    expect(screen.queryByText(/we will never/i)).not.toBeInTheDocument();
  });

  it('applies error styling and aria-invalid when error is true', () => {
    render(<Input label="Email" error helperText="Invalid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.className).toContain('border-red-500');
    expect(screen.getByText('Invalid email').className).toContain('text-red-500');
  });

  it('disables user interaction and applies disabled styling', () => {
    render(<Input label="Email" disabled />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeDisabled();
    expect(input.className).toContain('disabled:opacity-50');
    expect(input.className).toContain('disabled:cursor-not-allowed');
  });

  it('supports controlled usage via value/onChange', async () => {
    const user = userEvent.setup();
    let value = '';
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      value = event.target.value;
    };

    const { rerender } = render(<Input label="Name" value={value} onChange={handleChange} />);
    const input = screen.getByLabelText('Name');
    await user.type(input, 'a');
    rerender(<Input label="Name" value={value} onChange={handleChange} />);

    expect(value).toBe('a');
  });

  it('supports uncontrolled usage via defaultValue', () => {
    render(<Input label="Name" defaultValue="Ada" />);
    expect(screen.getByLabelText('Name')).toHaveValue('Ada');
  });

  it('forwards the ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Name" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
