import type { ComponentType } from 'react';

export interface DashboardWidget {
  readonly id: string;
  readonly title?: string;
  readonly order?: number;
  // Grid columns this widget spans on the dashboard's md+ 3-column grid (1 by default) - lets a
  // widget pick its own footprint (a small stat tile vs. a wide graph) without the dashboard
  // itself needing to know anything about what any given widget renders.
  readonly span?: 1 | 2 | 3;
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
