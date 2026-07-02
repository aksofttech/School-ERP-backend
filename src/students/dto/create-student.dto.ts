import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsDateString,
  IsEnum,
  IsUUID,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Gender } from '../../common/enums';

export class CreateStudentDto {
  // User fields
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  // Student fields
  @IsString()
  @IsNotEmpty()
  rollNumber: string;

  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

  @IsDateString()
  @IsNotEmpty()
  dob: string;

  // Class and Section
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @IsUUID()
  @IsNotEmpty()
  sectionId: string;

  // Parent mapping (optional - can be added later)
  @IsUUID()
  @IsOptional()
  parentId?: string;

  // New parent creation fields
  @IsString()
  @IsOptional()
  parentFirstName?: string;

  @IsString()
  @IsOptional()
  parentLastName?: string;

  @IsEmail()
  @IsOptional()
  parentEmail?: string;

  @IsString()
  @IsOptional()
  parentPhone?: string;

  @IsString()
  @IsOptional()
  parentFatherName?: string;

  @IsString()
  @IsOptional()
  parentMotherName?: string;

  @IsString()
  @IsOptional()
  parentAddress?: string;

  @IsString()
  @IsOptional()
  parentSecondaryPhone?: string;
}
