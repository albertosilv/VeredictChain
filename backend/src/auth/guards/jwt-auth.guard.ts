import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Exige um Bearer token JWT válido (emitido por AuthService.login). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
