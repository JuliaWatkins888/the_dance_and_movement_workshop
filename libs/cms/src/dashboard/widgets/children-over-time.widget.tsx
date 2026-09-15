import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader, Text } from '@inithium/ui';
import { useGetChildrenCreatedOverTimeQuery } from '@inithium/api-client';
import type { DashboardWidget } from './registry';

interface ChartPoint {
  date: string;
  total: number;
}

const ChildrenOverTimeWidget = () => {
  const { data, isLoading } = useGetChildrenCreatedOverTimeQuery();

  if (isLoading) {
    return <Loader variant="spinner" size="2rem" />;
  }

  if (!data || data.length === 0) {
    return (
      <Text as="p" className="text-surface-500">
        No child account data yet.
      </Text>
    );
  }

  // The API returns new-child-accounts-per-day; running total gives the more readable "growth
  // over time" view, computed here rather than server side - same tradeoff as
  // UsersOverTimeWidget's own identical comment.
  let runningTotal = 0;
  const chartData: ChartPoint[] = data.map((point) => {
    runningTotal += point.count;
    return { date: point.date, total: runningTotal };
  });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
        <Tooltip />
        <Line type="monotone" dataKey="total" name="Total child accounts" stroke="var(--color-primary-500)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const childrenOverTimeWidget: DashboardWidget = {
  id: 'children-over-time',
  title: 'Child Accounts Over Time',
  order: 5,
  span: 2,
  requiredCapability: 'children:manage',
  Component: ChildrenOverTimeWidget,
};

export default childrenOverTimeWidget;
