import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return success status payload', () => {
    const result = appController.getHello();

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        message: 'School ERP API is running',
        version: '1.0.0',
      }),
    );
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });
});
