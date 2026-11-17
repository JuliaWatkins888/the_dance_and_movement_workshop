import { getStoredAccessToken } from '../tokenStorage';

// Mirrors baseApi.ts's own VITE_API_URL fallback.
const API_BASE_URL = (import.meta as { env?: Record<string, string> }).env?.['VITE_API_URL'] ?? 'http://localhost:3000';

export interface DownloadLedgerPaymentsCsvParams {
  // Calendar dates "YYYY-MM-DD", both inclusive.
  from: string;
  to: string;
  method?: string;
}

export const downloadLedgerPaymentsCsv = async ({ from, to, method }: DownloadLedgerPaymentsCsvParams): Promise<void> => {
  const query = new URLSearchParams({ from, to });
  if (method) query.set('method', method);
  const token = getStoredAccessToken();

  const response = await fetch(`${API_BASE_URL}/api/ledger/payments/export.csv?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Export failed');

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `ledger-payments-${from}-to-${to}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
