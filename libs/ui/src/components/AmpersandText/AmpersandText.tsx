import type { ColorSpec } from '../../contracts/color.contract';
import { resolveColorClass } from '../../theme/resolveColorClass';

export interface AmpersandTextProps {
  readonly text: string;
  // Defaults to the brand primary - CLAUDE.md's semantic token system only lets one color apply
  // per element, so accenting just the '&' needs its own span rather than a textColor prop on
  // whatever Text/heading wraps this.
  readonly accentColor?: ColorSpec;
}

const DEFAULT_ACCENT_COLOR: ColorSpec = { color: 'primary', intensity: 500 };

// Splits on '&' and wraps every occurrence in an accent-colored span, so brand copy (page
// titles, the Navbar/CmsNavbar site name) always renders its ampersand in the brand color
// regardless of whatever textColor the surrounding element applies - a child's own explicit
// color always wins over an ancestor's inherited one, so this holds no matter what wraps it.
export const AmpersandText = ({ text, accentColor = DEFAULT_ACCENT_COLOR }: AmpersandTextProps) => (
  <>
    {text.split(/(&)/g).map((chunk, index) =>
      chunk === '&' ? (
        <span key={index} className={resolveColorClass('text', accentColor)}>
          &
        </span>
      ) : (
        chunk
      ),
    )}
  </>
);
