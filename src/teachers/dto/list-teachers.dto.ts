import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ListTeachersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}
