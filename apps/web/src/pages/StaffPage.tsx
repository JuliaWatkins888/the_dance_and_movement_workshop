import { useState } from 'react';
import { Avatar, Box, Loader, Pagination, Text, useNavigateWithTransition } from '@inithium/ui';
import { useListPublicStaffQuery } from '@inithium/api-client';
import type { StaffMemberDto } from '@inithium/api-client';

const PAGE_SIZE = 12;

const fullNameOf = (member: StaffMemberDto): string =>
  member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName;

interface StaffCardProps {
  readonly member: StaffMemberDto;
  readonly onOpen: (member: StaffMemberDto) => void;
}

// Full-bleed portrait card: the photo (or an initials fallback) fills the whole card, with
// name/title/email overlaid on a bottom gradient by default, and a full dark overlay with
// name/bio fading in on hover. Modeled on the shape of the PRD screenshot (photo up top, quick
// facts always visible, fuller bio on hover) without copying its specific visual treatment.
// Clicking/tapping anywhere on the card opens the full Staff Detail page (bio + what they teach) -
// the hover overlay stays as a desktop-only quick peek, but the click-through is what actually
// works on touch devices, which have no hover state to reveal that overlay at all.
const StaffCard = ({ member, onOpen }: StaffCardProps) => {
  const name = fullNameOf(member);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(member)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(member);
        }
      }}
      className="group relative aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-lg border border-surface-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {member.photoUrl ? (
        <img src={member.photoUrl} alt={name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Box
          bgColor={{ color: 'surface', intensity: 200 }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
        >
          <Avatar
            source={{ variant: 'initials', name }}
            size={96}
            styleConfig={{ bgColor: { color: 'primary', intensity: 500 }, shape: 'circle' }}
          />
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs uppercase tracking-wide">
            Photo coming soon
          </Text>
        </Box>
      )}

      {/* Always-visible quick facts, fades out on hover to make room for the full overlay below -
          uses hardcoded white/black rather than surface tokens deliberately: this sits on top of
          a fixed dark gradient over a photo, not a themed page surface, so it must read the same
          in both light and dark mode. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-10 transition-opacity duration-300 group-hover:opacity-0">
        <Text as="p" className="truncate text-base font-bold text-white">
          {name}
        </Text>
        <Text as="p" className="truncate text-sm text-white/85">
          {member.title}
        </Text>
        <Text as="p" className="truncate text-xs text-white/70">
          {member.email}
        </Text>
      </div>

      {/* flex-col (not justify-center) with the bio as the only flex-1/overflow-y-auto child -
          name/title stay pinned at the top while a long bio scrolls internally instead of
          spilling past the card's own bounds (inset-0 already caps this overlay at the card's
          height, so overflowing content needs somewhere to go that isn't "past the edges"). */}
      <div className="absolute inset-0 flex flex-col gap-2 bg-black/85 p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <Text as="p" className="shrink-0 text-lg font-bold text-white">
          {name}
        </Text>
        <Text as="p" className="shrink-0 text-xs font-semibold uppercase tracking-wide text-primary-400">
          {member.title}
        </Text>
        {member.bio ? (
          <Text as="p" className="min-h-0 flex-1 overflow-y-auto text-sm text-white/85">
            {member.bio}
          </Text>
        ) : null}
      </div>
    </div>
  );
};

export const StaffPage = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListPublicStaffQuery({ page, pageSize: PAGE_SIZE });
  const navigate = useNavigateWithTransition();
  const openMember = (member: StaffMemberDto) => navigate(`/instructors/${member.id}`);

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
          Meet Our Staff
        </Text>
        <Text textColor={{ color: 'surface', intensity: 600 }} as="p">
          The people behind the scenes.
        </Text>
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : (
        <Box className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(data?.items ?? []).map((member) => (
            <StaffCard key={member.id} member={member} onOpen={openMember} />
          ))}
        </Box>
      )}

      {data && data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </Box>
  );
};

export default StaffPage;
