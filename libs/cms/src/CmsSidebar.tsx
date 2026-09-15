import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Button, Icon, IconButton } from '@inithium/ui';
import { cmsModules } from './modules/registry';
import { canAccessCmsResource, useCmsCurrentUser } from './CmsCurrentUserContext';

export interface CmsSidebarProps {
  readonly isCollapsed: boolean;
  readonly onToggleCollapsed: () => void;
}

const EXPANDED_WIDTH = 'w-60';
const COLLAPSED_WIDTH = 'w-16';

// Module links + the collapse toggle, formatted identically (icon left, label right, label
// hidden while collapsed) so the toggle reads as one more row in the same list rather than a
// separate control. A module with `children` additionally renders a disclosure toggle and, when
// expanded, a nested list of child links.
export const CmsSidebar = ({ isCollapsed, onToggleCollapsed }: CmsSidebarProps) => {
  const currentUser = useCmsCurrentUser();
  const location = useLocation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const activeModuleId = location.pathname.split('/')[2];

  // Auto-expand whichever module's own URL is currently active, so a directly-loaded child route
  // (e.g. a bookmarked /cms/studio-offerings/classes) shows its parent group already open instead
  // of collapsed with no visual explanation for where the current page lives. Only ever adds -
  // manually collapsing a group the user isn't currently on still works afterward.
  useEffect(() => {
    if (!activeModuleId) return;
    setExpandedIds((prev) => (prev.has(activeModuleId) ? prev : new Set(prev).add(activeModuleId)));
  }, [activeModuleId]);

  const toggleExpanded = (moduleId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const visibleModules = cmsModules.filter((cmsModule) =>
    canAccessCmsResource(currentUser, cmsModule.requiredCapability)
  );

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
              <Box flex={{ direction: 'row', align: 'center', gap: 2 }}>
                <Button
                  asChild
                  variant={{ kind: 'ghost', color: 'surface' }}
                  textColor={{ color: 'surface', intensity: 950 }}
                  className={`flex-1 ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                  aria-label={cmsModule.navLabel}
                >
                  <Link to={`/cms/${cmsModule.id}`} className="flex flex-row items-center gap-2">
                    <Icon name={cmsModule.icon} size={20} />
                    {isCollapsed ? null : cmsModule.navLabel}
                  </Link>
                </Button>

                {visibleChildren.length > 0 && !isCollapsed ? (
                  <IconButton
                    icon={isExpanded ? 'CaretDown' : 'CaretRight'}
                    label={isExpanded ? `Collapse ${cmsModule.navLabel}` : `Expand ${cmsModule.navLabel}`}
                    onClick={() => toggleExpanded(cmsModule.id)}
                  />
                ) : null}
              </Box>

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
