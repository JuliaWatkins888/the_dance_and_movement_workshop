import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventCalendar } from './EventCalendar';
import type { EventCalendarItem } from './EventCalendar';

const pad = (value: number): string => String(value).padStart(2, '0');
const now = new Date();
const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

describe('EventCalendar', () => {
  it('reports the visible range on mount so the caller can fetch its items', async () => {
    const onRangeChange = vi.fn();
    render(<EventCalendar items={[]} onRangeChange={onRangeChange} />);
    await flush();

    expect(onRangeChange).toHaveBeenCalled();
    const { start, end } = onRangeChange.mock.calls[0][0];
    expect(start).toBeInstanceOf(Date);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('renders both timed and all-day items in the month view', async () => {
    const items: EventCalendarItem[] = [
      { id: 'class', title: 'Dance Buddies', start: `${thisMonth}-07T10:00`, end: `${thisMonth}-07T10:30`, allDay: false, color: 'primary' },
      { id: 'holiday', title: 'Holiday', start: `${thisMonth}-12`, end: `${thisMonth}-13`, allDay: true, color: 'tertiary' },
    ];
    const { container } = render(<EventCalendar items={items} />);
    await flush();

    const titles = [...container.querySelectorAll('.ui-calendar-event-title')].map((el) => el.textContent);
    expect(titles).toEqual(expect.arrayContaining(['Dance Buddies', 'Holiday']));
  });
});
