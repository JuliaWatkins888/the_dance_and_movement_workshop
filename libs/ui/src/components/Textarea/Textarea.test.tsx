import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders a label wired to the textarea via htmlFor/id', () => {
    render(<Textarea label="Bio" />);
    expect(screen.getByLabelText('Bio')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('appends a required indicator to the label when required', () => {
    render(<Textarea label="Bio" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders helperText and links it via aria-describedby', () => {
    render(<Textarea label="Bio" helperText="Max 500 characters" />);
    const textarea = screen.getByLabelText('Bio');
    const helper = screen.getByText('Max 500 characters');
    expect(textarea).toHaveAttribute('aria-describedby', helper.id);
  });

  it('omits the helper text node entirely when helperText is undefined', () => {
    render(<Textarea label="Bio" />);
    expect(screen.queryByText(/max 500/i)).not.toBeInTheDocument();
  });

  it('applies error styling and aria-invalid when error is true', () => {
    render(<Textarea label="Bio" error helperText="Too long" />);
    const textarea = screen.getByLabelText('Bio');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea.className).toContain('border-red-500');
    expect(screen.getByText('Too long').className).toContain('text-red-500');
  });

  it('disables user interaction, applies disabled styling, and blocks resize', () => {
    render(<Textarea label="Bio" disabled />);
    const textarea = screen.getByLabelText('Bio');
    expect(textarea).toBeDisabled();
    expect(textarea.className).toContain('disabled:opacity-50');
    expect(textarea.className).toContain('disabled:cursor-not-allowed');
    expect(textarea.className).toContain('disabled:resize-none');
  });

  it('supports controlled usage via value/onChange', async () => {
    const user = userEvent.setup();
    let value = '';
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      value = event.target.value;
    };

    const { rerender } = render(<Textarea label="Bio" value={value} onChange={handleChange} />);
    await user.type(screen.getByLabelText('Bio'), 'a');
    rerender(<Textarea label="Bio" value={value} onChange={handleChange} />);

    expect(value).toBe('a');
  });

  it('supports uncontrolled usage via defaultValue', () => {
    render(<Textarea label="Bio" defaultValue="Hello" />);
    expect(screen.getByLabelText('Bio')).toHaveValue('Hello');
  });

  it('forwards the ref to the underlying textarea element', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea label="Bio" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});
