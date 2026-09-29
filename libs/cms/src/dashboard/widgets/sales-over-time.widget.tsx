import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Box, Button, Loader, Text } from '@inithium/ui';
import { currencyFractionDigits, formatMoney, useGetSalesReportQuery } from '@inithium/api-client';
import type { SalesPeriodDto, SalesReportDto } from '@inithium/api-client';
import type { DashboardWidget } from './registry';

const PERIODS: { value: SalesPeriodDto; label: string; previousLabel: string }[] = [
  { value: 'week', label: 'Week', previousLabel: 'previous 7 days' },
  { value: 'month', label: 'Month', previousLabel: 'previous 30 days' },
  { value: 'year', label: 'Year', previousLabel: 'previous 12 months' },
];

const VIEWER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Bucket labels arrive as 'YYYY-MM-DD' / 'YYYY-MM' calendar strings in the viewer's zone - they're
// formatted as calendar values (UTC), never re-interpreted as instants.
const formatBucket = (label: string, period: SalesPeriodDto): string => {
  const [year, month, day] = label.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
  return period === 'year'
    ? date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const changeText = (current: number, previous: number): string => {
  if (previous === 0) return current === 0 ? 'no change' : 'up from nothing';
  const percent = Math.round(((current - previous) / previous) * 100);
  return percent === 0 ? 'no change' : `${percent > 0 ? '+' : ''}${percent}%`;
};

const StatTile = ({ label, value, detail }: { readonly label: string; readonly value: string; readonly detail?: string }) => (
  <Box bgColor={{ color: 'surface', intensity: 200 }} padding={{ base: 12 }} flex={{ direction: 'col', gap: 2 }} className="rounded-md">
    <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs uppercase tracking-wide">
      {label}
    </Text>
    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-xl font-bold tabular-nums">
      {value}
    </Text>
    {detail ? (
      <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        {detail}
      </Text>
    ) : null}
  </Box>
);

const SalesChart = ({ report }: { readonly report: SalesReportDto }) => {
  const divisor = 10 ** currencyFractionDigits(report.currency);
  const data = report.buckets.map((bucket) => ({
    label: formatBucket(bucket.label, report.period),
    revenue: bucket.revenueCents / divisor,
    orders: bucket.orderCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-300)" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-surface-700)' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12, fill: 'var(--color-surface-700)' }} width={56} />
        <Tooltip
          formatter={(value: number, name: string) => (name === 'revenue' ? [formatMoney(Math.round(value * divisor), report.currency), 'Revenue'] : [value, 'Orders'])}
          contentStyle={{ background: 'var(--color-surface-100)', borderColor: 'var(--color-surface-300)', color: 'var(--color-surface-950)' }}
        />
        <Bar dataKey="revenue" name="revenue" fill="var(--color-primary-500)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Revenue from orders paid and not later cancelled or refunded - online checkouts, subscription
// renewals, and staff-recorded orders alike.
const SalesOverTimeWidget = () => {
  const [period, setPeriod] = useState<SalesPeriodDto>('month');
  const { data: report, isLoading, isFetching } = useGetSalesReportQuery({ period, timezone: VIEWER_TIMEZONE });
  const periodInfo = PERIODS.find((candidate) => candidate.value === period)!;

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <div role="group" aria-label="Time period" className="flex gap-1">
        {PERIODS.map((candidate) => (
          <Button
            key={candidate.value}
            aria-pressed={candidate.value === period}
            variant={candidate.value === period ? { kind: 'filled', color: 'primary' } : { kind: 'ghost', color: 'surface' }}
            textColor={candidate.value === period ? { color: 'primary-foreground', intensity: 500 } : { color: 'surface', intensity: 800 }}
            onClick={() => setPeriod(candidate.value)}
          >
            {candidate.label}
          </Button>
        ))}
      </div>

      {isLoading || !report ? (
        <Loader variant="spinner" size="2rem" />
      ) : (
        <Box flex={{ direction: 'col', gap: 12 }} className={isFetching ? 'opacity-60' : undefined}>
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Revenue"
              value={formatMoney(report.totals.revenueCents, report.currency)}
              detail={`${changeText(report.totals.revenueCents, report.totals.previousRevenueCents)} vs ${periodInfo.previousLabel}`}
            />
            <StatTile
              label="Orders"
              value={String(report.totals.orderCount)}
              detail={`${changeText(report.totals.orderCount, report.totals.previousOrderCount)} vs ${periodInfo.previousLabel}`}
            />
            <StatTile label="To fulfill" value={String(report.awaitingFulfillmentCount)} detail="Paid orders waiting to ship" />
          </Box>
          {report.totals.orderCount === 0 ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
              No sales in this period yet.
            </Text>
          ) : (
            <SalesChart report={report} />
          )}
        </Box>
      )}
    </Box>
  );
};

const salesOverTimeWidget: DashboardWidget = {
  id: 'sales-over-time',
  title: 'Sales',
  order: 5,
  span: 3,
  requiredCapability: 'ecommerce:manage-orders',
  Component: SalesOverTimeWidget,
};

export default salesOverTimeWidget;
