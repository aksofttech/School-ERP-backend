import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AddMessageDto {
  @IsUUID()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
