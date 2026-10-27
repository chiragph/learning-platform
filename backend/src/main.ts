import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { allowedFrontendOrigins } from './auth/frontend-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Enable CORS for frontend
  app.enableCors({
    origin: allowedFrontendOrigins(),
    credentials: true,
  });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Start backend server
  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
