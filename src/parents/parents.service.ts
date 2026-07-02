import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { MapStudentsDto } from './dto/map-students.dto';
import { ListParentsDto } from './dto/list-parents.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create parent profile
   * Only SCHOOL_ADMIN can create parents
   */
  async create(
    createParentDto: CreateParentDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can create parents');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { email, password, firstName, lastName, phone, studentIds } =
      createParentDto;

    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate students if provided
    if (studentIds && studentIds.length > 0) {
      const students = await this.prisma.student.findMany({
        where: {
          id: { in: studentIds },
        },
      });

      if (students.length !== studentIds.length) {
        throw new NotFoundException('One or more students not found');
      }

      // Verify all students belong to the school
      const invalidStudents = students.filter(
        (s) => s.schoolId !== currentUser.schoolId,
      );

      if (invalidStudents.length > 0) {
        throw new ForbiddenException(
          'All students must belong to the same school',
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Use transaction to create user and parent atomically
    return await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: Role.PARENT,
          schoolId: currentUser.schoolId,
        },
      });

      // Create parent profile
      const parent = await tx.parent.create({
        data: {
          userId: user.id,
          schoolId: currentUser.schoolId,
          ...(studentIds &&
            studentIds.length > 0 && {
              students: {
                connect: studentIds.map((id) => ({ id })),
              },
            }),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
            },
          },
          students: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
              section: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return parent;
    });
  }

  /**
   * List parents with students
   * Only SCHOOL_ADMIN can list parents
   */
  async findAll(
    listParentsDto: ListParentsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can list parents');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { page = 1, limit = 10 } = listParentsDto;
    const skip = (page - 1) * limit;

    const where = {
      schoolId: currentUser.schoolId,
    };

    const [data, total] = await Promise.all([
      this.prisma.parent.findMany({
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
              phone: true,
              isActive: true,
            },
          },
          students: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
              section: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              students: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.parent.count({ where }),
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
   * Get parent by ID
   * - SCHOOL_ADMIN can view any parent from their school
   * - PARENT can only view their own profile with linked students
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            section: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        school: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${id} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId || parent.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only access parents from your school',
        );
      }
    } else if (currentUser.role === Role.PARENT) {
      // PARENT can only view their own profile
      if (parent.userId !== currentUser.userId) {
        throw new ForbiddenException(
          'Access denied. You can only view your own profile',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and PARENT can view parent profiles',
      );
    }

    return parent;
  }

  /**
   * Get linked students for parent
   * PARENT can view their linked students
   */
  async getLinkedStudents(currentUser: {
    userId: string;
    role: Role;
    schoolId?: string;
  }) {
    if (currentUser.role !== Role.PARENT) {
      throw new ForbiddenException('Only PARENT can view linked students');
    }

    const parent = await this.prisma.parent.findFirst({
      where: {
        userId: currentUser.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            section: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent profile not found');
    }

    return {
      parent: {
        id: parent.id,
        user: {
          id: parent.userId,
          firstName: parent.user.firstName,
          lastName: parent.user.lastName,
        },
      },
      students: parent.students,
    };
  }

  /**
   * Map students to parent
   * Only SCHOOL_ADMIN can map students
   */
  async mapStudents(
    id: string,
    mapStudentsDto: MapStudentsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN can map students to parents',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const parent = await this.prisma.parent.findUnique({
      where: { id },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${id} not found`);
    }

    // Verify the parent belongs to the school admin's school
    if (parent.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only map students to parents from your school',
      );
    }

    const { studentIds } = mapStudentsDto;

    // Validate students
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
      },
    });

    if (students.length !== studentIds.length) {
      throw new NotFoundException('One or more students not found');
    }

    // Verify all students belong to the school
    const invalidStudents = students.filter(
      (s) => s.schoolId !== currentUser.schoolId,
    );

    if (invalidStudents.length > 0) {
      throw new ForbiddenException(
        'All students must belong to the same school',
      );
    }

    // Map students to parent (replace existing mappings)
    const updatedParent = await this.prisma.parent.update({
      where: { id },
      data: {
        students: {
          set: studentIds.map((studentId) => ({ id: studentId })),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            section: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return updatedParent;
  }

  /**
   * Update parent
   * Only SCHOOL_ADMIN can update parents
   */
  async update(
    id: string,
    updateParentDto: UpdateParentDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update parents');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const parent = await this.prisma.parent.findUnique({
      where: { id },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${id} not found`);
    }

    // Verify the parent belongs to the school admin's school
    if (parent.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update parents from your school',
      );
    }

    // Update user info if provided
    if (
      updateParentDto.firstName ||
      updateParentDto.lastName ||
      updateParentDto.phone
    ) {
      await this.prisma.user.update({
        where: { id: parent.userId },
        data: {
          ...(updateParentDto.firstName && {
            firstName: updateParentDto.firstName,
          }),
          ...(updateParentDto.lastName && {
            lastName: updateParentDto.lastName,
          }),
          ...(updateParentDto.phone !== undefined && {
            phone: updateParentDto.phone,
          }),
        },
      });
    }

    const updatedParent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            section: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return updatedParent;
  }

  /**
   * Delete parent
   * Only SCHOOL_ADMIN can delete parents
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete parents');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const parent = await this.prisma.parent.findUnique({
      where: { id },
    });

    if (!parent) {
      throw new NotFoundException(`Parent with ID ${id} not found`);
    }

    // Verify the parent belongs to the school admin's school
    if (parent.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete parents from your school',
      );
    }

    // Use transaction to delete parent and user
    return await this.prisma.$transaction(async (tx) => {
      // Delete parent (this will disconnect from students automatically)
      await tx.parent.delete({
        where: { id },
      });

      // Delete user
      await tx.user.delete({
        where: { id: parent.userId },
      });

      return {
        message: `Parent has been deleted successfully`,
      };
    });
  }
}
