import { IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ListSubjectsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;
}
