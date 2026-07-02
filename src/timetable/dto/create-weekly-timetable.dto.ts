import { IsNotEmpty, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTimetableDto } from './create-timetable.dto';

export class CreateWeeklyTimetableDto {
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTimetableDto)
  @IsNotEmpty()
  entries: CreateTimetableDto[];
}
