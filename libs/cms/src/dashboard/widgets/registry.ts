import type { ComponentType } from 'react';

export interface DashboardWidget {
  readonly id: string;
  readonly title?: string;
  readonly order?: number;
  // Same gating contract as CmsModule.requiredCapability - omit for a widget every CMS-capable
  // viewer should see.
  readonly requiredCapability?: string;
  readonly Component: ComponentType;
}

// Every plugin that wants a dashboard widget (a future ecommerce plugin's purchases-over-time
// graph, etc.) drops its own uniquely-named *.widget.tsx file here, default-exporting a
// DashboardWidget descriptor - the exact same zero-shared-file-edit convention
// modules/registry.ts already established for CMS nav modules, just scoped to the dashboard
// page's own slot system.
const widgetFiles = import.meta.glob<DashboardWidget>('./*.widget.tsx', { eager: true, import: 'default' });

export const dashboardWidgets: DashboardWidget[] = Object.values(widgetFiles).sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
);
