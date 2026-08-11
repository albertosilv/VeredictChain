import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Decisao, RegistrarInput, RetificarInput } from '../models/decisao.model';
import { AuthService } from './auth.service';

export interface RegistrarResultado {
  txHash: string;
  documentHash: string;
}

export interface ArquivarResultado {
  txHash: string;
  status: number;
}

/**
 * Serviço de comunicação com o backend integrador (NestJS).
 *
 * Endpoints:
 * - GET  /api/decisoes/processo/:numeroProcesso → histórico do processo (público)
 * - GET  /api/decisoes/:documentHash           → metadados por hash (público)
 * - POST /api/decisoes                         → registra nova decisão (autenticado, multipart)
 * - POST /api/decisoes/retificar               → retifica decisão existente (autenticado, multipart)
 * - POST /api/decisoes/:documentHash/arquivar  → arquiva decisão (autenticado)
 *
 * Registro e retificação enviam o ARQUIVO em si (não um hash pré-calculado):
 * o hash é sempre recalculado pelo servidor a partir dos bytes recebidos.
 */
@Injectable({ providedIn: 'root' })
export class DecisaoService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api/decisoes';

  /** Busca os metadados de uma decisão pelo hash do documento. */
  buscarPorHash(documentHash: string): Observable<Decisao> {
    return this.http.get<Decisao>(`${this.baseUrl}/${documentHash}`);
  }

  /** Retorna o histórico completo (todas as versões) de um número de processo. */
  consultarHistorico(numeroProcesso: string): Observable<Decisao[]> {
    return this.http.get<Decisao[]>(
      `${this.baseUrl}/processo/${encodeURIComponent(numeroProcesso)}`,
    );
  }

  /**
   * Lista todas as decisões do magistrado autenticado (dashboard de
   * auditoria), usando o endpoint que consulta eventos do contrato no
   * backend — não depende de nenhuma lista fixa de processos no cliente.
   */
  minhasDecisoes(): Observable<Decisao[]> {
    return this.http.get<Decisao[]>(`${this.baseUrl}/minhas`, {
      headers: this.authHeaders(),
    });
  }

  registrar(input: RegistrarInput): Observable<RegistrarResultado> {
    const form = this.paraFormData(input);
    return this.http.post<RegistrarResultado>(this.baseUrl, form, {
      headers: this.authHeaders(),
    });
  }

  retificar(input: RetificarInput): Observable<RegistrarResultado> {
    const form = this.paraFormData(input);
    form.append('hashAnterior', input.hashAnterior);
    return this.http.post<RegistrarResultado>(`${this.baseUrl}/retificar`, form, {
      headers: this.authHeaders(),
    });
  }

  /** Arquiva uma decisão judicial (status muda para Arquivada). */
  arquivar(documentHash: string): Observable<ArquivarResultado> {
    return this.http.post<ArquivarResultado>(
      `${this.baseUrl}/${documentHash}/arquivar`,
      {},
      { headers: this.authHeaders() },
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private paraFormData(input: RegistrarInput): FormData {
    const form = new FormData();
    form.append('arquivo', input.arquivo, input.arquivo.name);
    form.append('numeroProcesso', input.numeroProcesso);
    form.append('tribunalOrigem', input.tribunalOrigem);
    form.append('orgaoJulgador', input.orgaoJulgador);
    form.append('canalTransmissao', input.canalTransmissao);
    if (input.canalTransmissaoDetalhe) {
      form.append('canalTransmissaoDetalhe', input.canalTransmissaoDetalhe);
    }
    if (input.hashCliente) {
      form.append('hashCliente', input.hashCliente);
    }
    return form;
  }

  /**
   * Cabeçalho Authorization com o JWT da sessão atual. Não define
   * Content-Type manualmente: o navegador precisa gerar o boundary do
   * multipart/form-data sozinho.
   */
  private authHeaders(): HttpHeaders {
    const token = this.auth.accessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
