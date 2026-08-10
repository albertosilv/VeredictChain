import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Intercepta qualquer resposta HTTP 401 (token ausente, inválido ou
 * expirado) e força logout + redirecionamento para a tela de login.
 *
 * Sem isso, um JWT expirado (2h) deixava o usuário "aparentemente logado"
 * na UI (o guard de rota só verifica se existe um token, não sua validade),
 * mas toda chamada de API falhava silenciosamente com mensagens de erro
 * genéricas, sem nunca indicar que era necessário logar novamente.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        auth.logout();
        router.navigate(['/emissor/login'], {
          queryParams: { motivo: 'sessao-expirada' },
        });
      }
      return throwError(() => err);
    }),
  );
};
