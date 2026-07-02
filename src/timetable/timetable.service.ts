import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { CreateWeeklyTimetableDto } from './dto/create-weekly-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { ViewTimetableDto } from './dto/view-timetable.dto';
import { Role, DayOfWeek } from '@prisma/client';

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convert time string (HH:mm) to minutes for comparison
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if two time slots overlap
   */
  private timeSlotsOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const start1Min = this.timeToMinutes(start1);
    const end1Min = this.timeToMinutes(end1);
    const start2Min = this.timeToMinutes(start2);
    const end2Min = this.timeToMinutes(end2);

    return start1Min < end2Min && start2Min < end1Min;
  }

  /**
   * Detect teacher clash (same teacher at overlapping times on same day)
   */
  private async detectTeacherClash(
    teacherId: string,
    day: DayOfWeek,
    startTime: string,
    endTime: string,
    excludeTimetableId?: string,
  ): Promise<{ hasClash: boolean; conflictingEntry?: any }> {
    const where: any = {
      teacherId,
      day,
    };

    if (excludeTimetableId) {
      where.id = { not: excludeTimetableId };
    }

    const existingEntries = await this.prisma.timetable.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    for (const entry of existingEntries) {
      if (
        this.timeSlotsOverlap(
          startTime,
          endTime,
          entry.startTime,
          entry.endTime,
        )
      ) {
        return {
          hasClash: true,
          conflictingEntry: entry,
        };
      }
    }

    return { hasClash: false };
  }

  /**
   * Create single timetable entry
   * Only SCHOOL_ADMIN can create
   */
  async create(
    createTimetableDto: CreateTimetableDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can create timetable');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { classId, day, startTime, endTime, subjectId, teacherId, room } =
      createTimetableDto;

    // Validate time range
    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new BadRequestException('startTime must be before endTime');
    }

    // Verify class exists and belongs to school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only create timetable for classes in your school',
      );
    }

    // Verify subject exists and belongs to school
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    if (subject.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('Subject must belong to the same school');
    }

    // Verify teacher exists and belongs to school
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
    }

    if (teacher.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('Teacher must belong to the same school');
    }

    // Verify teacher is assigned to the subject
    if (subject.teacherId !== teacherId) {
      throw new BadRequestException('Teacher is not assigned to this subject');
    }

    // Detect teacher clash
    const clashCheck = await this.detectTeacherClash(
      teacherId,
      day,
      startTime,
      endTime,
    );

    if (clashCheck.hasClash) {
      throw new ConflictException(
        `Teacher clash detected! Teacher is already assigned to ${clashCheck.conflictingEntry.subject.name} in ${clashCheck.conflictingEntry.class.name} at ${clashCheck.conflictingEntry.startTime}-${clashCheck.conflictingEntry.endTime} on ${day}`,
      );
    }

    // Create timetable entry
    const timetable = await this.prisma.timetable.create({
      data: {
        classId,
        day,
        startTime,
        endTime,
        subjectId,
        teacherId,
        room: room || null,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return timetable;
  }

  /**
   * Create weekly timetable (bulk)
   * Only SCHOOL_ADMIN can create
   */
  async createWeekly(
    createWeeklyTimetableDto: CreateWeeklyTimetableDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can create timetable');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { classId, entries } = createWeeklyTimetableDto;

    // Verify class exists and belongs to school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only create timetable for classes in your school',
      );
    }

    // Validate all entries have the same classId
    const invalidEntries = entries.filter((e) => e.classId !== classId);
    if (invalidEntries.length > 0) {
      throw new BadRequestException(
        'All entries must belong to the same class',
      );
    }

    // Validate and check for clashes
    const clashErrors: string[] = [];

    for (const entry of entries) {
      // Validate time range
      if (
        this.timeToMinutes(entry.startTime) >= this.timeToMinutes(entry.endTime)
      ) {
        clashErrors.push(
          `Invalid time range for ${entry.day}: startTime must be before endTime`,
        );
        continue;
      }

      // Verify subject and teacher
      const subject = await this.prisma.subject.findUnique({
        where: { id: entry.subjectId },
      });

      if (!subject || subject.schoolId !== currentUser.schoolId) {
        clashErrors.push(`Subject ${entry.subjectId} not found or invalid`);
        continue;
      }

      const teacher = await this.prisma.teacher.findUnique({
        where: { id: entry.teacherId },
      });

      if (!teacher || teacher.schoolId !== currentUser.schoolId) {
        clashErrors.push(`Teacher ${entry.teacherId} not found or invalid`);
        continue;
      }

      if (subject.teacherId !== entry.teacherId) {
        clashErrors.push(
          `Teacher is not assigned to subject ${subject.name} on ${entry.day}`,
        );
        continue;
      }

      // Check for teacher clash
      const clashCheck = await this.detectTeacherClash(
        entry.teacherId,
        entry.day,
        entry.startTime,
        entry.endTime,
      );

      if (clashCheck.hasClash) {
        clashErrors.push(
          `Teacher clash on ${entry.day} at ${entry.startTime}-${entry.endTime}: Teacher is already assigned to ${clashCheck.conflictingEntry.subject.name} in ${clashCheck.conflictingEntry.class.name}`,
        );
      }
    }

    if (clashErrors.length > 0) {
      throw new ConflictException({
        message: 'Validation errors and clashes detected',
        errors: clashErrors,
      });
    }

    // Create all entries in transaction
    return await this.prisma.$transaction(async (tx) => {
      const createdEntries = await Promise.all(
        entries.map((entry) =>
          tx.timetable.create({
            data: {
              classId: entry.classId,
              day: entry.day,
              startTime: entry.startTime,
              endTime: entry.endTime,
              subjectId: entry.subjectId,
              teacherId: entry.teacherId,
              room: entry.room || null,
            },
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
              subject: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              teacher: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          }),
        ),
      );

      return {
        message: `Weekly timetable created with ${createdEntries.length} entries`,
        class: {
          id: classEntity.id,
          name: classEntity.name,
        },
        entries: createdEntries,
      };
    });
  }

  /**
   * Get weekly timetable per class
   * Read-only for all authenticated users
   */
  async findByClass(
    classId: string,
    viewTimetableDto: ViewTimetableDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    // Verify class exists
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // RBAC: SCHOOL_ADMIN can view any class in their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (
        !currentUser.schoolId ||
        classEntity.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view timetable for classes in your school',
        );
      }
    }
    // Other roles (TEACHER, STUDENT, PARENT) can view if they belong to the school
    else if (
      currentUser.schoolId &&
      classEntity.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException(
        'Access denied. You can only view timetable for classes in your school',
      );
    }

    const where: any = {
      classId,
    };

    if (viewTimetableDto.day) {
      where.day = viewTimetableDto.day;
    }

    const timetables = await this.prisma.timetable.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });

    // Group by day for better structure
    const groupedByDay: Record<string, any[]> = {};
    const days = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
      DayOfWeek.SUNDAY,
    ];

    days.forEach((day) => {
      groupedByDay[day] = timetables.filter((t) => t.day === day);
    });

    return {
      class: {
        id: classEntity.id,
        name: classEntity.name,
      },
      timetable: groupedByDay,
      totalEntries: timetables.length,
    };
  }

  /**
   * Get all timetables
   * Read-only for all authenticated users
   */
  async findAll(
    viewTimetableDto: ViewTimetableDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const where: any = {};

    // SCHOOL_ADMIN can view all timetables in their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'School admin must be associated with a school',
        );
      }

      where.class = {
        schoolId: currentUser.schoolId,
      };
    } else if (currentUser.schoolId) {
      // Other roles can view timetables for their school
      where.class = {
        schoolId: currentUser.schoolId,
      };
    }

    if (viewTimetableDto.classId) {
      where.classId = viewTimetableDto.classId;
    }

    if (viewTimetableDto.day) {
      where.day = viewTimetableDto.day;
    }

    const timetables = await this.prisma.timetable.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [{ classId: 'asc' }, { day: 'asc' }, { startTime: 'asc' }],
    });

    return timetables;
  }

  /**
   * Get current teacher's timetable
   */
  async getMyTimetable(currentUser: {
    userId: string;
    role: Role;
    schoolId?: string;
  }) {
    if (currentUser.role !== Role.TEACHER) {
      throw new ForbiddenException(
        'Only teachers can access their own timetable',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    // Find teacher profile
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        userId: currentUser.userId,
        schoolId: currentUser.schoolId,
      },
    });

    if (!teacher) {
      return {
        teacher: {
          id: null,
          name:
            `${currentUser['firstName'] || ''} ${currentUser['lastName'] || ''}`.trim() ||
            'Teacher',
        },
        timetable: {},
        totalEntries: 0,
        message: 'Teacher profile not found. Please contact administration.',
      };
    }

    const timetables = await this.prisma.timetable.findMany({
      where: {
        teacherId: teacher.id,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });

    // Group by day for better structure
    const groupedByDay: Record<string, any[]> = {};
    const days = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
      DayOfWeek.SUNDAY,
    ];

    days.forEach((day) => {
      groupedByDay[day] = timetables.filter((t) => t.day === day);
    });

    return {
      teacher: {
        id: teacher.id,
        name:
          `${currentUser['firstName'] || ''} ${currentUser['lastName'] || ''}`.trim() ||
          'Teacher',
      },
      timetable: groupedByDay,
      totalEntries: timetables.length,
    };
  }

  /**
   * Get timetable by ID
   * Read-only for all authenticated users
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const timetable = await this.prisma.timetable.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${id} not found`);
    }

    // RBAC: Verify access based on school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (
        !currentUser.schoolId ||
        timetable.class.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view timetable for classes in your school',
        );
      }
    } else if (
      currentUser.schoolId &&
      timetable.class.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException(
        'Access denied. You can only view timetable for classes in your school',
      );
    }

    return timetable;
  }

  /**
   * Update timetable
   * Only SCHOOL_ADMIN can update
   */
  async update(
    id: string,
    updateTimetableDto: UpdateTimetableDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update timetable');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const timetable = await this.prisma.timetable.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${id} not found`);
    }

    // Verify timetable belongs to school admin's school
    if (timetable.class.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update timetable for classes in your school',
      );
    }

    // Validate time range if times are being updated
    if (updateTimetableDto.startTime || updateTimetableDto.endTime) {
      const startTime = updateTimetableDto.startTime || timetable.startTime;
      const endTime = updateTimetableDto.endTime || timetable.endTime;

      if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
        throw new BadRequestException('startTime must be before endTime');
      }
    }

    // If teacher or time is being updated, check for clashes
    if (
      updateTimetableDto.teacherId ||
      updateTimetableDto.startTime ||
      updateTimetableDto.endTime ||
      updateTimetableDto.day
    ) {
      const teacherId = updateTimetableDto.teacherId || timetable.teacherId;
      const day = updateTimetableDto.day || timetable.day;
      const startTime = updateTimetableDto.startTime || timetable.startTime;
      const endTime = updateTimetableDto.endTime || timetable.endTime;

      const clashCheck = await this.detectTeacherClash(
        teacherId,
        day,
        startTime,
        endTime,
        id, // Exclude current entry
      );

      if (clashCheck.hasClash) {
        throw new ConflictException(
          `Teacher clash detected! Teacher is already assigned to ${clashCheck.conflictingEntry.subject.name} in ${clashCheck.conflictingEntry.class.name} at ${clashCheck.conflictingEntry.startTime}-${clashCheck.conflictingEntry.endTime} on ${day}`,
        );
      }
    }

    // Validate subject and teacher if being updated
    if (updateTimetableDto.subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: updateTimetableDto.subjectId },
      });

      if (!subject || subject.schoolId !== currentUser.schoolId) {
        throw new NotFoundException('Subject not found or invalid');
      }

      const teacherId = updateTimetableDto.teacherId || timetable.teacherId;
      if (subject.teacherId !== teacherId) {
        throw new BadRequestException(
          'Teacher is not assigned to this subject',
        );
      }
    }

    if (updateTimetableDto.teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: updateTimetableDto.teacherId },
      });

      if (!teacher || teacher.schoolId !== currentUser.schoolId) {
        throw new NotFoundException('Teacher not found or invalid');
      }
    }

    const updatedTimetable = await this.prisma.timetable.update({
      where: { id },
      data: updateTimetableDto,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return updatedTimetable;
  }

  /**
   * Delete timetable
   * Only SCHOOL_ADMIN can delete
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete timetable');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const timetable = await this.prisma.timetable.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${id} not found`);
    }

    // Verify timetable belongs to school admin's school
    if (timetable.class.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete timetable for classes in your school',
      );
    }

    await this.prisma.timetable.delete({
      where: { id },
    });

    return {
      message: 'Timetable entry deleted successfully',
    };
  }
}
