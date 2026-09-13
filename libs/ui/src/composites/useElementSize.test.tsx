import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElementSize } from './useElementSize';

const Probe = () => {
  const { ref, size } = useElementSize();
  return <div ref={ref} data-testid="probe">{size ? `${size.width}x${size.height}` : 'unmeasured'}</div>;
};

describe('useElementSize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('measures the element synchronously once the ref attaches', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(250);

    const { getByTestId } = render(<Probe />);

    expect(getByTestId('probe').textContent).toBe('300x250');
  });

  it('disconnects the ResizeObserver when the element unmounts', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect = disconnect;
        unobserve = vi.fn();
      },
    );

    const { unmount } = render(<Probe />);
    expect(observe).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
