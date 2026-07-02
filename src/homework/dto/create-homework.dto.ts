import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateHomeworkDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
