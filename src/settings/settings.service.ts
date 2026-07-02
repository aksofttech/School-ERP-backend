import { Injectable } from '@nestjs/common';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  findAll() {
    // TODO: Implement find all settings logic
    throw new Error('Method not implemented.');
  }

  findOne(key: string) {
    // TODO: Implement find one setting logic
    throw new Error('Method not implemented.');
  }

  update(key: string, updateSettingDto: UpdateSettingDto) {
    // TODO: Implement update setting logic
    throw new Error('Method not implemented.');
  }
}
