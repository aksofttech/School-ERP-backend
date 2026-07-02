import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List users with RBAC:
   * - SUPER_ADMIN can see all users
   * - SCHOOL_ADMIN can only see users from their school
   */
  async findAll(
    listUsersDto: ListUsersDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, role, schoolId } = listUsersDto;
    const skip = (page - 1) * limit;

    // Build where clause based on RBAC
    const where: any = {};

    // SCHOOL_ADMIN can only see users from their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId) {
        console.warn(
          `[UsersService] Sub-optimal security state: User ${currentUser.userId} listing users without schoolId association.`,
        );
      }
      where.schoolId = currentUser.schoolId;
    }

    // SUPER_ADMIN can filter by schoolId if provided
    if (currentUser.role === Role.SUPER_ADMIN && schoolId) {
      where.schoolId = schoolId;
    }

    // Filter by role if provided
    if (role) {
      where.role = role;
    }

    // Add search filter if provided
    if (listUsersDto.search) {
      const search = listUsersDto.search;
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          firstName: true,
          lastName: true,
          phone: true,
          schoolId: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
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
   * Get user by ID with RBAC
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        phone: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
        school: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // SCHOOL_ADMIN can only access users from their school
    if (
      currentUser.role === Role.SCHOOL_ADMIN &&
      user.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException(
        'Access denied. You can only access users from your school',
      );
    }

    return user;
  }

  /**
   * Create user with RBAC
   * - SUPER_ADMIN can create users for any school
   * - SCHOOL_ADMIN can only create users for their school
   */
  async create(
    createUserDto: CreateUserDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const { email, password, firstName, lastName, role, phone, schoolId } =
      createUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // RBAC: SCHOOL_ADMIN can only create users for their school
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'School admin must be associated with a school',
        );
      }
      if (schoolId && schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'You can only create users for your own school',
        );
      }
      if (!schoolId) {
        // Auto-assign to school admin's school
        createUserDto.schoolId = currentUser.schoolId;
      }
    }

    // SUPER_ADMIN cannot create another SUPER_ADMIN
    if (role === Role.SUPER_ADMIN && currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only SUPER_ADMIN can create SUPER_ADMIN users',
      );
    }

    // Validate role restrictions
    if (role === Role.SUPER_ADMIN && schoolId) {
      throw new BadRequestException(
        'SUPER_ADMIN cannot be associated with a school',
      );
    }

    // Non-SUPER_ADMIN roles must have a school
    if (role !== Role.SUPER_ADMIN && !createUserDto.schoolId) {
      throw new BadRequestException(
        `${role} role must be associated with a school`,
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role,
        schoolId: createUserDto.schoolId || null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        phone: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
        school: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return user;
  }

  /**
   * Update user with RBAC
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // SCHOOL_ADMIN can only update users from their school
    if (
      currentUser.role === Role.SCHOOL_ADMIN &&
      user.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException(
        'Access denied. You can only update users from your school',
      );
    }

    // Prevent changing SUPER_ADMIN role
    if (user.role === Role.SUPER_ADMIN && updateUserDto.role) {
      throw new BadRequestException('Cannot change SUPER_ADMIN role');
    }

    // Prevent creating SUPER_ADMIN
    if (updateUserDto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only existing SUPER_ADMIN can be SUPER_ADMIN',
      );
    }

    // SCHOOL_ADMIN cannot change schoolId
    if (
      currentUser.role === Role.SCHOOL_ADMIN &&
      updateUserDto.schoolId &&
      updateUserDto.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException('You cannot change the school of a user');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        phone: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
        school: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return updatedUser;
  }

  /**
   * Activate user with RBAC
   */
  async activate(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // SCHOOL_ADMIN can only activate users from their school
    if (
      currentUser.role === Role.SCHOOL_ADMIN &&
      user.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException(
        'Access denied. You can only activate users from your school',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        phone: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  /**
   * Deactivate user with RBAC
   */
  async deactivate(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent deactivating yourself
    if (user.id === currentUser.userId) {
      throw new BadRequestException('You cannot deactivate yourself');
    }

    // SCHOOL_ADMIN can only deactivate users from their school
    if (
      currentUser.role === Role.SCHOOL_ADMIN &&
      user.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException(
        'Access denied. You can only deactivate users from your school',
      );
    }

    // Prevent deactivating SUPER_ADMIN
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot deactivate SUPER_ADMIN');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        firstName: true,
        lastName: true,
        phone: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  /**
   * Reset password with RBAC
   */
  async resetPassword(
    id: string,
    resetPasswordDto: ResetPasswordDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // SCHOOL_ADMIN can only reset passwords for users from their school
    if (
      currentUser.role === Role.SCHOOL_ADMIN &&
      user.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException(
        'Access denied. You can only reset passwords for users from your school',
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return {
      message: 'Password has been reset successfully',
    };
  }
}
