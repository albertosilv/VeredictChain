import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extrai a mensagem de erro mais útil de um erro HTTP do Angular.
 *
 * IMPORTANTE: quando o backend retorna um corpo JSON estruturado
 * (ex.: `{"message": "..."}`), esse conteúdo fica em
 * `HttpErrorResponse.error.message` — NÃO em `HttpErrorResponse.message`
 * (que é uma string genérica gerada pelo próprio Angular, tipo
 * "Http failure response for ...: 409 Conflict"). Usar `err.message`
 * diretamente faz a mensagem específica do backend nunca aparecer para o
 * usuário. Esta função sempre prioriza `error.message` quando disponível.
 */
export function extrairMensagemErro(err: unknown, mensagemPadrao = 'Ocorreu um erro inesperado.'): string {
  if (err instanceof HttpErrorResponse) {
    const corpo = err.error as { message?: string | string[] } | string | null;
    if (corpo && typeof corpo === 'object' && corpo.message) {
      return Array.isArray(corpo.message) ? corpo.message.join(' ') : corpo.message;
    }
    if (typeof corpo === 'string' && corpo.length > 0) {
      return corpo;
    }
    if (err.status === 0) {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    }
    return `${mensagemPadrao} (HTTP ${err.status})`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return mensagemPadrao;
}
