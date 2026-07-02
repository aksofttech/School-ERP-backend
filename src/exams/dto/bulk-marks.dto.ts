import {
  IsNotEmpty,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StudentMarkDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  marks: number;
}

export class BulkMarksDto {
  @IsUUID()
  @IsNotEmpty()
  examId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentMarkDto)
  @IsNotEmpty()
  marks: StudentMarkDto[];
}
