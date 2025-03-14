import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

const logger = new Logger('Main');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Handle unhandled promise rejections to prevent app crashes
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    // Optionally, you can decide whether to exit or continue here
    // process.exit(1); // Uncomment to crash the app for debugging
  });

  await app.listen(3000);

}
bootstrap();
