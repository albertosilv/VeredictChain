import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authConfig } from '../config';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  /** Identificador do usuário autenticado (login). */
  sub: string;
  /** Hash do certificado ICP-Brasil do magistrado — usado para credenciamento on-chain. */
  magistradoHash: string;
}

export interface LoginResultado {
  accessToken: string;
  expiresIn: string;
  magistradoHash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly cfg: ConfigType<typeof authConfig>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Valida usuário/senha contra as credenciais configuradas (bcrypt) e,
   * se válidas, emite um JWT contendo o magistradoHash correspondente.
   *
   * Este é o único ponto do sistema onde a identidade do magistrado é
   * estabelecida — a partir daqui, o magistradoHash NUNCA deve ser aceito
   * como campo livre vindo do cliente (ver DecisoesController).
   */
  async login(dto: LoginDto): Promise<LoginResultado> {
    const usuarioValido = dto.usuario === this.cfg.magistradoUsuario;
    const senhaValida = await bcrypt.compare(dto.senha, this.cfg.magistradoSenhaHash);

    if (!usuarioValido || !senhaValida) {
      // Mensagem genérica de propósito: não revela qual campo está incorreto.
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }

    const payload: JwtPayload = {
      sub: dto.usuario,
      magistradoHash: this.cfg.magistradoHash,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      expiresIn: this.cfg.jwtExpiresIn,
      magistradoHash: this.cfg.magistradoHash,
    };
  }
}
