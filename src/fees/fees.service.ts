import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { ListFeesDto } from './dto/list-fees.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role, FeeStatus } from '@prisma/client';

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine fee status based on due date and current status
   */
  private calculateFeeStatus(
    dueDate: Date,
    currentStatus: FeeStatus,
  ): FeeStatus {
    // If already paid, keep it as paid
    if (currentStatus === FeeStatus.PAID) {
      return FeeStatus.PAID;
    }

    // If due date has passed, mark as overdue
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    if (due < now) {
      return FeeStatus.OVERDUE;
    }

    return FeeStatus.PENDING;
  }

  /**
   * Assign fees to students
   * Only SCHOOL_ADMIN can assign fees
   */
  async create(
    createFeeDto: CreateFeeDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can assign fees');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { studentId, amount, dueDate } = createFeeDto;

    // Verify student exists and belongs to school
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    if (student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only assign fees to students in your school',
      );
    }

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Fee amount must be greater than 0');
    }

    // Validate due date is in the future
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    if (dueDateObj < now) {
      throw new BadRequestException('Due date must be in the future');
    }

    // Create fee with PENDING status initially
    const fee = await this.prisma.fee.create({
      data: {
        studentId,
        amount,
        dueDate: dueDateObj,
        status: FeeStatus.PENDING,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return fee;
  }

  /**
   * List fees with filters
   * - SCHOOL_ADMIN can view all fees in their school
   * - PARENT can view fees for their linked students
   */
  async findAll(
    listFeesDto: ListFeesDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, studentId, status } = listFeesDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'School admin must be associated with a school',
        );
      }

      // SCHOOL_ADMIN can view all fees in their school
      where.student = {
        schoolId: currentUser.schoolId,
      };

      if (studentId) {
        // Verify student belongs to school
        const student = await this.prisma.student.findUnique({
          where: { id: studentId },
        });

        if (!student || student.schoolId !== currentUser.schoolId) {
          throw new ForbiddenException(
            'Access denied. You can only view fees for students in your school',
          );
        }

        where.studentId = studentId;
      }
    } else if (currentUser.role === Role.PARENT) {
      // PARENT can view fees for their linked students
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.userId,
        },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      const linkedStudentIds = parent.students.map((s) => s.id);

      if (linkedStudentIds.length === 0) {
        return {
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      where.studentId = { in: linkedStudentIds };

      // If specific studentId is provided, verify it's linked
      if (studentId && !linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view fees for your linked students',
        );
      }

      if (studentId) {
        where.studentId = studentId;
      }
    } else {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and PARENT can view fees',
      );
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.fee.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.fee.count({ where }),
    ]);

    // Update status for overdue fees
    const updatedData = data.map((fee) => {
      const calculatedStatus = this.calculateFeeStatus(fee.dueDate, fee.status);
      return {
        ...fee,
        status: calculatedStatus,
      };
    });

    return {
      data: updatedData,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get fee by ID
   * - SCHOOL_ADMIN can view any fee in their school
   * - PARENT can view fees for their linked students
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const fee = await this.prisma.fee.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!fee) {
      throw new NotFoundException(`Fee with ID ${id} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (
        !currentUser.schoolId ||
        fee.student.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view fees for students in your school',
        );
      }
    } else if (currentUser.role === Role.PARENT) {
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.userId,
        },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      const linkedStudentIds = parent.students.map((s) => s.id);
      if (!linkedStudentIds.includes(fee.studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view fees for your linked students',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and PARENT can view fees',
      );
    }

    // Update status if overdue
    const calculatedStatus = this.calculateFeeStatus(fee.dueDate, fee.status);

    return {
      ...fee,
      status: calculatedStatus,
    };
  }

  /**
   * Fee history per student
   * - SCHOOL_ADMIN can view history for any student in their school
   * - PARENT can view history for their linked students
   */
  async getStudentFeeHistory(
    studentId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId || student.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view fee history for students in your school',
        );
      }
    } else if (currentUser.role === Role.PARENT) {
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.userId,
        },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      const linkedStudentIds = parent.students.map((s) => s.id);
      if (!linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view fee history for your linked students',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and PARENT can view fee history',
      );
    }

    // Get all fees for the student
    const fees = await this.prisma.fee.findMany({
      where: { studentId },
      orderBy: { dueDate: 'desc' },
    });

    // Update status for overdue fees
    const feesWithStatus = fees.map((fee) => {
      const calculatedStatus = this.calculateFeeStatus(fee.dueDate, fee.status);
      return {
        ...fee,
        status: calculatedStatus,
      };
    });

    // Calculate statistics
    const totalFees = feesWithStatus.length;
    const paidFees = feesWithStatus.filter(
      (f) => f.status === FeeStatus.PAID,
    ).length;
    const pendingFees = feesWithStatus.filter(
      (f) => f.status === FeeStatus.PENDING,
    ).length;
    const overdueFees = feesWithStatus.filter(
      (f) => f.status === FeeStatus.OVERDUE,
    ).length;

    const totalAmount = feesWithStatus.reduce((sum, f) => sum + f.amount, 0);
    const paidAmount = feesWithStatus
      .filter((f) => f.status === FeeStatus.PAID)
      .reduce((sum, f) => sum + f.amount, 0);
    const pendingAmount = feesWithStatus
      .filter((f) => f.status === FeeStatus.PENDING)
      .reduce((sum, f) => sum + f.amount, 0);
    const overdueAmount = feesWithStatus
      .filter((f) => f.status === FeeStatus.OVERDUE)
      .reduce((sum, f) => sum + f.amount, 0);

    return {
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        rollNumber: student.rollNumber,
        class: student.class.name,
      },
      fees: feesWithStatus,
      statistics: {
        totalFees,
        paidFees,
        pendingFees,
        overdueFees,
        totalAmount: totalAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        pendingAmount: pendingAmount.toFixed(2),
        overdueAmount: overdueAmount.toFixed(2),
      },
    };
  }

  /**
   * Update fee
   * Only SCHOOL_ADMIN can update fees
   */
  async update(
    id: string,
    updateFeeDto: UpdateFeeDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update fees');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const fee = await this.prisma.fee.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!fee) {
      throw new NotFoundException(`Fee with ID ${id} not found`);
    }

    // Verify fee belongs to school admin's school
    if (fee.student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update fees for students in your school',
      );
    }

    // Validate amount if being updated
    if (updateFeeDto.amount !== undefined && updateFeeDto.amount <= 0) {
      throw new BadRequestException('Fee amount must be greater than 0');
    }

    // Validate due date if being updated
    if (updateFeeDto.dueDate) {
      const dueDateObj = new Date(updateFeeDto.dueDate);
      const now = new Date();
      if (dueDateObj < now && updateFeeDto.status !== FeeStatus.PAID) {
        throw new BadRequestException('Due date must be in the future');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateFeeDto.amount !== undefined) {
      updateData.amount = updateFeeDto.amount;
    }

    if (updateFeeDto.dueDate) {
      updateData.dueDate = new Date(updateFeeDto.dueDate);
    }

    if (updateFeeDto.status !== undefined) {
      updateData.status = updateFeeDto.status;
    } else {
      // Auto-calculate status if not explicitly set
      const dueDate = updateFeeDto.dueDate
        ? new Date(updateFeeDto.dueDate)
        : fee.dueDate;
      const currentStatus = updateFeeDto.status || fee.status;
      updateData.status = this.calculateFeeStatus(dueDate, currentStatus);
    }

    const updatedFee = await this.prisma.fee.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return updatedFee;
  }

  /**
   * Mark fee as paid
   * Only SCHOOL_ADMIN can mark fees as paid
   */
  async markAsPaid(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can mark fees as paid');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const fee = await this.prisma.fee.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!fee) {
      throw new NotFoundException(`Fee with ID ${id} not found`);
    }

    // Verify fee belongs to school admin's school
    if (fee.student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only mark fees as paid for students in your school',
      );
    }

    if (fee.status === FeeStatus.PAID) {
      throw new BadRequestException('Fee is already marked as paid');
    }

    const updatedFee = await this.prisma.fee.update({
      where: { id },
      data: {
        status: FeeStatus.PAID,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return updatedFee;
  }

  /**
   * Delete fee
   * Only SCHOOL_ADMIN can delete fees
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete fees');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const fee = await this.prisma.fee.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!fee) {
      throw new NotFoundException(`Fee with ID ${id} not found`);
    }

    if (fee.student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete fees for students in your school',
      );
    }

    await this.prisma.fee.delete({
      where: { id },
    });

    return {
      message: 'Fee deleted successfully',
    };
  }

  /**
   * Get fee dashboard statistics for a school
   */
  async getDashboardStats(currentUser: {
    userId: string;
    role: Role;
    schoolId?: string;
  }) {
    if (!currentUser.schoolId) {
      throw new ForbiddenException('User must be associated with a school');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Total Fees Collected (All time for this school)
    const totalCollected = await this.prisma.fee.aggregate({
      where: {
        student: { schoolId: currentUser.schoolId },
        status: FeeStatus.PAID,
      },
      _sum: { amount: true },
    });

    // 2. Outstanding Balance (Pending + Overdue)
    const outstandingBalance = await this.prisma.fee.aggregate({
      where: {
        student: { schoolId: currentUser.schoolId },
        status: { in: [FeeStatus.PENDING, FeeStatus.OVERDUE] },
      },
      _sum: { amount: true },
    });

    // 3. Today's Collection
    const todayCollection = await this.prisma.fee.aggregate({
      where: {
        student: { schoolId: currentUser.schoolId },
        status: FeeStatus.PAID,
        updatedAt: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
    });

    // 5. Recent Transactions
    const recentTransactions = await this.prisma.fee.findMany({
      where: {
        student: { schoolId: currentUser.schoolId },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            class: {
              select: { name: true },
            },
          },
        },
      },
    });

    // 6. Monthly Overview (Simple last 6 months)
    const monthlyOverview = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);

      const nextMonth = new Date(d);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const monthSum = await this.prisma.fee.aggregate({
        where: {
          student: { schoolId: currentUser.schoolId },
          status: FeeStatus.PAID,
          updatedAt: { gte: d, lt: nextMonth },
        },
        _sum: { amount: true },
      });

      monthlyOverview.push({
        month: d.toLocaleString('default', { month: 'short' }),
        amount: monthSum._sum.amount || 0,
      });
    }

    return {
      statistics: {
        totalCollected: totalCollected._sum.amount || 0,
        outstandingBalance: outstandingBalance._sum.amount || 0,
        todayCollection: todayCollection._sum.amount || 0,
      },
      recentTransactions: (recentTransactions as any[]).map((t) => ({
        id: t.id,
        studentName: `${t.student.user.firstName} ${t.student.user.lastName}`,
        class: t.student.class?.name || 'N/A',
        amount: t.amount,
        status: t.status,
        date: t.updatedAt || t.createdAt,
      })),
      monthlyOverview,
    };
  }
}
