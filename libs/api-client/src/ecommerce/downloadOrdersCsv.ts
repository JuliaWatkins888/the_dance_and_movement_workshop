import { getStoredAccessToken } from '../tokenStorage';

// Mirrors baseApi.ts's own VITE_API_URL fallback.
const API_BASE_URL = (import.meta as { env?: Record<string, string> }).env?.['VITE_API_URL'] ?? 'http://localhost:3000';

export interface DownloadOrdersCsvParams {
  // ISO dates; the export covers orders created in [from, to).
  from?: string;
  to?: string;
  status?: string;
}

// A plain fetch-and-download rather than an RTK Query endpoint - a file attachment doesn't fit
// RTK Query's cache model (the same reasoning as the time plugin's CSV export).
export const downloadOrdersCsv = async (params: DownloadOrdersCsvParams = {}): Promise<void> => {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.status) query.set('status', params.status);
  const token = getStoredAccessToken();

  const response = await fetch(`${API_BASE_URL}/api/orders/admin/export.csv?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Export failed');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
