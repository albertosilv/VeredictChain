import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

interface LoginResponse {
  accessToken: string;
  expiresIn: string;
  magistradoHash: string;
}

/** Chave usada para persistir a sessão no sessionStorage do navegador. */
const STORAGE_KEY = 'veredictchain.session';

interface SessaoPersistida {
  accessToken: string;
  magistradoHash: string;
}

/**
 * Serviço de autenticação.
 *
 * A autenticação REAL acontece no backend (POST /api/auth/login), que valida
 * a credencial com bcrypt e emite um JWT assinado pelo servidor. Este serviço
 * apenas guarda o token e o expõe para o resto do app — ele NÃO decide sozinho
 * quem está autenticado; isso é sempre reverificado pelo backend em cada
 * requisição protegida (ver JwtAuthGuard no NestJS).
 *
 * O token é persistido em sessionStorage só para sobreviver a um F5 da página
 * durante a sessão do navegador — nunca em localStorage (evita persistência
 * indefinida) e nunca em cookie sem as flags adequadas (fora de escopo aqui).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = 'http://localhost:3000/api/auth';

  private readonly _accessToken = signal<string | null>(null);
  private readonly _magistradoHash = signal<string | null>(null);

  readonly isLoggedIn = computed(() => this._accessToken() !== null);
  readonly magistradoHash = this._magistradoHash.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();

  constructor() {
    this.restaurarSessao();
  }

  /** Efetua login contra o backend. Retorna `true` em caso de sucesso. */
  login(usuario: string, senha: string): Observable<boolean> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { usuario, senha }).pipe(
      map((res) => {
        this._accessToken.set(res.accessToken);
        this._magistradoHash.set(res.magistradoHash);
        this.persistirSessao({ accessToken: res.accessToken, magistradoHash: res.magistradoHash });
        return true;
      }),
      // 401 (credenciais inválidas) ou qualquer outro erro de rede → false.
      catchError(() => of(false)),
    );
  }

  logout(): void {
    this._accessToken.set(null);
    this._magistradoHash.set(null);
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  // ── Persistência local (apenas para sobreviver a reload de página) ──

  private persistirSessao(sessao: SessaoPersistida): void {
    if (!isPlatformBrowser(this.platformId)) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessao));
  }

  private restaurarSessao(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const sessao: SessaoPersistida = JSON.parse(raw);
      this._accessToken.set(sessao.accessToken);
      this._magistradoHash.set(sessao.magistradoHash);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }
}
