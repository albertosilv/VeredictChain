import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // Trava de segurança: nunca permitir que o fallback de desenvolvimento de
  // JWT_SECRET (definido em auth.config.ts) seja usado em produção. Se um
  // operador esquecer de configurar a variável de ambiente, o sistema deve
  // recusar iniciar — não iniciar silenciosamente com um segredo público
  // conhecido (que estaria no próprio código-fonte versionado).
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    // eslint-disable-next-line no-console
    console.error(
      'ERRO FATAL: JWT_SECRET não foi definido em ambiente de produção (NODE_ENV=production). ' +
        'O sistema recusa iniciar com o segredo padrão de desenvolvimento — configure JWT_SECRET ' +
        'antes de tentar novamente.',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  // CORS restrito à(s) origem(ns) do frontend — configurável via env.
  // Em desenvolvimento, se CORS_ORIGIN não for definido, cai para localhost:4200
  // (porta padrão do `ng serve`) em vez de aceitar qualquer origem.
  const corsOrigin = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:4200'];
  app.enableCors({ origin: corsOrigin });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove campos não declarados no DTO
      forbidNonWhitelisted: true, // Rejeita campos extras
      transform: true, // Transforma tipos (ex: string → number)
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
