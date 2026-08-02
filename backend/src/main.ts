import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(); // Permite requisições do frontend Angular
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Remove campos não declarados no DTO
      forbidNonWhitelisted: true, // Rejeita campos extras
      transform: true,        // Transforma tipos (ex: string → number)
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
