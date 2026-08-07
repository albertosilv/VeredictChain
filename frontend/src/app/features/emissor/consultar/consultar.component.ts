import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DecisaoService } from '../../../core/services/decisao.service';
import type { Decisao } from '../../../core/models/decisao.model';
import { StatusDecisao } from '../../../core/models/decisao.model';

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

const STATUS_LABELS: Record<number, string> = {
  [StatusDecisao.Inexistente]: 'Inexistente',
  [StatusDecisao.Publicada]: 'Publicada',
  [StatusDecisao.Retificada]: 'Retificada',
  [StatusDecisao.Arquivada]: 'Arquivada',
};

const STATUS_CLASSES: Record<number, string> = {
  [StatusDecisao.Inexistente]: 'status-inexistente',
  [StatusDecisao.Publicada]: 'status-publicada',
  [StatusDecisao.Retificada]: 'status-retificada',
  [StatusDecisao.Arquivada]: 'status-arquivada',
};

@Component({
  selector: 'app-consultar',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  templateUrl: './consultar.html',
  styleUrl: './consultar.css',
})
export class ConsultarComponent {
  private readonly decisaoService = inject(DecisaoService);

  readonly numeroProcesso = signal('');
  readonly decisoes = signal<Decisao[]>([]);
  readonly buscando = signal(false);
  readonly buscou = signal(false);
  readonly erro = signal<string | null>(null);
  readonly arquivando = signal<string | null>(null); // hash da decisão sendo arquivada

  onBuscar(): void {
    const processo = this.numeroProcesso().trim();
    if (!processo) return;

    this.buscando.set(true);
    this.buscou.set(false);
    this.erro.set(null);
    this.decisoes.set([]);

    this.decisaoService.consultarHistorico(processo).subscribe({
      next: (result) => {
        this.decisoes.set(result);
        this.buscando.set(false);
        this.buscou.set(true);
      },
      error: (err) => {
        this.erro.set(err?.message ?? 'Erro ao consultar processo.');
        this.buscando.set(false);
        this.buscou.set(true);
      },
    });
  }

  onArquivar(documentHash: string, event: Event): void {
    event.stopPropagation();
    if (this.arquivando()) return;

    this.arquivando.set(documentHash);
    this.decisaoService.arquivar(documentHash).subscribe({
      next: () => {
        this.arquivando.set(null);
        // Recarrega a lista para refletir o novo status
        this.onBuscar();
      },
      error: (err) => {
        this.erro.set(err?.message ?? 'Erro ao arquivar decisão.');
        this.arquivando.set(null);
      },
    });
  }

  isArquivavel(status: number): boolean {
    return status === StatusDecisao.Publicada || status === StatusDecisao.Retificada;
  }

  // ── Helpers para o template ──────────────────────────────────

  statusLabel(status: number): string {
    return STATUS_LABELS[status] ?? 'Desconhecido';
  }

  statusClass(status: number): string {
    return STATUS_CLASSES[status] ?? '';
  }

  isOriginal(hashAnterior: string): boolean {
    return !hashAnterior || hashAnterior === ZERO_HASH;
  }

  isRetificavel(status: number): boolean {
    return status === StatusDecisao.Publicada || status === StatusDecisao.Retificada;
  }
}
