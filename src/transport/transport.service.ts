import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AssignRouteDto } from './dto/assign-route.dto';
import { ListVehiclesDto } from './dto/list-vehicles.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role } from '@prisma/client';

@Injectable()
export class TransportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create vehicle
   * Only SCHOOL_ADMIN can manage vehicles
   */
  async createVehicle(
    createVehicleDto: CreateVehicleDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can manage vehicles');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { number, driver, model, phone, capacity, route } = createVehicleDto;

    // Check if vehicle number already exists in the school
    const existingVehicle = await this.prisma.vehicle.findFirst({
      where: {
        number,
        schoolId: currentUser.schoolId,
      },
    });

    if (existingVehicle) {
      throw new BadRequestException(
        `Vehicle with number ${number} already exists in your school`,
      );
    }

    // Create vehicle
    const vehicle = await this.prisma.vehicle.create({
      data: {
        number,
        driver,
        model,
        phone,
        capacity,
        schoolId: currentUser.schoolId,
      },
    });

    return {
      ...vehicle,
      route: route || null, // Note: Route would need a separate Route model for proper storage
      note: 'Route information stored separately. Consider adding Route model to schema for proper route management.',
    };
  }

  /**
   * List all vehicles
   * Only SCHOOL_ADMIN can view vehicles
   */
  async findAllVehicles(
    listVehiclesDto: ListVehiclesDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can view vehicles');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { page = 1, limit = 10, route } = listVehiclesDto;
    const skip = (page - 1) * limit;

    const where: any = {
      schoolId: currentUser.schoolId,
    };

    // Note: Route filtering would require a Route model
    // For now, we'll just filter by school

    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        include: {
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { number: 'asc' },
      }),
      this.prisma.vehicle.count({ where }),
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
   * Get vehicle by ID
   * Only SCHOOL_ADMIN can view vehicles
   */
  async findOneVehicle(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can view vehicles');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    // Verify vehicle belongs to school admin's school
    if (vehicle.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only view vehicles in your school',
      );
    }

    return vehicle;
  }

  /**
   * Update vehicle
   * Only SCHOOL_ADMIN can update vehicles
   */
  async updateVehicle(
    id: string,
    updateVehicleDto: UpdateVehicleDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update vehicles');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    // Verify vehicle belongs to school admin's school
    if (vehicle.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update vehicles in your school',
      );
    }

    // Check if vehicle number is being updated and if it already exists
    if (updateVehicleDto.number && updateVehicleDto.number !== vehicle.number) {
      const existingVehicle = await this.prisma.vehicle.findFirst({
        where: {
          number: updateVehicleDto.number,
          schoolId: currentUser.schoolId,
          id: { not: id },
        },
      });

      if (existingVehicle) {
        throw new BadRequestException(
          `Vehicle with number ${updateVehicleDto.number} already exists in your school`,
        );
      }
    }

    const updatedVehicle = await this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(updateVehicleDto.number && { number: updateVehicleDto.number }),
        ...(updateVehicleDto.driver && { driver: updateVehicleDto.driver }),
        ...(updateVehicleDto.model && { model: updateVehicleDto.model }),
        ...(updateVehicleDto.phone && { phone: updateVehicleDto.phone }),
        ...(updateVehicleDto.capacity && {
          capacity: updateVehicleDto.capacity,
        }),
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

    return {
      ...updatedVehicle,
      route: updateVehicleDto.route || null,
      note: 'Route information stored separately. Consider adding Route model to schema for proper route management.',
    };
  }

  /**
   * Assign students to route/vehicle
   * Only SCHOOL_ADMIN can assign routes
   * Note: This requires a Route model or Student-Vehicle relationship in schema
   */
  async assignRoute(
    assignRouteDto: AssignRouteDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can assign routes');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { vehicleId, studentIds } = assignRouteDto;

    // Verify vehicle exists and belongs to school
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    if (vehicle.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only assign routes to vehicles in your school',
      );
    }

    // Verify all students exist and belong to school
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        schoolId: currentUser.schoolId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (students.length !== studentIds.length) {
      throw new BadRequestException(
        'One or more students not found or do not belong to your school',
      );
    }

    // TODO: Once Route model or Student-Vehicle relationship is added to schema:
    // await this.prisma.route.create({
    //   data: {
    //     vehicleId,
    //     schoolId: currentUser.schoolId,
    //     students: {
    //       connect: studentIds.map(id => ({ id }))
    //     }
    //   }
    // });

    // For now, return the assignment structure ready for schema integration
    return {
      vehicle: {
        id: vehicle.id,
        number: vehicle.number,
        driver: vehicle.driver,
      },
      assignedStudents: students.map((s) => ({
        id: s.id,
        rollNumber: s.rollNumber,
        name: `${s.user.firstName} ${s.user.lastName}`,
      })),
      totalAssigned: students.length,
      note: 'Route assignment structure ready. Add Route model or Student-Vehicle relationship to schema.prisma for persistent storage.',
    };
  }

  /**
   * Get students assigned to a vehicle
   * Only SCHOOL_ADMIN can view route assignments
   */
  async getVehicleStudents(
    vehicleId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN can view route assignments',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    if (vehicle.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only view routes for vehicles in your school',
      );
    }

    // TODO: Once Route model is added:
    // const route = await this.prisma.route.findFirst({
    //   where: {
    //     vehicleId,
    //     schoolId: currentUser.schoolId,
    //   },
    //   include: {
    //     students: {
    //       include: {
    //         user: {
    //           select: {
    //             id: true,
    //             firstName: true,
    //             lastName: true,
    //           },
    //         },
    //         class: {
    //           select: {
    //             id: true,
    //             name: true,
    //           },
    //         },
    //       },
    //     },
    //   },
    // });
    //
    // return {
    //   vehicle: {
    //     id: vehicle.id,
    //     number: vehicle.number,
    //     driver: vehicle.driver,
    //   },
    //   route: route || null,
    //   students: route?.students || [],
    //   total: route?.students.length || 0,
    // };

    return {
      vehicle: {
        id: vehicle.id,
        number: vehicle.number,
        driver: vehicle.driver,
      },
      students: [],
      total: 0,
      note: 'Route model needs to be added to schema.prisma for student-vehicle assignment viewing. Structure is ready for integration.',
    };
  }

  /**
   * Delete vehicle
   * Only SCHOOL_ADMIN can delete vehicles
   */
  async removeVehicle(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete vehicles');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    // Verify vehicle belongs to school admin's school
    if (vehicle.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete vehicles in your school',
      );
    }

    // TODO: Check if vehicle has assigned students/routes before deleting
    // Once Route model is added:
    // const route = await this.prisma.route.findFirst({
    //   where: { vehicleId: id },
    // });
    //
    // if (route && route.students.length > 0) {
    //   throw new BadRequestException(
    //     'Cannot delete vehicle with assigned students. Please unassign students first.',
    //   );
    // }

    await this.prisma.vehicle.delete({
      where: { id },
    });

    return {
      message: 'Vehicle deleted successfully',
    };
  }
}
