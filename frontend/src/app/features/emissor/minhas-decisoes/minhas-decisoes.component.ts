import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DecisaoService } from '../../../core/services/decisao.service';
import type { Decisao } from '../../../core/models/decisao.model';
import {
  statusLabel as obterStatusLabel,
  statusClass as obterStatusClass,
} from '../../../core/utils/status-decisao';
import { extrairMensagemErro } from '../../../core/utils/erro.util';

@Component({
  selector: 'app-minhas-decisoes',
  standalone: true,
  imports: [DatePipe, KeyValuePipe, RouterLink],
  templateUrl: './minhas-decisoes.html',
  styleUrl: './minhas-decisoes.css',
})
export class MinhasDecisoesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly decisaoService = inject(DecisaoService);

  readonly magistradoHash = this.auth.magistradoHash;

  readonly decisoes = signal<Decisao[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  ngOnInit(): void {
    this.carregarTodas();
  }

  /**
   * Carrega TODAS as decisões do magistrado autenticado, via o endpoint
   * dedicado do backend (`GET /api/decisoes/minhas`), que consulta os
   * eventos do contrato — não depende de nenhuma lista fixa de processos
   * conhecidos no cliente, ao contrário da versão anterior deste componente.
   */
  carregarTodas(): void {
    if (!this.auth.isLoggedIn()) return;

    this.carregando.set(true);
    this.erro.set(null);

    this.decisaoService.minhasDecisoes().subscribe({
      next: (decisoes) => {
        this.decisoes.set(decisoes);
        this.carregando.set(false);
      },
      error: (err) => {
        this.erro.set(extrairMensagemErro(err, 'Erro ao carregar suas decisões.'));
        this.carregando.set(false);
      },
    });
  }

  // ── Stats ──────────────────────────────────────────────────────

  get totalDecisoes(): number {
    return this.decisoes().length;
  }

  get porStatus(): Record<string, number> {
    const contagem: Record<string, number> = {};
    for (const d of this.decisoes()) {
      const label = obterStatusLabel(d.status);
      contagem[label] = (contagem[label] || 0) + 1;
    }
    return contagem;
  }

  /** Decisões cujo magistrado signatário foi revogado após o registro — sinal de auditoria. */
  get comMagistradoRevogado(): number {
    return this.decisoes().filter(d => !d.magistradoAtualmenteCredenciado).length;
  }

  get ultimaAtualizacao(): string {
    const d = this.decisoes();
    if (d.length === 0) return '—';
    const maxTs = Math.max(...d.map(x => x.timestamp));
    return new Date(maxTs * 1000).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

  statusLabel(status: number): string {
    return obterStatusLabel(status);
  }

  statusClass(status: number): string {
    return obterStatusClass(status);
  }
}
