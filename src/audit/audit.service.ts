import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all audit logs
   * SUPER_ADMIN can view all logs
   * SCHOOL_ADMIN can view logs for their school
   * Read-only operation
   */
  async findAll(
    listAuditLogsDto: ListAuditLogsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN and SCHOOL_ADMIN can view audit logs',
      );
    }

    const {
      page = 1,
      limit = 10,
      userId,
      action,
      startDate,
      endDate,
    } = listAuditLogsDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // SUPER_ADMIN can view all logs
    // SCHOOL_ADMIN can only view logs for users in their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'School admin must be associated with a school',
        );
      }

      where.user = {
        schoolId: currentUser.schoolId,
      };
    }

    // Filter by user
    if (userId) {
      // Verify user belongs to school if SCHOOL_ADMIN
      if (currentUser.role === Role.SCHOOL_ADMIN) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user || user.schoolId !== currentUser.schoolId) {
          throw new ForbiddenException(
            'Access denied. You can only view audit logs for users in your school',
          );
        }
      }

      where.userId = userId;
    }

    // Filter by action
    if (action) {
      where.action = {
        contains: action,
        mode: 'insensitive',
      };
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              schoolId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
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

  /**
   * Get audit log by ID
   * SUPER_ADMIN can view any log
   * SCHOOL_ADMIN can view logs for users in their school
   * Read-only operation
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN and SCHOOL_ADMIN can view audit logs',
      );
    }

    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            schoolId: true,
          },
        },
      },
    });

    if (!auditLog) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }

    // SCHOOL_ADMIN can only view logs for users in their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (
        !currentUser.schoolId ||
        auditLog.user.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view audit logs for users in your school',
        );
      }
    }

    return auditLog;
  }

  /**
   * Get audit logs by user
   * SUPER_ADMIN can view logs for any user
   * SCHOOL_ADMIN can view logs for users in their school
   * Read-only operation
   */
  async findByUser(
    userId: string,
    listAuditLogsDto: ListAuditLogsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN and SCHOOL_ADMIN can view audit logs',
      );
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // SCHOOL_ADMIN can only view logs for users in their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId || user.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view audit logs for users in your school',
        );
      }
    }

    const {
      page = 1,
      limit = 10,
      action,
      startDate,
      endDate,
    } = listAuditLogsDto;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
    };

    // Filter by action
    if (action) {
      where.action = {
        contains: action,
        mode: 'insensitive',
      };
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              schoolId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
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

  /**
   * Get user activity summary
   * SUPER_ADMIN can view activity for any user
   * SCHOOL_ADMIN can view activity for users in their school
   * Read-only operation with aggregated statistics
   */
  async getUserActivitySummary(
    userId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN and SCHOOL_ADMIN can view user activity',
      );
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // SCHOOL_ADMIN can only view activity for users in their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId || user.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view activity for users in your school',
        );
      }
    }

    // Get all audit logs for the user
    const auditLogs = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate aggregated statistics
    const totalActions = auditLogs.length;

    // Group by action type
    const actionCounts = auditLogs.reduce(
      (acc, log) => {
        // Extract action type (CREATE, UPDATE, DELETE, etc.)
        const actionType = log.action.split('_')[0] || log.action;
        acc[actionType] = (acc[actionType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentActivity = auditLogs.filter(
      (log) => log.createdAt >= thirtyDaysAgo,
    ).length;

    // Get first and last activity dates
    const firstActivity =
      auditLogs.length > 0 ? auditLogs[auditLogs.length - 1].createdAt : null;
    const lastActivity = auditLogs.length > 0 ? auditLogs[0].createdAt : null;

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        school: user.school,
      },
      summary: {
        totalActions,
        recentActivity,
        firstActivity,
        lastActivity,
        actionBreakdown: actionCounts,
      },
    };
  }

  /**
   * Get activity statistics (aggregated)
   * SUPER_ADMIN can view all statistics
   * SCHOOL_ADMIN can view statistics for their school
   * Read-only operation
   */
  async getActivityStatistics(
    currentUser: { userId: string; role: Role; schoolId?: string },
    startDate?: string,
    endDate?: string,
  ) {
    if (
      currentUser.role !== Role.SUPER_ADMIN &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN and SCHOOL_ADMIN can view activity statistics',
      );
    }

    const where: any = {};

    // SCHOOL_ADMIN can only view statistics for their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'School admin must be associated with a school',
        );
      }

      where.user = {
        schoolId: currentUser.schoolId,
      };
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Get all audit logs
    const auditLogs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            role: true,
            schoolId: true,
          },
        },
      },
    });

    // Calculate aggregated statistics
    const totalActions = auditLogs.length;

    // Group by action type
    const actionBreakdown = auditLogs.reduce(
      (acc, log) => {
        const actionType = log.action.split('_')[0] || log.action;
        acc[actionType] = (acc[actionType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Group by user role
    const roleBreakdown = auditLogs.reduce(
      (acc, log) => {
        const role = log.user.role;
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Group by date (daily activity)
    const dailyActivity = auditLogs.reduce(
      (acc, log) => {
        const date = log.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get unique users count
    const uniqueUsers = new Set(auditLogs.map((log) => log.userId)).size;

    // Get top active users
    const userActivityCounts = auditLogs.reduce(
      (acc, log) => {
        acc[log.userId] = (acc[log.userId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const topActiveUsers = Object.entries(userActivityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, actionCount: count }));

    return {
      summary: {
        totalActions,
        uniqueUsers,
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
      breakdowns: {
        byAction: actionBreakdown,
        byRole: roleBreakdown,
      },
      dailyActivity: Object.entries(dailyActivity)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topActiveUsers,
    };
  }
}
