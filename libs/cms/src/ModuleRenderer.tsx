import { useParams } from 'react-router-dom';
import { Box, Text } from '@inithium/ui';
import { cmsModules } from './modules/registry';
import { canAccessCmsResource, useCmsCurrentUser } from './CmsCurrentUserContext';

export const ModuleRenderer = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const currentUser = useCmsCurrentUser();
  const cmsModule = cmsModules.find((candidate) => candidate.id === moduleId);

  // A module whose requiredCapability the viewer lacks gets the identical "not found" fallback a
  // genuinely nonexistent moduleId gets - deliberately indistinguishable, mirroring CmsRoot's own
  // "reveal nothing" behavior for the top-level gate rather than an "access denied" message that
  // confirms the module exists.
  if (!cmsModule || !canAccessCmsResource(currentUser, cmsModule.requiredCapability)) {
    return (
      <Box padding={{ base: 24 }}>
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-xl font-bold">
          Module not found
        </Text>
        <Text as="p" className="text-surface-600">
          &quot;{moduleId}&quot; isn&apos;t a registered CMS module.
        </Text>
      </Box>
    );
  }

  const Component = cmsModule.Component;
  return <Component />;
};
