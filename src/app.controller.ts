import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): any {
    return {
      status: 'success',
      message: 'School ERP API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
