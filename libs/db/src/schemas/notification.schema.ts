import mongoose, { Schema, Document } from 'mongoose';

export interface NotificationDocument extends Document {
  userId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  icon?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    // Plain string, not ObjectId - matches how AuthTokenPayload.sub and UserEntity.id already
    // flow through the rest of the API as strings, so `{ userId: req.user.sub }` queries need
    // no ObjectId casting.
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: false },
    actionUrl: { type: String, required: false },
    icon: { type: String, required: false },
    isRead: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true }
);

export const NotificationModel =
  mongoose.models['Notification'] || mongoose.model<NotificationDocument>('Notification', notificationSchema);
