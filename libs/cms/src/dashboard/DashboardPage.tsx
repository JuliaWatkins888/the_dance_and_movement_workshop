import { Box, Text, mergeClassNames } from '@inithium/ui';
import { useAppName } from '@inithium/api-client';
import { dashboardWidgets } from './widgets/registry';
import type { DashboardWidget } from './widgets/registry';
import { canAccessCmsResource, useCmsCurrentUser } from '../CmsCurrentUserContext';

const SPAN_CLASSES: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
};

const getSpanClassName = (span?: DashboardWidget['span']): string =>
  SPAN_CLASSES[span ?? 1] ?? SPAN_CLASSES[1];

const renderWidget = (widget: DashboardWidget) => (
  <Box
    key={widget.id}
    bgColor={{ color: 'surface', intensity: 100 }}
    borderColor={{ color: 'surface', intensity: 200 }}
    padding={{ base: 16 }}
    className={mergeClassNames('rounded border', getSpanClassName(widget.span))}
  >
    {widget.title ? (
      <Text textColor={{ color: 'surface', intensity: 950 }} as="h2" className="mb-2 text-lg font-semibold">
        {widget.title}
      </Text>
    ) : null}
    <widget.Component />
  </Box>
);

const EmptyState = ({ appName }: { appName: string }) => (
  <Text as="p" className="text-surface-600">
    Welcome to the {appName} CMS. Widgets installed by plugins will appear here.
  </Text>
);

const WidgetGrid = ({ widgets }: { widgets: DashboardWidget[] }) => (
  <Box className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {widgets.map(renderWidget)}
  </Box>
);

export const DashboardPage = () => {
  const appName = useAppName();
  const currentUser = useCmsCurrentUser();
  
  const isWidgetAccessible = (widget: DashboardWidget) =>
    canAccessCmsResource(currentUser, widget.requiredCapability);

  const visibleWidgets = dashboardWidgets.filter(isWidgetAccessible);

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-2xl font-bold">
        Dashboard
      </Text>

      {visibleWidgets.length === 0 ? (
        <EmptyState appName={appName} />
      ) : (
        <WidgetGrid widgets={visibleWidgets} />
      )}
    </Box>
  );
};