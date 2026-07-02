import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUUID()
  @IsOptional()
  studentId?: string; // Optional: if creating on behalf of a student (for PARENT)
}
