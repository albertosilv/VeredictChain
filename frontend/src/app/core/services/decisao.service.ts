import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Decisao, DecisaoInput } from '../models/decisao.model';

export interface RegistrarResultado {
  txHash: string;
  documentHash: string;
}

/**
 * Serviço de comunicação com o backend integrador (NestJS).
 *
 * Endpoints:
 * - GET  /api/decisoes/processo/:numeroProcesso → histórico do processo
 * - GET  /api/decisoes/:documentHash           → metadados por hash
 * - POST /api/decisoes                         → registra nova decisão
 * - POST /api/decisoes/retificar               → retifica decisão existente
 */
@Injectable({ providedIn: 'root' })
export class DecisaoService {
  private readonly http = inject(HttpClient);
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

  registrar(input: DecisaoInput): Observable<RegistrarResultado> {
    return this.http.post<RegistrarResultado>(this.baseUrl, input);
  }

  retificar(input: DecisaoInput): Observable<RegistrarResultado> {
    return this.http.post<RegistrarResultado>(`${this.baseUrl}/retificar`, input);
  }
}
