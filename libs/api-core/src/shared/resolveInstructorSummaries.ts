import { getStaffById, getUserRepository } from '@inithium/db';

export interface InstructorSummary {
  id: string;
  name: string;
  photoUrl?: string;
}

// Resolves Class/Workshop's instructorIds (FK -> Staff.id) to display-ready summaries - a 2-hop
// join (Staff.id -> Staff.userId -> User) since Staff never stores its own name (see
// staff.route.ts's own toStaffDto). Unlike toClassDto/toWorkshopDto's own tolerant "fall back to
// empty string" handling of a single FK, a since-deleted Staff or User record is simply dropped
// here rather than rendered as a blank instructor, since this feeds a rendered list of names, not
// a form field that needs to round-trip the original id.
export const resolveInstructorSummaries = async (instructorIds: string[]): Promise<InstructorSummary[]> => {
  const summaries = await Promise.all(
    instructorIds.map(async (instructorId): Promise<InstructorSummary | null> => {
      const staff = await getStaffById(instructorId);
      if (!staff) return null;
      const user = await getUserRepository().findById(staff.userId);
      if (!user) return null;
      return {
        id: staff.id,
        name: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`,
        photoUrl: staff.photoUrl,
      };
    }),
  );
  return summaries.filter((summary): summary is InstructorSummary => summary !== null);
};
