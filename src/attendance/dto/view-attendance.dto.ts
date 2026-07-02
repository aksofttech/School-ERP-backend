import { IsOptional, IsUUID, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ViewAttendanceDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  studentId?: string;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
