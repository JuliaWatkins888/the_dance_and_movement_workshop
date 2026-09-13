import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders its children', () => {
    render(<Dialog>Hello from a dialog</Dialog>);
    expect(screen.getByText('Hello from a dialog')).toBeInTheDocument();
  });

  it('renders a close button by default and calls onClose when clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<Dialog onClose={handleClose}>Content</Dialog>);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('omits the close button when closeable is false', () => {
    render(<Dialog closeable={false}>Content</Dialog>);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('applies a default width and lets numeric width/height override it as pixel values', () => {
    const { container, rerender } = render(<Dialog>Content</Dialog>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.width).toBe('28rem');

    rerender(
      <Dialog width={640} height={480}>
        Content
      </Dialog>,
    );
    expect(card.style.width).toBe('640px');
    expect(card.style.height).toBe('480px');
  });

  it('accepts a string width/height as a raw CSS value', () => {
    const { container } = render(
      <Dialog width="90vw" height="80vh">
        Content
      </Dialog>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.width).toBe('90vw');
    expect(card.style.height).toBe('80vh');
  });
});
