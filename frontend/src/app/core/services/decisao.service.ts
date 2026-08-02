import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import type { DecisaoInput } from '../models/decisao.model';

export interface RegistrarResultado {
  txHash: string;
  documentHash: string;
}

/**
 * Serviço de comunicação com o backend integrador.
 *
 * Quando o backend NestJS existir, este serviço apontará para:
 * `POST /api/decisoes` (registro) e `POST /api/decisoes/retificar`.
 *
 * Por enquanto, é um stub que simula latência de rede e retorna
 * dados mockados para o frontend evoluir sem depender do backend.
 */
@Injectable({ providedIn: 'root' })
export class DecisaoService {
  /**
   * Registra uma nova decisão judicial.
   * Futuro: `this.http.post<RegistrarResultado>('/api/decisoes', { ...input, arquivo })`
   */
  registrar(input: DecisaoInput): Observable<RegistrarResultado> {
    const mock: RegistrarResultado = {
      txHash: '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join(''),
      documentHash: input.documentHash,
    };

    console.log('[DecisaoService] STUB — registrarDecisao:', input);
    return of(mock).pipe(delay(800)); // simula latência
  }

  /**
   * Retifica uma decisão existente.
   * Futuro: `this.http.post<RegistrarResultado>('/api/decisoes/retificar', { ...input })`
   */
  retificar(input: DecisaoInput): Observable<RegistrarResultado> {
    const mock: RegistrarResultado = {
      txHash: '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join(''),
      documentHash: input.documentHash,
    };

    console.log('[DecisaoService] STUB — registrarRetificacao:', input);
    return of(mock).pipe(delay(800));
  }
}
