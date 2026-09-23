import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Button, Icon } from '@inithium/ui';
import { cmsModules } from './modules/registry';
import { canAccessCmsResource, useCmsCurrentUser } from './CmsCurrentUserContext';

export interface CmsSidebarProps {
  readonly isCollapsed: boolean;
  readonly onToggleCollapsed: () => void;
}

const EXPANDED_WIDTH = 'w-60';
const COLLAPSED_WIDTH = 'w-16';

const DASHBOARD_MODULE_ID = 'dashboard';
const SETTINGS_MODULE_ID = 'settings';

const compareModulesWithSettingsLastDashboardFirst = (a: { id: string; navLabel: string }, b: { id: string; navLabel: string }): number => {
  if (a.id === SETTINGS_MODULE_ID) return 1;
  if (b.id === SETTINGS_MODULE_ID) return -1;
  if (a.id === DASHBOARD_MODULE_ID) return 1;
  if (b.id === DASHBOARD_MODULE_ID) return 1;
  return a.navLabel.localeCompare(b.navLabel);
};

const getVisibleSortedModules = (modules: typeof cmsModules, user: ReturnType<typeof useCmsCurrentUser>) =>
  modules
    .filter((cmsModule) => canAccessCmsResource(user, cmsModule.requiredCapability))
    .sort(compareModulesWithSettingsLastDashboardFirst);

export const CmsSidebar = ({ isCollapsed, onToggleCollapsed }: CmsSidebarProps) => {
  const currentUser = useCmsCurrentUser();
  const location = useLocation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const activeModuleId = location.pathname.split('/')[2];

  const expand = (moduleId: string) =>
    setExpandedIds((prev) => (prev.has(moduleId) ? prev : new Set(prev).add(moduleId)));

  useEffect(() => {
    if (activeModuleId) expand(activeModuleId);
  }, [activeModuleId]);

  const visibleModules = getVisibleSortedModules(cmsModules, currentUser);

  return (
    <Box
      as="nav"
      flex={{ direction: 'col', gap: 4 }}
      bgColor={{ color: 'surface', intensity: 200 }}
      padding={{ base: 16 }}
      className={`${isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH} shrink-0 overflow-hidden transition-all duration-200`}
    >
      <Box flex={{ direction: 'col', gap: 4 }} className="flex-1">
        {visibleModules.map((cmsModule) => {
          const visibleChildren = (cmsModule.children ?? []).filter((child) =>
            canAccessCmsResource(currentUser, child.requiredCapability ?? cmsModule.requiredCapability)
          );
          const isExpanded = expandedIds.has(cmsModule.id);

          return (
            <Box key={cmsModule.id} flex={{ direction: 'col', gap: 2 }}>
              <Button
                asChild
                variant={{ kind: 'ghost', color: 'surface' }}
                textColor={{ color: 'surface', intensity: 950 }}
                className={isCollapsed ? 'justify-center' : 'justify-start'}
                aria-label={cmsModule.navLabel}
              >
                <Link
                  to={`/cms/${cmsModule.id}`}
                  className="flex flex-row items-center gap-2"
                  onClick={() => expand(cmsModule.id)}
                >
                  <Icon name={cmsModule.icon} size={20} />
                  {isCollapsed ? null : cmsModule.navLabel}
                  {visibleChildren.length > 0 && !isCollapsed ? (
                    <Icon name={isExpanded ? 'CaretDown' : 'CaretRight'} size={16} className="ml-auto" />
                  ) : null}
                </Link>
              </Button>

              {visibleChildren.length > 0 && isExpanded && !isCollapsed ? (
                <Box flex={{ direction: 'col', gap: 2 }} className="ml-4">
                  {visibleChildren.map((child) => (
                    <Button
                      key={child.id}
                      asChild
                      variant={{ kind: 'ghost', color: 'surface' }}
                      textColor={{ color: 'surface', intensity: 700 }}
                      className="justify-start text-sm"
                      aria-label={child.navLabel}
                    >
                      <Link to={`/cms/${cmsModule.id}/${child.id}`}>{child.navLabel}</Link>
                    </Button>
                  ))}
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>

      <Button
        variant={{ kind: 'ghost', color: 'surface' }}
        textColor={{ color: 'surface', intensity: 950 }}
        className={`flex flex-row items-center gap-2 ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={onToggleCollapsed}
      >
        <Icon name="List" size={20} />
        {isCollapsed ? null : 'Collapse'}
      </Button>
    </Box>
  );
};