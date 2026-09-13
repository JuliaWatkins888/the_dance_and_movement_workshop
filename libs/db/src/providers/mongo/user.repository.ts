import type { Model, QueryFilter } from 'mongoose';
import {
  CreateUserInput,
  DEFAULT_AVATAR_CONFIG,
  FindManyUsersOptions,
  UpdateUserInput,
  UserEntity,
  UserRegistrationCount,
  UserRepository,
} from '../../contracts/user.contract';
import type { PaginatedResult } from '../../contracts/pagination.contract';
import { escapeRegExp } from '../../utils/escapeRegExp';
import { generateDefaultProfileBannerConfig } from '../../utils/generateDefaultProfileBannerConfig';
import { UserDocument } from './models/userModel';

const mapToUserEntity = (doc: UserDocument): UserEntity => ({
  id: doc._id.toString(),
  email: doc.email,
  firstName: doc.firstName,
  lastName: doc.lastName,
  passwordHash: doc.passwordHash,
  role: doc.role,
  // Defensive fallbacks - a document written before this field existed won't have it until
  // ensureOwnerBootstrap()/an explicit permissions edit touches it (Mongoose schema `default:`
  // only applies to newly-created documents, not pre-existing ones read back via findById).
  isOwner: doc.isOwner ?? false,
  capabilityOverrides: doc.capabilityOverrides ?? {},
  avatar: doc.avatar,
  profileBanner: doc.profileBanner,
  darkMode: doc.darkMode,
  createdAt: doc.createdAt,
});

export const createMongoUserRepository = (model: Model<UserDocument>): UserRepository => ({
  findById: async (id: string): Promise<UserEntity | null> => {
    const user = await model.findById(id).exec();
    return user ? mapToUserEntity(user) : null;
  },
  findByEmail: async (email: string): Promise<UserEntity | null> => {
    const user = await model.findOne({ email }).exec();
    return user ? mapToUserEntity(user) : null;
  },
  findMany: async (options: FindManyUsersOptions): Promise<PaginatedResult<UserEntity>> => {
    const { page, pageSize, search, searchField } = options;
    const filter: QueryFilter<UserDocument> = {};
    if (search && searchField) {
      filter[searchField] = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map(mapToUserEntity), total, page, pageSize };
  },
  create: async (input: CreateUserInput): Promise<UserEntity> => {
    const user = await model.create({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: input.passwordHash,
      role: input.role ?? 'user',
      avatar: input.avatar ?? DEFAULT_AVATAR_CONFIG,
      darkMode: input.darkMode ?? false,
      // Every new user gets an immediate, customizable baseline banner rather than waiting on
      // the frontend's lazy per-render fallback (see apps/web/src/pages/profileBannerConfig.ts) -
      // same "backfill a sensible default at creation time" precedent as avatar above.
      profileBanner: input.profileBanner ?? generateDefaultProfileBannerConfig(),
    });
    return mapToUserEntity(user);
  },
  update: async (id: string, input: UpdateUserInput): Promise<UserEntity | null> => {
    const updateDoc: Record<string, unknown> = {};
    if (input.email !== undefined) updateDoc['email'] = input.email;
    if (input.firstName !== undefined) updateDoc['firstName'] = input.firstName;
    if (input.lastName !== undefined) updateDoc['lastName'] = input.lastName;
    if (input.passwordHash !== undefined) updateDoc['passwordHash'] = input.passwordHash;
    if (input.role !== undefined) updateDoc['role'] = input.role;
    if (input.capabilityOverrides !== undefined) updateDoc['capabilityOverrides'] = input.capabilityOverrides;
    if (input.avatar !== undefined) updateDoc['avatar'] = input.avatar;
    if (input.profileBanner !== undefined) updateDoc['profileBanner'] = input.profileBanner;
    if (input.darkMode !== undefined) updateDoc['darkMode'] = input.darkMode;

    const user = await model.findByIdAndUpdate(id, { $set: updateDoc }, { new: true }).exec();
    return user ? mapToUserEntity(user) : null;
  },
  delete: async (id: string): Promise<boolean> => {
    const result = await model.findByIdAndDelete(id).exec();
    return result !== null;
  },
  countRegistrationsByDay: async (): Promise<UserRegistrationCount[]> => {
    const results = await model
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return results.map((entry) => ({ date: entry._id, count: entry.count }));
  },
  countAll: async (): Promise<number> => model.countDocuments().exec(),
  transferOwnership: async (newOwnerId: string): Promise<UserEntity> => {
    // No multi-document transactions elsewhere in this repository (see e.g. storage's
    // asset-vs-avatar cleanup) - sequential updates with a small, accepted non-atomic window
    // rather than introducing session/transaction machinery for this one case.
    await model.updateMany({ isOwner: true }, { $set: { isOwner: false } }).exec();
    const user = await model.findByIdAndUpdate(newOwnerId, { $set: { isOwner: true } }, { new: true }).exec();
    if (!user) throw new Error(`transferOwnership: user ${newOwnerId} not found`);
    return mapToUserEntity(user);
  },
});
