import type { CommunicationDto } from '@inithium/api-client';

// A thread "needs a reply" whenever its most recent message came from the submitter - shared by
// CommunicationsAdminModule's list badge and the dashboard's communications-needing-reply widget
// so the two never drift on what counts as unanswered.
export const communicationNeedsReply = (communication: CommunicationDto): boolean =>
  communication.messages[communication.messages.length - 1]?.authorRole === 'submitter';
