import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';
import { DocumentType } from './upload-document.dto';

export class ListDocumentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  studentId?: string;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;
}
