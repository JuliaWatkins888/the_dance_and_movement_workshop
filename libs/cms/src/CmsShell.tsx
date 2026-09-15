import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box } from '@inithium/ui';
import type { AuthUser } from '@inithium/api-client';
import { cmsModules } from './modules/registry';
import { ModuleRenderer } from './ModuleRenderer';
import { CmsNavbar } from './CmsNavbar';
import { CmsSidebar } from './CmsSidebar';
import { CmsCurrentUserProvider, canAccessCmsResource } from './CmsCurrentUserContext';

export interface CmsShellProps {
  readonly currentUser: AuthUser;
  readonly onLogout: () => void;
}

// Paths below are absolute ("/cms", not "/") because RootRouter (in apps/web) reaches CmsRoot
// via a manual pathname check rather than a parent <Route path="/cms/*">, so these <Routes>
// match against the full current pathname, not a stripped-down remainder.
export const CmsShell = ({ currentUser, onLogout }: CmsShellProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  // The default redirect target must respect the same capability gate CmsSidebar/ModuleRenderer
  // apply, or /cms could redirect a viewer straight into a module they can't actually see.
  const accessibleModules = cmsModules.filter((cmsModule) =>
    canAccessCmsResource(currentUser, cmsModule.requiredCapability)
  );
  const firstModuleId = accessibleModules[0]?.id;

  return (
    <CmsCurrentUserProvider value={currentUser}>
      <Box flex={{ direction: 'col' }} className="h-screen w-full overflow-hidden">
        <CmsNavbar currentUser={currentUser} onLogout={onLogout} />

        <Box flex={{ direction: 'row' }} className="min-h-0 flex-1">
          <CmsSidebar isCollapsed={isCollapsed} onToggleCollapsed={() => setIsCollapsed((prev) => !prev)} />

          <Box bgColor={{ color: 'surface', intensity: 100 }} className="min-w-0 flex-1 overflow-y-auto">
            <Routes>
              {firstModuleId ? (
                <Route path="/cms" element={<Navigate to={`/cms/${firstModuleId}`} replace />} />
              ) : null}
              <Route path="/cms/:moduleId" element={<ModuleRenderer />} />
              <Route path="/cms/:moduleId/:childId" element={<ModuleRenderer />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </CmsCurrentUserProvider>
  );
};
