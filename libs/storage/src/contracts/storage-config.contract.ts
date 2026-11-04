// Safe to log: never carries the access key or secret.
export type StorageConfigSummary =
  | {
      readonly configured: true;
      readonly bucket: string;
      readonly endpointHost: string;
      readonly publicBaseUrl: string;
      readonly warnings: readonly string[];
    }
  | { readonly configured: false; readonly issues: readonly string[] };
