import { Injectable, signal, computed } from '@angular/core';

interface Credenciais {
  usuario: string;
  senha: string;
  magistradoHash: string;
}

/**
 * Hash do magistrado usado no deploy do contrato.
 * Em produção, isso viria do ICP-Brasil (hash do certificado digital).
 * Para o mock, usamos um hash de exemplo fixo, consistente com o deploy.
 */
/** Hash gerado pelo deploy: keccak256("cert-icp-brasil-des-frederico-coutinho") */
const MOCK_CREDENCIAIS: Credenciais = {
  usuario: 'magistrado',
  senha: 'tjpB2026',
  magistradoHash:
    '0x1f3d89c259932131898eba5c76186e6b44d0e4a152456d70ce3063ad56c2094b',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _autenticado = signal(false);
  private readonly _magistradoHash = signal<string | null>(null);

  readonly autenticado = this._autenticado.asReadonly();
  readonly isLoggedIn = computed(() => this._autenticado());
  readonly magistradoHash = this._magistradoHash.asReadonly();

  login(usuario: string, senha: string): boolean {
    if (usuario === MOCK_CREDENCIAIS.usuario && senha === MOCK_CREDENCIAIS.senha) {
      this._autenticado.set(true);
      this._magistradoHash.set(MOCK_CREDENCIAIS.magistradoHash);
      return true;
    }
    return false;
  }

  logout(): void {
    this._autenticado.set(false);
    this._magistradoHash.set(null);
  }
}
