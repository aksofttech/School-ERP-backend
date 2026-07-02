import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a notification for a single user
   */
  async create(data: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    schoolId?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || 'ANNOUNCEMENT',
        schoolId: data.schoolId,
      },
    });
  }

  /**
   * Find all unread notifications for a user
   */
  async findAllUnread(userId: string) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
  }

  /**
   * Get all notifications for a user (paginated)
   */
  async findAll(userId: string, limit: number = 20) {
    return this.prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: {
        id,
        userId, // Security: ensure it belongs to the user
      },
      data: {
        isRead: true,
      },
    });
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }
}
