import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import * as bcrypt from 'bcrypt';
import { Role, Gender } from '@prisma/client';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create student linked to User
   * Only SCHOOL_ADMIN can create students
   */
  async create(
    createStudentDto: CreateStudentDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can create students');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      rollNumber,
      gender,
      dob,
      classId,
      sectionId,
      parentId,
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone,
      parentFatherName,
      parentMotherName,
      parentAddress,
      parentSecondaryPhone,
    } = createStudentDto;

    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Verify class exists and belongs to the school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only create students in classes from your school',
      );
    }

    // Verify section exists and belongs to the class
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      throw new NotFoundException(`Section with ID ${sectionId} not found`);
    }

    if (section.classId !== classId) {
      throw new BadRequestException(
        'Section does not belong to the specified class',
      );
    }

    if (section.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only create students in sections from your school',
      );
    }

    // Check for duplicate roll number in the same class
    const existingStudent = await this.prisma.student.findFirst({
      where: {
        rollNumber,
        classId,
      },
    });

    if (existingStudent) {
      throw new ConflictException(
        `Student with roll number "${rollNumber}" already exists in this class`,
      );
    }

    // Verify parent if provided
    if (parentId) {
      const parent = await this.prisma.parent.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        throw new NotFoundException(`Parent with ID ${parentId} not found`);
      }

      if (parent.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException('Parent must belong to the same school');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`[StudentsService] Creating student: ${firstName} ${lastName} (${email}) in school ${currentUser.schoolId}`);

    // Use transaction to create user and student atomically
    return await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: Role.STUDENT,
          schoolId: currentUser.schoolId,
        },
      });

      // Create student
      const student = await tx.student.create({
        data: {
          userId: user.id,
          rollNumber,
          gender,
          dob: new Date(dob),
          schoolId: currentUser.schoolId,
          classId,
          sectionId,
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
          parents: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Link or Create Parent
      let finalParentId = parentId;

      if (
        !finalParentId &&
        (parentEmail || parentFatherName || parentMotherName)
      ) {
        // 1. Check if a user with this email already exists
        let parentUser = parentEmail
          ? await tx.user.findUnique({ where: { email: parentEmail } })
          : null;

        if (parentUser) {
          // 2. Existing user found, check if they have a Parent record
          let parentRecord = await tx.parent.findUnique({
            where: { userId: parentUser.id },
          });

          if (!parentRecord) {
            // Create Parent record for existing user
            parentRecord = await tx.parent.create({
              data: {
                userId: parentUser.id,
                schoolId: currentUser.schoolId,
                fatherName: parentFatherName,
                motherName: parentMotherName,
                address: parentAddress,
                secondaryPhone: parentSecondaryPhone,
              },
            });
          }
          finalParentId = parentRecord.id;
        } else {
          // 3. No existing user, create new User and Parent
          const firstName =
            parentFirstName ||
            parentFatherName?.split(' ')[0] ||
            parentMotherName?.split(' ')[0] ||
            'Parent';
          const lastName =
            parentLastName ||
            parentFatherName?.split(' ').slice(1).join(' ') ||
            parentMotherName?.split(' ').slice(1).join(' ') ||
            'User';

          const parentHashedPassword = await bcrypt.hash('parent@123', 10);

          parentUser = await tx.user.create({
            data: {
              email:
                parentEmail ||
                `parent_${Date.now()}_${Math.floor(Math.random() * 1000)}@edu.com`,
              password: parentHashedPassword,
              firstName,
              lastName,
              phone: parentPhone,
              role: Role.PARENT,
              schoolId: currentUser.schoolId,
            },
          });

          const newParent = await tx.parent.create({
            data: {
              userId: parentUser.id,
              schoolId: currentUser.schoolId,
              fatherName: parentFatherName,
              motherName: parentMotherName,
              address: parentAddress,
              secondaryPhone: parentSecondaryPhone,
            },
          });

          finalParentId = newParent.id;
        }
      }

      // Link parent if we have one (either provided, found, or just created)
      if (finalParentId) {
        await tx.student.update({
          where: { id: student.id },
          data: {
            parents: {
              connect: { id: finalParentId },
            },
          },
        });
      }

      // Fetch refined student with parent
      return await tx.student.findUnique({
        where: { id: student.id },
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
          parents: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Get logged-in student's own profile
   * Used by Student Dashboard
   */
  async findMe(currentUser: { userId: string; role: Role }) {
    if (currentUser.role !== Role.STUDENT) {
      throw new ForbiddenException('Only students can access this resource');
    }

    const student = await this.prisma.student.findUnique({
      where: { userId: currentUser.userId },
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
        class: {
          select: { id: true, name: true },
        },
        section: {
          select: { id: true, name: true },
        },
        school: {
          select: { id: true, name: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return student;
  }

  /**
   * List students
   * - SCHOOL_ADMIN can see all students in their school
   * - Can filter by classId and sectionId
   */
  async findAll(
    listStudentsDto: ListStudentsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    // Relaxed Check: School Admin, Teacher, and Super Admin can list
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Insufficient permissions to list students');
    }

    if (!currentUser.schoolId && currentUser.role !== Role.SUPER_ADMIN) {
      console.warn(
        `[StudentsService] Sub-optimal security state: User ${currentUser.userId} listing students without schoolId association.`,
      );
    }

    const {
      page = 1,
      limit = 10,
      classId,
      sectionId,
      search,
      sortBy,
      sortOrder = 'asc',
    } = listStudentsDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    // If not Super Admin, restrict to school
    if (currentUser.role !== Role.SUPER_ADMIN) {
      where.schoolId = currentUser.schoolId;
    }

    if (classId) {
      // Verify class belongs to school
      const classEntity = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      if (classEntity.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only access classes from your school',
        );
      }

      where.classId = classId;
    }

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (sectionId) {
      // Verify section belongs to school
      const section = await this.prisma.section.findUnique({
        where: { id: sectionId },
      });

      if (!section) {
        throw new NotFoundException(`Section with ID ${sectionId} not found`);
      }

      if (section.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only access sections from your school',
        );
      }

      where.sectionId = sectionId;
    }

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          rollNumber: true,
          gender: true,
          dob: true,
          userId: true,
          classId: true,
          sectionId: true,
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
          parents: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy:
          sortBy === 'class'
            ? { class: { name: sortOrder } }
            : sortBy === 'section'
              ? { section: { name: sortOrder } }
              : sortBy === 'firstName'
                ? { user: { firstName: sortOrder } }
                : { rollNumber: sortOrder },
      }),
      this.prisma.student.count({ where }),
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
   * List students by class
   */
  async findByClass(
    classId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.TEACHER
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to view students by class',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    // Verify class exists and belongs to the school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only access classes from your school',
      );
    }

    const students = await this.prisma.student.findMany({
      where: {
        classId,
        schoolId: currentUser.schoolId,
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
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        parents: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { rollNumber: 'asc' },
    });

    return {
      class: {
        id: classEntity.id,
        name: classEntity.name,
      },
      students,
    };
  }

  /**
   * Get student by ID
   * - SCHOOL_ADMIN can view any student from their school
   * - STUDENT can only view their own profile
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const student = await this.prisma.student.findUnique({
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
        parents: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
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
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId || student.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only access students from your school',
        );
      }
    } else if (currentUser.role === Role.STUDENT) {
      // STUDENT can only view their own profile
      if (student.userId !== currentUser.userId) {
        throw new ForbiddenException(
          'Access denied. You can only view your own profile',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and STUDENT can view student profiles',
      );
    }

    return student;
  }

  /**
   * Get student documents
   * Only SCHOOL_ADMIN, TEACHER and STUDENT can view documents
   */
  async getDocuments(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, userId: true, schoolId: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // RBAC checks
    if (
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.TEACHER
    ) {
      if (!currentUser.schoolId || student.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view documents of students from your school',
        );
      }
    } else if (currentUser.role === Role.STUDENT) {
      if (student.userId !== currentUser.userId) {
        throw new ForbiddenException(
          'Access denied. You can only view your own documents',
        );
      }
    } else {
      throw new ForbiddenException(
        'Insufficient permissions to view student documents',
      );
    }

    return this.prisma.document.findMany({
      where: { studentId: id },
      include: {
        uploadedByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update student
   * Only SCHOOL_ADMIN can update students
   */
  async update(
    id: string,
    updateStudentDto: UpdateStudentDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update students');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const student = await this.prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // Verify the student belongs to the school admin's school
    if (student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update students from your school',
      );
    }

    // If class or section is being updated, validate them
    if (updateStudentDto.classId || updateStudentDto.sectionId) {
      const classId = updateStudentDto.classId || student.classId;
      const sectionId = updateStudentDto.sectionId || student.sectionId;

      // Verify class exists and belongs to school
      const classEntity = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      if (classEntity.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException('Class must belong to the same school');
      }

      // Verify section exists and belongs to class
      if (updateStudentDto.sectionId) {
        const section = await this.prisma.section.findUnique({
          where: { id: sectionId },
        });

        if (!section) {
          throw new NotFoundException(`Section with ID ${sectionId} not found`);
        }

        if (section.classId !== classId) {
          throw new BadRequestException(
            'Section does not belong to the specified class',
          );
        }
      }
    }

    // Update student
    const updateData: any = {};

    if (updateStudentDto.gender) {
      updateData.gender = updateStudentDto.gender;
    }

    if (updateStudentDto.dob) {
      updateData.dob = new Date(updateStudentDto.dob);
    }

    if (updateStudentDto.classId) {
      updateData.classId = updateStudentDto.classId;
    }

    if (updateStudentDto.sectionId) {
      updateData.sectionId = updateStudentDto.sectionId;
    }

    // Update user info if provided
    if (
      updateStudentDto.firstName ||
      updateStudentDto.lastName ||
      updateStudentDto.phone
    ) {
      await this.prisma.user.update({
        where: { id: student.userId },
        data: {
          ...(updateStudentDto.firstName && {
            firstName: updateStudentDto.firstName,
          }),
          ...(updateStudentDto.lastName && {
            lastName: updateStudentDto.lastName,
          }),
          ...(updateStudentDto.phone !== undefined && {
            phone: updateStudentDto.phone,
          }),
        },
      });
    }

    const updatedStudent = await this.prisma.student.update({
      where: { id },
      data: updateData,
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
        parents: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return updatedStudent;
  }

  /**
   * Delete student
   * Only SCHOOL_ADMIN can delete students
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete students');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const student = await this.prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // Verify the student belongs to the school admin's school
    if (student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete students from your school',
      );
    }

    // Use transaction to delete student and user
    return await this.prisma.$transaction(async (tx) => {
      // 1. Delete dependent student records
      await tx.attendance.deleteMany({ where: { studentId: id } });
      await tx.fee.deleteMany({ where: { studentId: id } });
      await tx.examResult.deleteMany({ where: { studentId: id } });
      await tx.document.deleteMany({ where: { studentId: id } });
      
      // 2. Delete dependent user records
      await tx.notification.deleteMany({ where: { userId: student.userId } });
      await tx.auditLog.deleteMany({ where: { userId: student.userId } });

      // 3. Delete student record
      await tx.student.delete({
        where: { id },
      });

      // 4. Delete user record
      await tx.user.delete({
        where: { id: student.userId },
      });

      return {
        message: `Student has been deleted successfully along with all associated records`,
      };
    });
  }

  /**
   * Promote students to a new class
   */
  async promote(
    promoteStudentsDto: any, // Using any temporarily to avoid import issues if dto not picked up immediately, but ideally import it
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can promote students');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { studentIds, targetClassId } = promoteStudentsDto;

    // Verify target class exists and belongs to school
    const targetClass = await this.prisma.class.findUnique({
      where: { id: targetClassId },
    });

    if (!targetClass) {
      throw new NotFoundException(
        `Target class with ID ${targetClassId} not found`,
      );
    }

    if (targetClass.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Target class must belong to the same school',
      );
    }

    // Update students
    // We use updateMany for efficiency
    const result = await this.prisma.student.updateMany({
      where: {
        id: { in: studentIds },
        schoolId: currentUser.schoolId, // Security check
      },
      data: {
        classId: targetClassId,
        sectionId: null, // Reset section on promotion as sections might differ
      },
    });

    return {
      message: `Successfully promoted ${result.count} students`,
      count: result.count,
    };
  }
}
