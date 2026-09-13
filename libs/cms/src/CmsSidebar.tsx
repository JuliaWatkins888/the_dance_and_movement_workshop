import { Link } from 'react-router-dom';
import { Box, Button, Icon } from '@inithium/ui';
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
// separate control.
export const CmsSidebar = ({ isCollapsed, onToggleCollapsed }: CmsSidebarProps) => {
  const currentUser = useCmsCurrentUser();
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
        {visibleModules.map((cmsModule) => (
          <Button
            key={cmsModule.id}
            asChild
            variant={{ kind: 'ghost', color: 'surface' }}
            textColor={{ color: 'surface', intensity: 950 }}
            className={isCollapsed ? 'justify-center' : 'justify-start'}
            aria-label={cmsModule.navLabel}
          >
            <Link to={`/cms/${cmsModule.id}`} className="flex flex-row items-center gap-2">
              <Icon name={cmsModule.icon} size={20} />
              {isCollapsed ? null : cmsModule.navLabel}
            </Link>
          </Button>
        ))}
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
