import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { DecisaoInput } from '../models/decisao.model';

export interface RegistrarResultado {
  txHash: string;
  documentHash: string;
}

/**
 * Serviço de comunicação com o backend integrador (NestJS).
 *
 * Endpoints:
 * - POST /api/decisoes           → registra nova decisão
 * - POST /api/decisoes/retificar → retifica decisão existente
 */
@Injectable({ providedIn: 'root' })
export class DecisaoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/decisoes';

  registrar(input: DecisaoInput): Observable<RegistrarResultado> {
    return this.http.post<RegistrarResultado>(this.baseUrl, input);
  }

  retificar(input: DecisaoInput): Observable<RegistrarResultado> {
    return this.http.post<RegistrarResultado>(`${this.baseUrl}/retificar`, input);
  }
}
