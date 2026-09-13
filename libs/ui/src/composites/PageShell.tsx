import { useEffect, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import type { PageEntity } from '@inithium/db';
import { AnimateBox } from '../components';
import { resolveColorClass } from '../theme/resolveColorClass';
import { mergeClassNames } from '../theme/mergeClassNames';
import { ENTRANCE_ANIMATIONS, EXIT_ANIMATIONS } from '../tokens/animation';
import type { EntranceAnim, ExitAnim } from '../tokens/animation';
import type { ColorSpec } from '../contracts/color.contract';

export type PageComponentMap = Record<string, ComponentType>;

export interface PageShellProps {
  readonly page: PageEntity;
  // Slug -> component lookup table. Kept generic/app-agnostic here - the app host (apps/web)
  // owns which React components exist for which pages and supplies the table; PageShell only
  // owns the *resolution* (matching page.slug against it) and the surrounding chrome.
  readonly components: PageComponentMap;
  // Should match the sibling Navbar's own `height` prop so `100vh - navbarHeight` lines up with
  // its real rendered height.
  readonly navbarHeight?: number;
  readonly fallback?: ReactNode;
  readonly className?: string;
}

const DEFAULT_NAVBAR_HEIGHT = 64;
const DEFAULT_ENTRANCE: EntranceAnim = 'animate__fadeIn';
const DEFAULT_EXIT: ExitAnim = 'animate__fadeOut';

const isEntranceAnim = (value: string): value is EntranceAnim =>
  (ENTRANCE_ANIMATIONS as readonly string[]).includes(value);

const isExitAnim = (value: string): value is ExitAnim => (EXIT_ANIMATIONS as readonly string[]).includes(value);

// @inithium/db's PageColorConfig stores intensity/opacity as a plain `number` (libs/db must
// stay ignorant of @inithium/ui's ColorSpec); the cast is safe for the same reason Navbar's
// avatar color mapping is - resolveColorClass/Box's bgColor just stringify whatever number they
// get regardless of the compile-time ColorIntensity/ColorOpacity union.
const toColorSpec = (spec: { color: string; intensity?: number; opacity?: number }): ColorSpec =>
  spec as ColorSpec;

// Resolves a page record's layout/animation/theme configuration and renders whichever component
// its slug maps to. Built on AnimateBox per spec; entrance/exit come from the page's own
// animation config (validated against the known animate.css class list, falling back to a
// plain fade if a stored value doesn't match one), while duration/delay - stored as arbitrary
// milliseconds, which AnimationSpec's speed/delay tokens are too coarse to represent - are
// applied as animate.css v4's own `--animate-duration`/`--animate-delay` CSS variable overrides.
export const PageShell = ({
  page,
  components,
  navbarHeight = DEFAULT_NAVBAR_HEIGHT,
  fallback = null,
  className,
}: PageShellProps) => {
  // `displayed` intentionally lags one step behind `page`: when a navigation resolves a
  // different page, the *currently shown* one needs to play its own exit animation first,
  // rather than being torn out instantly while the new one fades/slides in on top of it (the
  // "flash" this replaces). isExiting is derived, not stored - it's just "the prop moved on
  // but the displayed page hasn't caught up yet".
  const [displayed, setDisplayed] = useState(page);
  const isExiting = displayed.id !== page.id;

  useEffect(() => {
    if (!isExiting) return undefined;
    // Use the *exiting* page's own duration/delay - that's whose animation is actually
    // playing right now - not the incoming page's, so the swap lines up with what's on screen.
    const exitMs = displayed.animation.duration + displayed.animation.delay;
    const timer = setTimeout(() => setDisplayed(page), exitMs);
    return () => clearTimeout(timer);
  }, [isExiting, page, displayed]);

  const activePage = displayed;
  const entrance = isEntranceAnim(activePage.animation.enter) ? activePage.animation.enter : DEFAULT_ENTRANCE;
  const exit = isExitAnim(activePage.animation.exit) ? activePage.animation.exit : DEFAULT_EXIT;
  const PageComponent = components[activePage.slug];

  const style = {
    // Never shorter than the viewport minus the navbar, but free to grow beyond it - content
    // taller than that scrolls the document normally, nothing here clips or scroll-traps it.
    minHeight: `calc(100vh - ${navbarHeight}px)`,
    '--animate-duration': `${activePage.animation.duration}ms`,
    '--animate-delay': `${activePage.animation.delay}ms`,
  } as CSSProperties;

  return (
    // key={activePage.id} forces a real remount whenever the displayed page actually changes
    // (once the exit above finishes), guaranteeing the entrance animation replays even if two
    // consecutive pages happen to share the same animation class. While *isExiting* is true,
    // `activePage`/the key stay pointed at the OLD page - only `trigger` flips to 'exit' on
    // that still-mounted instance, which is what makes its exit class actually (re)apply.
    <AnimateBox
      key={activePage.id}
      trigger={isExiting ? 'exit' : 'entrance'}
      animation={{ entrance, exit }}
      bgColor={toColorSpec(activePage.backgroundColor)}
      // A flex column so a page component can actually fill the available height (`flex-1`
      // on its own root element) rather than reaching for `h-full` — this box only ever sets
      // `min-height` above (deliberately, so tall content can still grow past the viewport and
      // scroll), and a percentage height has nothing definite to resolve against without a
      // flex/grid parent to stretch against instead.
      flex={{ direction: 'col' }}
      style={style}
      className={mergeClassNames('w-full', resolveColorClass('text', toColorSpec(activePage.foregroundColor)), className)}
    >
      {PageComponent ? <PageComponent /> : fallback}
    </AnimateBox>
  );
};
