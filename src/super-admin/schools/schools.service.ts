import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../common/utils/pagination.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSchoolDto: CreateSchoolDto, userId: string, ip?: string) {
    const {
      name,
      address,
      phone,
      email,
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPassword,
    } = createSchoolDto;

    // Check if school with email or code already exists
    const existingSchool = await this.prisma.school.findFirst({
      where: {
        OR: [{ email }, { code: this.generateSchoolCode(name) }],
      },
    });

    if (existingSchool) {
      throw new ConflictException(
        'School with this email or code already exists',
      );
    }

    // Check if admin email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      throw new ConflictException('Admin user with this email already exists');
    }

    // Generate unique school code
    let schoolCode = this.generateSchoolCode(name);
    let codeExists = await this.prisma.school.findUnique({
      where: { code: schoolCode },
    });

    // If code exists, append number
    let counter = 1;
    while (codeExists) {
      schoolCode = `${this.generateSchoolCode(name)}${counter}`;
      codeExists = await this.prisma.school.findUnique({
        where: { code: schoolCode },
      });
      counter++;
    }

    // Hash admin password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Use transaction to create school and admin user atomically
    return await this.prisma.$transaction(async (tx) => {
      // Create school
      const school = await tx.school.create({
        data: {
          name,
          code: schoolCode,
          address,
          phone,
          email,
        },
      });

      // Create school admin user
      await tx.user.create({
        data: {
          firstName: adminFirstName,
          lastName: adminLastName,
          email: adminEmail,
          password: hashedPassword,
          role: Role.SCHOOL_ADMIN,
          schoolId: school.id,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: `Created school: ${school.name} (${school.code})`,
          userId,
          ip: ip || null,
        },
      });

      return school;
    });
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.school.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              students: true,
              teachers: true,
            },
          },
        },
      }),
      this.prisma.school.count(),
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

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            students: true,
            teachers: true,
            parents: true,
            classes: true,
          },
        },
      },
    });

    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    return school;
  }

  async update(
    id: string,
    updateSchoolDto: UpdateSchoolDto,
    userId: string,
    ip?: string,
  ) {
    const school = await this.prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    // Check if email is being updated and if it conflicts
    if (updateSchoolDto.email && updateSchoolDto.email !== school.email) {
      const existingSchool = await this.prisma.school.findFirst({
        where: {
          email: updateSchoolDto.email,
          id: { not: id },
        },
      });

      if (existingSchool) {
        throw new ConflictException('School with this email already exists');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedSchool = await tx.school.update({
        where: { id },
        data: updateSchoolDto,
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: `Updated school: ${updatedSchool.name} (${updatedSchool.code})`,
          userId,
          ip: ip || null,
        },
      });

      return updatedSchool;
    });
  }

  async deactivate(id: string, userId: string, ip?: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Deactivate all users associated with the school
      await tx.user.updateMany({
        where: { schoolId: id },
        data: { isActive: false },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: `Deactivated school: ${school.name} (${school.code})`,
          userId,
          ip: ip || null,
        },
      });

      return {
        message: `School ${school.name} and all associated users have been deactivated`,
      };
    });
  }

  private generateSchoolCode(name: string): string {
    // Generate code from school name: "ABC School" -> "ABC001"
    const initials = name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3)
      .padEnd(3, 'X');
    const randomNum = Math.floor(Math.random() * 999)
      .toString()
      .padStart(3, '0');
    return `${initials}${randomNum}`;
  }
}
