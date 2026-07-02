import { IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ListHomeworkDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  subjectId?: string;
}
