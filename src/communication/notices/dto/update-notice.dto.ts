import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateNoticeDto } from './create-notice.dto';

export class UpdateNoticeDto extends PartialType(
  OmitType(CreateNoticeDto, [] as const),
) {}
