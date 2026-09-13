import type { Model } from 'mongoose';
import { CreateNotificationInput, NotificationEntity, NotificationRepository } from '../../contracts/notification.contract';
import { NotificationDocument } from '../../schemas/notification.schema';

const DEFAULT_LIST_LIMIT = 30;

const mapToNotificationEntity = (doc: NotificationDocument): NotificationEntity => ({
  id: doc._id.toString(),
  userId: doc.userId,
  type: doc.type,
  title: doc.title,
  body: doc.body,
  actionUrl: doc.actionUrl,
  icon: doc.icon,
  isRead: doc.isRead,
  createdAt: doc.createdAt,
});

export const createMongoNotificationRepository = (model: Model<NotificationDocument>): NotificationRepository => ({
  create: async (input: CreateNotificationInput): Promise<NotificationEntity> => {
    const notification = await model.create(input);
    return mapToNotificationEntity(notification);
  },
  listForUser: async (userId: string, options): Promise<NotificationEntity[]> => {
    const notifications = await model
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(options?.limit ?? DEFAULT_LIST_LIMIT)
      .exec();
    return notifications.map(mapToNotificationEntity);
  },
  countUnreadForUser: async (userId: string): Promise<number> => model.countDocuments({ userId, isRead: false }).exec(),
  markAsRead: async (id: string, userId: string): Promise<NotificationEntity | null> => {
    const notification = await model.findOneAndUpdate({ _id: id, userId }, { $set: { isRead: true } }, { new: true }).exec();
    return notification ? mapToNotificationEntity(notification) : null;
  },
  markAllAsReadForUser: async (userId: string): Promise<number> => {
    const result = await model.updateMany({ userId, isRead: false }, { $set: { isRead: true } }).exec();
    return result.modifiedCount;
  },
  deleteForUser: async (id: string, userId: string): Promise<boolean> => {
    const result = await model.deleteOne({ _id: id, userId }).exec();
    return result.deletedCount > 0;
  },
  deleteByActionUrls: async (actionUrls: string[]): Promise<number> => {
    const result = await model.deleteMany({ actionUrl: { $in: actionUrls } }).exec();
    return result.deletedCount;
  },
});
