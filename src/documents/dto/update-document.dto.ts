import { IsOptional, IsString, IsEnum } from 'class-validator';
import { DocumentType } from './upload-document.dto';

export class UpdateDocumentDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DocumentType)
  @IsOptional()
  documentType?: DocumentType;
}
