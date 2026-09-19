import { useMemo } from 'react';
import { Box, Button, Loader, Text, useNavigateWithTransition } from '@inithium/ui';
import { useListPublicClassesQuery, useListPublicWorkshopsQuery, usePageParams } from '@inithium/api-client';

// Scaffold only - see class-register.page-seed.ts's own note. This is deliberately not the real
// registration flow (no form, no payment, no family/student picker) - it exists so an eligible
// Register button (RegistrationButton.tsx) has a real, dedicated route to land on instead of the
// Contact page, and so the eventual real flow has somewhere to grow into without another round of
// page-seed/pageComponents wiring. Reuses the existing public catalog queries (rather than a new
// single-item endpoint) purely to show which offering the visitor came from, matching the "small
// catalog, filter client-side" precedent every other public page already follows.
export const RegisterPage = () => {
  const { offeringType, offeringId } = usePageParams();
  const navigate = useNavigateWithTransition();
  const isClass = offeringType === 'class';

  const { data: classes, isLoading: isLoadingClasses } = useListPublicClassesQuery(undefined, { skip: !isClass });
  const { data: workshops, isLoading: isLoadingWorkshops } = useListPublicWorkshopsQuery(undefined, { skip: isClass });

  const classItem = useMemo(() => classes?.find((item) => item.id === offeringId), [classes, offeringId]);
  const workshop = useMemo(() => workshops?.find((item) => item.id === offeringId), [workshops, offeringId]);

  const isLoading = isClass ? isLoadingClasses : isLoadingWorkshops;
  const displayName = isClass
    ? classItem
      ? `${classItem.courseName}${classItem.variantLabel ? ` - ${classItem.variantLabel}` : ''}`
      : undefined
    : workshop?.name;

  return (
    <Box
      flex={{ direction: 'col', gap: 16, justify: 'center', align: 'center' }}
      padding={{ base: 32 }}
      style={{ minHeight: 'calc(100vh - 64px)' }}
      bgColor={{ color: 'surface', intensity: 100 }}
    >
      {isLoading ? (
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      ) : (
        <>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-center text-3xl font-bold">
            Register{displayName ? ` for ${displayName}` : ''}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-md text-center text-sm">
            Online registration isn&apos;t available yet - we&apos;re actively building it. In the meantime, reach
            out and we&apos;ll help you get your student enrolled.
          </Text>
          <Box flex={{ direction: 'row', gap: 12 }}>
            <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={() => navigate('/courses')}>
              Back to classes
            </Button>
            <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => navigate('/contact')}>
              Contact Us
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default RegisterPage;
