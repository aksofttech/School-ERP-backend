import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { ListNoticesDto } from './dto/list-notices.dto';
import { PaginatedResult } from '../../common/utils/pagination.dto';
import { Role, NoticeAudience, NoticeStatus } from '@prisma/client';

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Helper to verify if user has permission to manage notices
   */
  private checkPermission(currentUser: { role: Role }) {
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.TEACHER
    ) {
      throw new ForbiddenException(
        'Only Admin and Teachers can manage announcements',
      );
    }
  }

  /**
   * Create notice
   */
  async create(
    createNoticeDto: CreateNoticeDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    this.checkPermission(currentUser);

    if (!currentUser.schoolId) {
      throw new ForbiddenException('User must be associated with a school');
    }

    const {
      title,
      content,
      audience,
      status,
      classId,
      publishDate,
      attachments,
    } = createNoticeDto;

    // If classId is provided, verify it belongs to school
    if (classId) {
      const classEntity = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      if (classEntity.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only create notices for classes in your school',
        );
      }
    }

    // Create notice
    const notice = await this.prisma.notice.create({
      data: {
        title,
        content,
        audience: (audience as any) || NoticeAudience.ALL,
        status: (status as any) || NoticeStatus.PUBLISHED,
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        attachments: attachments || null,
        schoolId: currentUser.schoolId,
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // If published, trigger notifications
    if (notice.status === NoticeStatus.PUBLISHED) {
      await this.triggerNotifications(notice);
    }

    return notice;
  }

  /**
   * Helper to broadcast notifications based on audience
   */
  private async triggerNotifications(notice: any) {
    const { title, audience, schoolId } = notice;

    // Find users to notify
    const where: any = { schoolId, isActive: true };

    if (audience === NoticeAudience.STUDENTS) {
      where.role = Role.STUDENT;
    } else if (audience === NoticeAudience.TEACHERS) {
      where.role = Role.TEACHER;
    } else if (audience === NoticeAudience.PARENTS) {
      where.role = Role.PARENT;
    }

    const usersToNotify = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    // Create notifications in bulk (non-blocking for better perf)
    const notificationPromises = usersToNotify.map((user) =>
      this.notificationsService.create({
        userId: user.id,
        title: `New Announcement: ${title}`,
        message: `A new announcement has been posted for ${audience.toLowerCase()}.`,
        type: 'ANNOUNCEMENT',
        schoolId: schoolId,
      }),
    );

    await Promise.allSettled(notificationPromises);
  }

  /**
   * List notices
   */
  async findAll(
    listNoticesDto: ListNoticesDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, audience } = listNoticesDto;
    const skip = (page - 1) * limit;

    const where: any = {
      schoolId: currentUser.schoolId,
    };

    if (currentUser.role === Role.STUDENT) {
      where.audience = { in: [NoticeAudience.ALL, NoticeAudience.STUDENTS] };
      where.status = NoticeStatus.PUBLISHED;
    } else if (currentUser.role === Role.TEACHER) {
      // Teachers see what's for them OR ALL
      where.audience = { in: [NoticeAudience.ALL, NoticeAudience.TEACHERS] };
      // Admin/Teachers usually see all statuses in dashboard?
      // Actually this findAll is used by dashboard too.
      // Let's refine: if requester is admin/teacher, show all for that school.
    } else if (currentUser.role === Role.PARENT) {
      where.audience = { in: [NoticeAudience.ALL, NoticeAudience.PARENTS] };
      where.status = NoticeStatus.PUBLISHED;
    }

    // Refinement for admin/school_admin: they see everything
    if (
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.SUPER_ADMIN
    ) {
      delete where.audience;
      delete where.status;
      where.schoolId = currentUser.schoolId;
    }

    const [data, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          school: { select: { name: true } },
        },
      }),
      this.prisma.notice.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const notice = await this.prisma.notice.findUnique({
      where: { id },
    });

    if (!notice) throw new NotFoundException(`Notice with ID ${id} not found`);

    if (notice.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('Access denied.');
    }

    return notice;
  }

  async update(
    id: string,
    updateNoticeDto: UpdateNoticeDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    this.checkPermission(currentUser);

    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');

    if (notice.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('Access denied.');
    }

    const updatedNotice = await this.prisma.notice.update({
      where: { id },
      data: {
        ...updateNoticeDto,
        publishDate: updateNoticeDto.publishDate
          ? new Date(updateNoticeDto.publishDate)
          : undefined,
      },
    });

    // If status changed to PUBLISHED, trigger notifications
    if (
      notice.status !== NoticeStatus.PUBLISHED &&
      updatedNotice.status === NoticeStatus.PUBLISHED
    ) {
      await this.triggerNotifications(updatedNotice);
    }

    return updatedNotice;
  }

  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    this.checkPermission(currentUser);

    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');

    if (notice.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('Access denied.');
    }

    await this.prisma.notice.delete({ where: { id } });
    return { message: 'Notice deleted successfully' };
  }
}
