import { Injectable, signal, computed } from '@angular/core';

interface Credenciais {
  usuario: string;
  senha: string;
}

/** Credenciais mock para desenvolvimento. */
const MOCK_CREDENCIAIS: Credenciais = {
  usuario: 'magistrado',
  senha: 'tjpB2026',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _autenticado = signal(false);

  readonly autenticado = this._autenticado.asReadonly();
  readonly isLoggedIn = computed(() => this._autenticado());

  login(usuario: string, senha: string): boolean {
    if (usuario === MOCK_CREDENCIAIS.usuario && senha === MOCK_CREDENCIAIS.senha) {
      this._autenticado.set(true);
      return true;
    }
    return false;
  }

  logout(): void {
    this._autenticado.set(false);
  }
}
