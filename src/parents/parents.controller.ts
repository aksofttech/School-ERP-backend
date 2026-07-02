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
import { ParentsService } from './parents.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { MapStudentsDto } from './dto/map-students.dto';
import { ListParentsDto } from './dto/list-parents.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('parents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post()
  @Roles(Role.SCHOOL_ADMIN)
  create(@Body() createParentDto: CreateParentDto, @CurrentUser() user: any) {
    return this.parentsService.create(createParentDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get()
  @Roles(Role.SCHOOL_ADMIN)
  findAll(@Query() listParentsDto: ListParentsDto, @CurrentUser() user: any) {
    return this.parentsService.findAll(listParentsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('my-students')
  @Roles(Role.PARENT)
  getLinkedStudents(@CurrentUser() user: any) {
    return this.parentsService.getLinkedStudents({
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.PARENT)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.parentsService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.SCHOOL_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateParentDto: UpdateParentDto,
    @CurrentUser() user: any,
  ) {
    return this.parentsService.update(id, updateParentDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id/map-students')
  @Roles(Role.SCHOOL_ADMIN)
  mapStudents(
    @Param('id') id: string,
    @Body() mapStudentsDto: MapStudentsDto,
    @CurrentUser() user: any,
  ) {
    return this.parentsService.mapStudents(id, mapStudentsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.SCHOOL_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.parentsService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
