import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Avatar,
  AvatarEditDialog,
  Banner,
  BannerEditDialog,
  Box,
  Button,
  DEFAULT_BANNER_HEIGHT,
  Icon,
  Loader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  dialog,
  resolveAvatarConfigProps,
  useElementSize,
} from '@inithium/ui';
import type { BannerTrianglifyConfig } from '@inithium/ui';
import type { AvatarConfig, UserProfileBannerConfig } from '@inithium/db';
import { useGetProfileQuery, usePageParams, useUpdateMyProfileMutation } from '@inithium/api-client';
import type { ProfileDto } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';
import { NotFoundPage } from './NotFoundPage';
import { generateProfileBannerConfig } from './profileBannerConfig';
import { profileSections } from './profile/sections/registry';
import { profileTabs } from './profile/tabs/registry';

const AVATAR_SIZE = 128;
const COLUMN_INSET = 32;

// @inithium/db's UserProfileBannerConfig stores color stops as a plain string[] (libs/db must
// stay ignorant of @inithium/ui's non-empty-tuple BannerTrianglifyConfig type - see
// user.contract.ts's own comment on that split) - this cast is safe the same way PageShell's own
// toColorSpec is: both generateProfileBannerConfig and the future banner picker only ever
// produce non-empty arrays.
const toTrianglifyConfig = (config: ProfileDto['profileBanner']): BannerTrianglifyConfig | undefined =>
  config as BannerTrianglifyConfig | undefined;

