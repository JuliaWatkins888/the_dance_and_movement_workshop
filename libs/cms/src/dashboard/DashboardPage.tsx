import { Box, Text } from '@inithium/ui';
import { useAppName } from '@inithium/api-client';
import { dashboardWidgets } from './widgets/registry';
import { canAccessCmsResource, useCmsCurrentUser } from '../CmsCurrentUserContext';

// The dashboard's own contribution to the widget system it hosts: renders whatever
// dashboardWidgets discovered, in registration order, on a responsive 2-column grid where every
// widget fills exactly one half-width cell and additional widgets wrap onto new rows. Has zero
// knowledge of any individual widget's content - a widget is just a title + a component that
// renders itself inside a card this page provides.
export const DashboardPage = () => {
  const appName = useAppName();
  const currentUser = useCmsCurrentUser();
  const visibleWidgets = dashboardWidgets.filter((widget) =>
    canAccessCmsResource(currentUser, widget.requiredCapability)
  );

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-2xl font-bold">
        Dashboard
      </Text>

      {visibleWidgets.length === 0 ? (
        <Text as="p" className="text-surface-600">
          Welcome to the {appName} CMS. Widgets installed by plugins will appear here.
        </Text>
      ) : (
        <Box className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleWidgets.map((widget) => (
            <Box
              key={widget.id}
              bgColor={{ color: 'surface', intensity: 100 }}
              borderColor={{ color: 'surface', intensity: 200 }}
              padding={{ base: 16 }}
              className="min-w-0 rounded border"
            >
              {widget.title ? (
                <Text textColor={{ color: 'surface', intensity: 950 }} as="h2" className="mb-2 text-lg font-semibold">
                  {widget.title}
                </Text>
              ) : null}
              <widget.Component />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
