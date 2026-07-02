import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransportService } from './transport.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AssignRouteDto } from './dto/assign-route.dto';
import { ListVehiclesDto } from './dto/list-vehicles.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Post('vehicles')
  @Roles(Role.SCHOOL_ADMIN)
  createVehicle(
    @Body() createVehicleDto: CreateVehicleDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.createVehicle(createVehicleDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('vehicles')
  @Roles(Role.SCHOOL_ADMIN)
  findAllVehicles(
    @Query() listVehiclesDto: ListVehiclesDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.findAllVehicles(listVehiclesDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('vehicles/:id')
  @Roles(Role.SCHOOL_ADMIN)
  findOneVehicle(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transportService.findOneVehicle(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('vehicles/:id/students')
  @Roles(Role.SCHOOL_ADMIN)
  getVehicleStudents(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transportService.getVehicleStudents(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Post('routes/assign')
  @Roles(Role.SCHOOL_ADMIN)
  assignRoute(
    @Body() assignRouteDto: AssignRouteDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.assignRoute(assignRouteDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch('vehicles/:id')
  @Roles(Role.SCHOOL_ADMIN)
  updateVehicle(
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @CurrentUser() user: any,
  ) {
    return this.transportService.updateVehicle(id, updateVehicleDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete('vehicles/:id')
  @Roles(Role.SCHOOL_ADMIN)
  removeVehicle(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transportService.removeVehicle(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
