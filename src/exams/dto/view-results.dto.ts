import { IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ViewResultsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  examId?: string;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;
}
