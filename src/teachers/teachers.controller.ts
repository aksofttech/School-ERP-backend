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
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { AssignSubjectsDto } from './dto/assign-subjects.dto';
import { ListTeachersDto } from './dto/list-teachers.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @Roles(Role.SCHOOL_ADMIN)
  create(@Body() createTeacherDto: CreateTeacherDto, @CurrentUser() user: any) {
    return this.teachersService.create(createTeacherDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get()
  @Roles(Role.SCHOOL_ADMIN)
  findAll(@Query() listTeachersDto: ListTeachersDto, @CurrentUser() user: any) {
    return this.teachersService.findAll(listTeachersDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teachersService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.SCHOOL_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
    @CurrentUser() user: any,
  ) {
    return this.teachersService.update(id, updateTeacherDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id/assign-subjects')
  @Roles(Role.SCHOOL_ADMIN)
  assignSubjects(
    @Param('id') id: string,
    @Body() assignSubjectsDto: AssignSubjectsDto,
    @CurrentUser() user: any,
  ) {
    return this.teachersService.assignSubjects(id, assignSubjectsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.SCHOOL_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teachersService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
