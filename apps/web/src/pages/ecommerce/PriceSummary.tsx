import { Box, Divider, Text } from '@inithium/ui';
import { formatMoney } from '@inithium/api-client';

export interface PriceSummaryRow {
  readonly label: string;
  // null renders `pendingLabel` instead of an amount (e.g. tax before an address is entered).
  readonly amountCents: number | null;
  readonly pendingLabel?: string;
  // Shown as a deduction ("-$5.00").
  readonly isDeduction?: boolean;
}

interface PriceSummaryProps {
  readonly currency: string;
  readonly rows: PriceSummaryRow[];
  readonly totalLabel: string;
  readonly totalCents: number;
}

const formatRowAmount = (row: PriceSummaryRow, currency: string): string => {
  if (row.amountCents === null) return row.pendingLabel ?? '—';
  return row.isDeduction ? `-${formatMoney(row.amountCents, currency)}` : formatMoney(row.amountCents, currency);
};

export const PriceSummary = ({ currency, rows, totalLabel, totalCents }: PriceSummaryProps) => (
  <Box flex={{ direction: 'col', gap: 8 }}>
    {rows.map((row) => (
      <Box key={row.label} flex={{ direction: 'row', justify: 'between', gap: 16 }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {row.label}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: row.amountCents === null ? 600 : 950 }} className="text-sm tabular-nums">
          {formatRowAmount(row, currency)}
        </Text>
      </Box>
    ))}
    <Divider color={{ color: 'surface', intensity: 300 }} />
    <Box flex={{ direction: 'row', justify: 'between', gap: 16 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        {totalLabel}
      </Text>
      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold tabular-nums">
        {formatMoney(totalCents, currency)}
      </Text>
    </Box>
  </Box>
);
