import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders its children', () => {
    render(<Drawer>Hello from a drawer</Drawer>);
    expect(screen.getByText('Hello from a drawer')).toBeInTheDocument();
  });

  it('renders a close button by default and calls onClose when clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<Drawer onClose={handleClose}>Content</Drawer>);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('omits the close button when closeable is false', () => {
    render(<Drawer closeable={false}>Content</Drawer>);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('applies a default width and lets numeric width override it as a pixel value', () => {
    const { container, rerender } = render(<Drawer>Content</Drawer>);
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.style.width).toBe('28rem');

    rerender(<Drawer width={400}>Content</Drawer>);
    expect(panel.style.width).toBe('400px');
  });

  it('accepts a string width as a raw CSS value', () => {
    const { container } = render(<Drawer width="90vw">Content</Drawer>);
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.style.width).toBe('90vw');
  });

  it('defaults to the right side and switches its border edge for the left side', () => {
    const { container, rerender } = render(<Drawer>Content</Drawer>);
    expect(container.firstElementChild).toHaveClass('border-l');

    rerender(<Drawer side="left">Content</Drawer>);
    expect(container.firstElementChild).toHaveClass('border-r');
  });
});
