import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum DocumentType {
  ADMISSION = 'ADMISSION',
  IDENTITY = 'IDENTITY',
  ACADEMIC = 'ACADEMIC',
  CERTIFICATE = 'CERTIFICATE',
  OTHER = 'OTHER',
}

export class UploadDocumentDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileType: string; // MIME type (e.g., 'application/pdf', 'image/jpeg')

  @IsEnum(DocumentType)
  @IsNotEmpty()
  documentType: DocumentType;

  @IsString()
  @IsOptional()
  description?: string;
}
