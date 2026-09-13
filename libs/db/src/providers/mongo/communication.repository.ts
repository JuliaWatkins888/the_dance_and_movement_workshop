import type { Model, QueryFilter } from 'mongoose';
import {
  AddCommunicationMessageInput,
  CommunicationEntity,
  CommunicationMessage,
  CommunicationRepository,
  CreateCommunicationInput,
  FindManyCommunicationsOptions,
} from '../../contracts/communication.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { CommunicationDocument, CommunicationMessageDocument } from '../../schemas/communication.schema';

const mapToMessage = (doc: CommunicationMessageDocument): CommunicationMessage => ({
  id: doc._id.toString(),
  authorRole: doc.authorRole,
  authorUserId: doc.authorUserId,
  authorName: doc.authorName,
  body: doc.body,
  createdAt: doc.createdAt,
});

const mapToCommunicationEntity = (doc: CommunicationDocument): CommunicationEntity => ({
  id: doc._id.toString(),
  submitterUserId: doc.submitterUserId,
  firstName: doc.firstName,
  lastName: doc.lastName,
  email: doc.email,
  subject: doc.subject,
  messages: doc.messages.map(mapToMessage),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createMongoCommunicationRepository = (model: Model<CommunicationDocument>): CommunicationRepository => ({
  findById: async (id: string): Promise<CommunicationEntity | null> => {
    const communication = await model.findById(id).exec();
    return communication ? mapToCommunicationEntity(communication) : null;
  },
  findMany: async (options: FindManyCommunicationsOptions): Promise<PaginatedResult<CommunicationEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<CommunicationDocument> = {};
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToCommunicationEntity), total, page, pageSize };
  },
  findForUser: async (submitterUserId: string): Promise<CommunicationEntity[]> => {
    const docs = await model.find({ submitterUserId }).sort({ updatedAt: -1 }).exec();
    return docs.map(mapToCommunicationEntity);
  },
  create: async (input: CreateCommunicationInput): Promise<CommunicationEntity> => {
    const { message, ...rest } = input;
    const firstMessage: Omit<CommunicationMessage, 'id' | 'createdAt'> = {
      authorRole: 'submitter',
      authorUserId: input.submitterUserId,
      authorName: `${input.firstName} ${input.lastName}`.trim(),
      body: message,
    };
    const communication = await model.create({ ...rest, messages: [firstMessage] });
    return mapToCommunicationEntity(communication);
  },
  addMessage: async (id: string, input: AddCommunicationMessageInput): Promise<CommunicationEntity | null> => {
    const communication = await model
      .findByIdAndUpdate(
        id,
        { $push: { messages: { ...input, createdAt: new Date() } } },
        { new: true, runValidators: true }
      )
      .exec();
    return communication ? mapToCommunicationEntity(communication) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
});
