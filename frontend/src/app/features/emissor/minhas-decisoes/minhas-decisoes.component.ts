import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DecisaoService } from '../../../core/services/decisao.service';
import type { Decisao } from '../../../core/models/decisao.model';
import { StatusDecisao } from '../../../core/models/decisao.model';

const STATUS_ICONS: Record<number, string> = {
  [StatusDecisao.Publicada]: '📄',
  [StatusDecisao.Retificada]: '🔄',
  [StatusDecisao.Arquivada]: '📁',
};

const STATUS_LABELS: Record<number, string> = {
  [StatusDecisao.Publicada]: 'Publicada',
  [StatusDecisao.Retificada]: 'Retificada',
  [StatusDecisao.Arquivada]: 'Arquivada',
};

const STATUS_CLASSES: Record<number, string> = {
  [StatusDecisao.Publicada]: 'status-publicada',
  [StatusDecisao.Retificada]: 'status-retificada',
  [StatusDecisao.Arquivada]: 'status-arquivada',
};

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

  /** Processos conhecidos (mock para demonstração). */
  private readonly processosConhecidos = [
    '0001234-56.2026.8.15.0001',
  ];

  ngOnInit(): void {
    this.carregarTodas();
  }

  carregarTodas(): void {
    if (!this.auth.isLoggedIn()) return;

    this.carregando.set(true);
    this.erro.set(null);

    // Consulta todos os processos conhecidos e filtra pelo magistradoHash logado
    const hashMagistrado = this.magistradoHash();
    if (!hashMagistrado) {
      this.carregando.set(false);
      return;
    }

    const requisicoes = this.processosConhecidos.map(num =>
      new Promise<Decisao[]>(resolve => {
        this.decisaoService.consultarHistorico(num).subscribe({
          next: (r) => resolve(r),
          error: () => resolve([]),
        });
      }),
    );

    Promise.all(requisicoes).then(resultados => {
      const todas = resultados.flat();
      // Filtra pelo magistrado logado
      const minhas = todas.filter(d => d.magistradoHash === hashMagistrado);
      this.decisoes.set(minhas);
      this.carregando.set(false);
    });
  }

  // ── Stats ──────────────────────────────────────────────────────

  get totalDecisoes(): number {
    return this.decisoes().length;
  }

  get porStatus(): Record<string, number> {
    const contagem: Record<string, number> = {};
    for (const d of this.decisoes()) {
      const label = STATUS_LABELS[d.status] ?? 'Desconhecido';
      contagem[label] = (contagem[label] || 0) + 1;
    }
    return contagem;
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
    return STATUS_LABELS[status] ?? 'Desconhecido';
  }

  statusClass(status: number): string {
    return STATUS_CLASSES[status] ?? '';
  }

  statusIcon(status: number): string {
    return STATUS_ICONS[status] ?? '📋';
  }
}
