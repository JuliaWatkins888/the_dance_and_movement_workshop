import { Link } from 'react-router-dom';
import type { PageEntity } from '@inithium/db';
import { Box, Button, Icon, Text } from '../components';
import type { IconName } from '../tokens/icon';
import { mergeClassNames } from '../theme/mergeClassNames';

export interface FooterProps {
  // Pre-filtered by the app host (one `useGetNavPagesQuery` call per location) rather than a
  // single unfiltered list Footer filters itself - mirrors Navbar's convention of staying a pure
  // consumer of already-shaped data instead of duplicating the server's own location filtering/sorting.
  readonly primaryFooterPages: PageEntity[];
  readonly secondaryFooterPages: PageEntity[];
  // Shown in the auto-updating copyright line, e.g. "© 2026 Inithium. All rights reserved."
  readonly brandName?: string;
  readonly className?: string;
}

const DEFAULT_BRAND_NAME = 'Inithium';

const FooterLink = ({ page, muted = false }: { page: PageEntity; muted?: boolean }) => (
  <Button
    asChild
    variant={{ kind: 'link', color: 'accent' }}
    textColor={{ color: 'surface', intensity: muted ? 500 : 950 }}
  >
    <Link to={page.routePattern}>
      {page.navigation.icon ? <Icon name={page.navigation.icon as IconName} size={14} /> : null}
      {page.navigation.label}
    </Link>
  </Button>
);

// Assembles Box/Button/Text/Icon primitives into the app's footer. Purely presentational - the
// app host is responsible for fetching primaryFooterPages/secondaryFooterPages (one
// `useGetNavPagesQuery` call per location) and passes them in as plain props, same as Navbar.
export const Footer = ({
  primaryFooterPages,
  secondaryFooterPages,
  brandName = DEFAULT_BRAND_NAME,
  className,
}: FooterProps) => {
  const year = new Date().getFullYear();

  return (
    <Box
      as="footer"
      flex={{ direction: 'col', align: 'start', gap: 12 }}
      bgColor={{ color: 'surface', intensity: 100 }}
      borderColor={{ color: 'surface', intensity: 300 }}
      padding={{ top: 24, bottom: 24, left: 24, right: 24 }}
      className={mergeClassNames('w-full border-t', className)}
    >
      <Box flex={{ direction: 'row', justify: 'start', align: 'center', wrap: 'wrap', gap: 24 }}>
        {primaryFooterPages.map((page) => (
          <FooterLink key={page.id} page={page} />
        ))}
      </Box>

      <Box flex={{ direction: 'row', justify: 'start', align: 'center', wrap: 'wrap', gap: 8 }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 500 }} className="text-sm">
          &copy; {year} {brandName}. All rights reserved.
        </Text>
        {secondaryFooterPages.map((page) => (
          <Box key={page.id} flex={{ direction: 'row', align: 'center', gap: 8 }}>
            <Text as="span" textColor={{ color: 'surface', intensity: 300 }}>
              |
            </Text>
            <FooterLink page={page} muted />
          </Box>
        ))}
      </Box>
    </Box>
  );
};
