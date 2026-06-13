import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  iconKey?: string;
  tint?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private readonly model: Model<NotificationDocument>,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationDocument> {
    return this.model.create({
      ...input,
      userId: new Types.ObjectId(input.userId),
    });
  }

  async listForUser(userId: string) {
    return this.model
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async unreadCount(userId: string): Promise<number> {
    return this.model.countDocuments({
      userId: new Types.ObjectId(userId),
      readAt: { $exists: false },
    });
  }

  async markRead(id: string, userId: string): Promise<NotificationDocument> {
    const updated = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { readAt: new Date() },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Notification not found');
    return updated;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.model.updateMany(
      { userId: new Types.ObjectId(userId), readAt: { $exists: false } },
      { readAt: new Date() },
    );
  }

  async remove(id: string, userId: string): Promise<void> {
    const res = await this.model.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    if (res.deletedCount === 0) throw new NotFoundException('Notification not found');
  }

  async bulkRemove(ids: string[], userId: string): Promise<{ deleted: number }> {
    const res = await this.model.deleteMany({
      _id: { $in: ids.map((i) => new Types.ObjectId(i)) },
      userId: new Types.ObjectId(userId),
    });
    return { deleted: res.deletedCount ?? 0 };
  }
}
