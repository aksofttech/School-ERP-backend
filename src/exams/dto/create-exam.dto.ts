import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ExamType } from '../../common/enums';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ExamType)
  @IsNotEmpty()
  type: ExamType;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @IsNotEmpty()
  totalMarks: number;

  @IsNotEmpty()
  passingMarks: number;
}