export const ProfilePage = () => {
  // Not react-router-dom's useParams() - see PageShell's own comment on why this app's routing
  // is fully data-driven. usePageParams() re-derives ":id" from the resolved Page record's own
  // routePattern instead, the same pattern BlogPostPage uses for "/blog/:id".
  const { id } = usePageParams();
  // Not part of the data-driven routePattern itself (see usePageParams' own comment) - a plain
  // query param, read directly via react-router-dom's useLocation, so a drawer link (e.g. the
  // friends plugin's "Friends" item) can deep-link straight to a specific tab.
  const location = useLocation();
  const requestedTabId = new URLSearchParams(location.search).get('tab');
  const { data: profile, isLoading } = useGetProfileQuery(id ?? '', { skip: !id });
  const { currentUser } = useCurrentUser();
  const [updateMyProfile] = useUpdateMyProfileMutation();
  const isOwnProfile = Boolean(currentUser && profile && currentUser.id === profile.id);
  // Banner generates its mesh against a fixed reference width whenever it isn't told a real
  // pixel width, then stretches that mesh to fill however wide it actually renders - fine near
  // that reference width, but visibly over/under-densifies the triangles at the extremes (see
  // Banner.tsx's own comment on the tradeoff, and its documented useElementSize pattern). This
  // page's banner spans the full page width, which varies a lot across viewports, so it measures
  // its own wrapper and feeds the real width back in to keep the mesh undistorted everywhere.
  const { ref: bannerSizeRef, size: bannerSize } = useElementSize();

  // Falls back to a deterministic mesh seeded off the profile's own id when nothing's been
  // customized yet - every profile has a stable, on-brand banner with zero DB writes until its
  // owner actually saves one (see profileBannerConfig.ts).
  const bannerConfig = useMemo(
    () => (profile ? (toTrianglifyConfig(profile.profileBanner) ?? generateProfileBannerConfig(profile.id)) : undefined),
    [profile],
  );

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center', align: 'center' }} padding={{ base: 32 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (!profile || !bannerConfig) {
    return <NotFoundPage />;
  }

  // 'owned' tabs (Account Settings, ...) never even enter the list for a viewer who isn't the
  // profile's own owner - see registry.ts's own comment on why that's a visibility filter here
  // rather than each tab's Component guarding itself.
  const visibleTabs = profileTabs.filter((tab) => tab.visibility === 'all' || isOwnProfile);
  const initialTabId =
    requestedTabId && visibleTabs.some((tab) => tab.id === requestedTabId) ? requestedTabId : visibleTabs[0]?.id;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');

  const initialBannerConfig: UserProfileBannerConfig =
    profile.profileBanner ?? {
      cellSize: bannerConfig.cellSize,
      variance: bannerConfig.variance,
      xColors: [...bannerConfig.xColors],
      yColors: [...bannerConfig.yColors],
    };

  const openBannerEditDialog = () =>
    dialog.show(
      ({ close }) => (
        <BannerEditDialog
          initialBanner={initialBannerConfig}
          onSave={async (banner) => {
            await updateMyProfile({ profileBanner: banner }).unwrap();
          }}
          onClose={close}
        />
      ),
      { title: 'Edit Banner', width: '75vw' },
    );

  const openAvatarEditDialog = () =>
    dialog.show(
      ({ close }) => (
        <AvatarEditDialog
          initialAvatar={profile.avatar}
          fullName={fullName}
          onSave={async (avatar: AvatarConfig) => {
            await updateMyProfile({ avatar }).unwrap();
          }}
          onClose={close}
        />
      ),
      { title: 'Edit Avatar', width: '75vw' },
    );

  return (
    // lg:min-h matches PageShell's own default navbarHeight (64) - see NotFoundPage's identical
    // calc for the same precedent - so the sidebar below has real room to stretch into on
    // desktop instead of stopping short at its own content height.
    <Box bgColor={{ color: 'surface', intensity: 100 }} flex={{ direction: 'col' }} className="w-full lg:min-h-[calc(100vh_-_64px)]">
      <div ref={bannerSizeRef} className="relative w-full" style={{ height: `${DEFAULT_BANNER_HEIGHT}px` }}>
        <Banner
          imageUrl={profile.profileBanner?.imageUrl}
          trianglifyConfig={bannerConfig}
          width={bannerSize?.width}
          height={DEFAULT_BANNER_HEIGHT}
        />

        {isOwnProfile ? (
          <Button
            variant={{ kind: 'filled', color: 'surface', intensity: 100 }}
            className="absolute right-3 top-3 rounded-full p-2"
            aria-label="Edit banner"
            onClick={openBannerEditDialog}
          >
            <Icon name="PencilSimple" size={16} />
          </Button>
        ) : null}

        {/* Positioned so the banner's own bottom edge (top: DEFAULT_BANNER_HEIGHT) bisects the
            avatar exactly (translateY(-50%)) - "the bottom of the banner intersects the avatar
            at its direct middle" per spec. left offset matches the sidebar's own padding below
            (COLUMN_INSET) so the avatar and the left column read as one aligned column. */}
        <Box
          bgColor={{ color: 'surface', intensity: 200 }}
          borderColor={{ color: 'surface', intensity: 200 }}
          className={`absolute border-4 ${profile?.avatar?.style?.shape === 'circle' ? 'rounded-full' : ''}`}
          style={{ left: `${COLUMN_INSET}px`, top: `${DEFAULT_BANNER_HEIGHT}px`, transform: 'translateY(-50%)' }}
        >
          <Avatar
            {...resolveAvatarConfigProps(profile.avatar, fullName)}
            size={AVATAR_SIZE}
            onClick={isOwnProfile ? openAvatarEditDialog : undefined}
          />
        </Box>
      </div>

      {/* lg:flex-1 lets this row grow to fill whatever's left of the root box's own
          lg:min-h-[calc(100vh_-_64px)] once the (fixed-height) banner above is accounted for, so
          the sidebar's own background genuinely reaches the bottom of the screen instead of
          stopping short at its content's natural height. Columns directly abut (no gap) - each
          carries its own padding - so the sidebar reads as a real panel against the main column,
          not a floating card. */}
      <Box flex={{ direction: 'col' }} className="w-full lg:flex-1 lg:flex-row">
        <Box
          bgColor={{ color: 'surface', intensity: 200 }}
          flex={{ direction: 'col', gap: 24 }}
          padding={{ base: COLUMN_INSET, top: 64 }}
          className="w-full lg:w-1/4 lg:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.15)]"
        >
          {profileSections.map((section) => (
            <section.Component key={section.id} profile={profile} isOwnProfile={isOwnProfile} />
          ))}
        </Box>
        <Box flex={{ direction: 'col' }} padding={{ base: COLUMN_INSET, top: 64 }} className="w-full lg:w-3/4">
          {visibleTabs.length > 0 ? (
            // flex-1 on both Tabs (a flex item of this column) and the active TabsContent (a
            // flex item of Tabs' own flex-col) is what actually delivers "min height of the
            // remaining screen, but free to grow past it": this column is already stretched to
            // the row's real height (see the row's own lg:flex-1 comment above), so the active
            // panel grows to fill whatever's left after the tab strip's own height, pushing the
            // page's own min-height out to the viewport's bottom edge - and past it, undisturbed,
            // the moment a tab's actual content is taller than that.
            <Tabs defaultValue={initialTabId} className="flex flex-1 flex-col">
              <TabsList>
                {visibleTabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {visibleTabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="flex-1">
                  <tab.Component profile={profile} isOwnProfile={isOwnProfile} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <Text className="text-sm text-surface-600">Nothing to show here yet.</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ProfilePage;
