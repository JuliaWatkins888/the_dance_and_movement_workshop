import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader, Text } from '@inithium/ui';
import { useGetUserRegistrationsOverTimeQuery } from '@inithium/api-client';
import type { DashboardWidget } from './registry';

interface ChartPoint {
  date: string;
  total: number;
}

const UsersOverTimeWidget = () => {
  const { data, isLoading } = useGetUserRegistrationsOverTimeQuery();

  if (isLoading) {
    return <Loader variant="spinner" size="2rem" />;
  }

  if (!data || data.length === 0) {
    return (
      <Text as="p" className="text-surface-500">
        No registration data yet.
      </Text>
    );
  }

  // The API returns new-registrations-per-day; the more common "users over time" reading of
  // this data is cumulative growth, so the running total is computed here rather than server
  // side, keeping the endpoint itself a simple, general-purpose daily-count aggregation.
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
        <Line type="monotone" dataKey="total" name="Total users" stroke="var(--color-primary-500)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const usersOverTimeWidget: DashboardWidget = {
  id: 'users-over-time',
  title: 'Users Registered Over Time',
  order: 0,
  span: 2,
  Component: UsersOverTimeWidget,
};

export default usersOverTimeWidget;
