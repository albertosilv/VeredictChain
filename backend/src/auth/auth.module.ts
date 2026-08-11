import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { authConfig } from '../config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (cfg: ConfigType<typeof authConfig>) => ({
        secret: cfg.jwtSecret,
        // Cast necessário: jwtExpiresIn vem de env (string livre, ex: "2h"),
        // enquanto o tipo de `expiresIn` do jsonwebtoken espera um template
        // literal restrito. O valor é definido por nós em auth.config.ts.
        signOptions: { expiresIn: cfg.jwtExpiresIn as unknown as number },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
