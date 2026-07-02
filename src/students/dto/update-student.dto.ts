import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateStudentDto } from './create-student.dto';

export class UpdateStudentDto extends PartialType(
  OmitType(CreateStudentDto, ['email', 'password', 'rollNumber'] as const),
) {}
