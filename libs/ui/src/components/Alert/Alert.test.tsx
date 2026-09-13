import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from './Alert';

describe('Alert', () => {
  it('renders the message inside a status live region', () => {
    render(<Alert message="Saved successfully" duration={0} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Saved successfully');
  });

  it('applies severity classes matching the design spec', () => {
    render(<Alert message="Uh oh" severity="danger" duration={0} />);
    const status = screen.getByRole('status');
    expect(status.className).toContain('bg-red-100');
    expect(status.className).toContain('border-red-500');
    expect(status.className).toContain('text-red-500');
  });

  it('renders a close button by default and calls onClose when clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<Alert message="Dismiss me" duration={0} onClose={handleClose} />);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('omits the close button when closeable is false', () => {
    render(<Alert message="No close" duration={0} closeable={false} />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  describe('duration auto-dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls onClose after the given duration elapses', () => {
      const handleClose = vi.fn();
      render(<Alert message="Auto dismiss" duration={5000} onClose={handleClose} />);

      expect(handleClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('never calls onClose when duration is 0', () => {
      const handleClose = vi.fn();
      render(<Alert message="Persistent" duration={0} onClose={handleClose} />);

      vi.advanceTimersByTime(60_000);
      expect(handleClose).not.toHaveBeenCalled();
    });
  });
});
