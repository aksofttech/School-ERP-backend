import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ViewResultsDto } from './dto/view-results.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('results')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Post('generate/:examId')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER)
  generateResults(@Param('examId') examId: string, @CurrentUser() user: any) {
    return this.resultsService.generateResults(examId, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('student/:studentId')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.STUDENT, Role.PARENT)
  getStudentResults(
    @Param('studentId') studentId: string,
    @CurrentUser() user: any,
  ) {
    return this.resultsService.getStudentResults(studentId, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('exam/:examId')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.STUDENT, Role.PARENT)
  getExamResults(@Param('examId') examId: string, @CurrentUser() user: any) {
    return this.resultsService.getExamResults(examId, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('class/:classId')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.STUDENT, Role.PARENT)
  getClassResults(
    @Param('classId') classId: string,
    @Query() viewResultsDto: ViewResultsDto,
    @CurrentUser() user: any,
  ) {
    return this.resultsService.getClassResults(classId, viewResultsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
