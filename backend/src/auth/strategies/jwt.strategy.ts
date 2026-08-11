import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig } from '../../config';
import { JwtPayload } from '../auth.service';

export interface RequestUser {
  usuario: string;
  magistradoHash: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(authConfig.KEY)
    cfg: ConfigType<typeof authConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.jwtSecret,
    });
  }

  /** Chamado pelo Passport após verificar assinatura e expiração do token. */
  validate(payload: JwtPayload): RequestUser {
    return { usuario: payload.sub, magistradoHash: payload.magistradoHash };
  }
}
