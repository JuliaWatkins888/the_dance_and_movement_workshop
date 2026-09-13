import type { PaginatedResult } from './pagination.contract';

export type CommunicationAuthorRole = 'submitter' | 'admin';

export interface CommunicationMessage {
  id: string;
  authorRole: CommunicationAuthorRole;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: Date;
}

// An open-ended thread, not a single comment+reply pair (contrast blog.contract.ts's
// CommentEntity) - either side can keep appending to `messages` for as long as the
// correspondence needs to continue, with no separate status field: "resolved" is just implied by
// both sides going quiet.
export interface CommunicationEntity {
  id: string;
  submitterUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  messages: CommunicationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommunicationInput {
  submitterUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
}

export interface AddCommunicationMessageInput {
  authorRole: CommunicationAuthorRole;
  authorUserId: string;
  authorName: string;
  body: string;
}

export type CommunicationSearchField = 'subject' | 'email' | 'firstName' | 'lastName';

export interface FindManyCommunicationsOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: CommunicationSearchField;
}

export interface CommunicationRepository {
  findById: (id: string) => Promise<CommunicationEntity | null>;
  findMany: (options: FindManyCommunicationsOptions) => Promise<PaginatedResult<CommunicationEntity>>;
  findForUser: (submitterUserId: string) => Promise<CommunicationEntity[]>;
  create: (input: CreateCommunicationInput) => Promise<CommunicationEntity>;
  addMessage: (id: string, input: AddCommunicationMessageInput) => Promise<CommunicationEntity | null>;
  // Permanent - callers (contact.route.ts's admin-only DELETE) are also responsible for sweeping
  // any notification that pointed at this thread, since a deleted communication leaves no trace
  // for either the submitter or the recipient to find their way back to.
  delete: (id: string) => Promise<boolean>;
}
