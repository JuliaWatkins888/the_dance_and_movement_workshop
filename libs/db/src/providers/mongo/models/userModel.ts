import mongoose, { Schema, Document } from 'mongoose';
import { AVATAR_SHAPES, AVATAR_VARIANTS, CORE_ROLES, DEFAULT_AVATAR_CONFIG } from '../../../contracts/user.contract';
import type { AvatarConfig, CapabilityOverrides, Role, UserProfileBannerConfig } from '../../../contracts/user.contract';

export interface UserDocument extends Document {
  email: string;
  firstName: string;
  lastName?: string;
  passwordHash: string;
  role: Role;
  isOwner: boolean;
  capabilityOverrides: CapabilityOverrides;
  avatar: AvatarConfig;
  profileBanner?: UserProfileBannerConfig;
  darkMode: boolean;
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: false },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: CORE_ROLES, default: 'user' },
    isOwner: { type: Boolean, required: true, default: false },
    // Sparse map of capability-key -> explicit grant(true)/revoke(false), layered on top of the
    // role's default bundle (see @inithium/permissions). Mixed rather than a sub-schema since
    // keys are opaque, plugin-owned strings core has no fixed list of.
    capabilityOverrides: { type: Schema.Types.Mixed, required: true, default: {} },
    darkMode: { type: Boolean, required: true, default: false },
    avatar: {
      variant: { type: String, required: true, enum: AVATAR_VARIANTS, default: DEFAULT_AVATAR_CONFIG.variant },
      style: {
        bgColor: {
          color: { type: String, required: true, default: DEFAULT_AVATAR_CONFIG.style.bgColor.color },
          intensity: { type: Number, required: false, default: DEFAULT_AVATAR_CONFIG.style.bgColor.intensity },
          opacity: { type: Number, required: false },
        },
        fontColor: {
          color: { type: String, required: false },
          intensity: { type: Number, required: false },
          opacity: { type: Number, required: false },
        },
        shape: { type: String, required: true, enum: AVATAR_SHAPES, default: DEFAULT_AVATAR_CONFIG.style.shape },
      },
      dicebear: {
        style: { type: String, required: false },
        seed: { type: String, required: false },
        options: { type: Schema.Types.Mixed, required: false },
      },
      // Takes precedence over variant/style/dicebear entirely when set - see the identical
      // override on profileBanner below and the contract's own comment.
      imageUrl: { type: String, required: false },
    },
    // Backfilled with a random on-brand default at creation time (see user.repository.ts's
    // create() / generateDefaultProfileBannerConfig) rather than left absent - still `required:
    // false` since ProfilePage falls back to a client-generated mesh for any legacy user created
    // before this field existed (see apps/web/src/pages/profileBannerConfig.ts).
    profileBanner: {
      type: {
        cellSize: { type: Number, required: true },
        variance: { type: Number, required: true },
        xColors: { type: [String], required: true },
        yColors: { type: [String], required: true },
        imageUrl: { type: String, required: false },
      },
      required: false,
    },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models['User'] || mongoose.model<UserDocument>('User', userSchema);