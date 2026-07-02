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
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsDto } from './dto/list-students.dto';
import { PromoteStudentsDto } from './dto/promote-student.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles(Role.SCHOOL_ADMIN)
  create(@Body() createStudentDto: CreateStudentDto, @CurrentUser() user: any) {
    return this.studentsService.create(createStudentDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Post('promote')
  @Roles(Role.SCHOOL_ADMIN)
  promote(
    @Body() promoteStudentsDto: PromoteStudentsDto,
    @CurrentUser() user: any,
  ) {
    return this.studentsService.promote(promoteStudentsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get()
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.SUPER_ADMIN)
  findAll(@Query() listStudentsDto: ListStudentsDto, @CurrentUser() user: any) {
    return this.studentsService.findAll(listStudentsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('class/:classId')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER)
  findByClass(@Param('classId') classId: string, @CurrentUser() user: any) {
    return this.studentsService.findByClass(classId, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.STUDENT)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.studentsService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id/documents')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.STUDENT)
  getDocuments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.studentsService.getDocuments(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.SCHOOL_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.studentsService.update(id, updateStudentDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.SCHOOL_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.studentsService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
