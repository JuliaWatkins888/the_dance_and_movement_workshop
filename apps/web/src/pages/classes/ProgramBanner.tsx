import { useMemo } from 'react';
import { Banner, DEFAULT_BANNER_HEIGHT, generateSeededBannerConfig, mergeClassNames, useElementSize } from '@inithium/ui';
import type { BannerTrianglifyConfig } from '@inithium/ui';
import type { PublicProgramDto } from '@inithium/api-client';

// Stored color stops are a plain string[]; the admin editor only ever saves non-empty lists.
export const resolveProgramBanner = (program: Pick<PublicProgramDto, 'id' | 'banner'>): BannerTrianglifyConfig =>
  (program.banner as BannerTrianglifyConfig | undefined) ?? generateSeededBannerConfig(program.id);

export interface ProgramBannerProps {
  readonly program: Pick<PublicProgramDto, 'id' | 'name' | 'imageUrl' | 'banner'>;
  readonly height?: number;
  readonly className?: string;
}

// The program's image, or its trianglify placeholder - measured so the mesh isn't stretched
// whether it fills a narrow grid card or a full-width page header.
export const ProgramBanner = ({ program, height = DEFAULT_BANNER_HEIGHT, className }: ProgramBannerProps) => {
  const { ref, size } = useElementSize();
  const trianglifyConfig = useMemo(() => resolveProgramBanner(program), [program]);

  return (
    <div ref={ref} className={mergeClassNames('w-full overflow-hidden', className)} style={{ height: `${height}px` }}>
      <Banner
        imageUrl={program.imageUrl}
        imageAlt={program.name}
        trianglifyConfig={trianglifyConfig}
        width={size?.width ?? '100%'}
        height={height}
      />
    </div>
  );
};
