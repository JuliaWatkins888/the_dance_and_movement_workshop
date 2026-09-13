import { getStoredAccessToken } from '@inithium/api-client';

// apps/web (Vite) may define VITE_API_URL in its own env files - mirrors baseApi.ts's identical
// fallback for the local dev API port when it isn't set.
const API_BASE_URL = (import.meta as { env?: Record<string, string> }).env?.['VITE_API_URL'] ?? 'http://localhost:3000';

export interface DownloadTimeExportCsvParams {
  from: string;
  to: string;
  userId?: string;
}

// A plain fetch-and-download rather than an RTK Query endpoint - a file attachment response
// doesn't fit RTK Query's cache model (see this plugin's time-export.route.ts and
// api-client/endpoints for why the export endpoint itself was never added there either).
export const downloadTimeExportCsv = async (params: DownloadTimeExportCsvParams): Promise<void> => {
  const query = new URLSearchParams({ from: params.from, to: params.to, ...(params.userId ? { userId: params.userId } : {}) });
  const token = getStoredAccessToken();

  const response = await fetch(`${API_BASE_URL}/api/time/admin/export.csv?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('Export failed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `time-export-${params.from.slice(0, 10)}-to-${params.to.slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
