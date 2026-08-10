import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HashService } from '../../../core/services/hash.service';
import { DecisaoService } from '../../../core/services/decisao.service';
import type { Decisao } from '../../../core/models/decisao.model';
import { statusLabel as obterStatusLabel, statusClass as obterStatusClass } from '../../../core/utils/status-decisao';
import { extrairMensagemErro } from '../../../core/utils/erro.util';

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

type ResultadoTipo = 'autentico' | 'nao-encontrado' | null;

/**
 * Componente público de verificação de decisões judiciais.
 *
 * Fluxo:
 * 1. Usuário faz upload de um documento (PDF, DOCX, etc.)
 * 2. O hash SHA-256 é calculado no navegador (documento nunca sai do cliente)
 * 3. O hash é consultado na blockchain via backend
 * 4. Resultado: autêntico (com metadados) ou não encontrado
 */
@Component({
  selector: 'app-dropzone',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './dropzone.component.html',
  styleUrl: './dropzone.component.css',
})
export class DropzoneComponent {
  private readonly hashService = inject(HashService);
  private readonly decisaoService = inject(DecisaoService);

  // ── Estado ──────────────────────────────────────────────────

  readonly arquivo = signal<File | null>(null);
  readonly arrastando = signal(false);
  readonly hash = signal<string | null>(null);
  readonly calculando = signal(false);
  readonly consultando = signal(false);
  readonly resultado = signal<ResultadoTipo>(null);
  readonly decisao = signal<Decisao | null>(null);
  readonly erro = signal<string | null>(null);

  // ── Drag & Drop ─────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.arrastando.set(true);
  }

  onDragLeave(_event: DragEvent): void {
    this.arrastando.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.arrastando.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.processarArquivo(file);
    }
  }

  // ── Upload ──────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processarArquivo(file);
    }
  }

  // ── Processamento ───────────────────────────────────────────

  private async processarArquivo(file: File): Promise<void> {
    // Reset
    this.erro.set(null);
    this.resultado.set(null);
    this.decisao.set(null);
    this.hash.set(null);
    this.arquivo.set(file);

    // Calcular hash
    this.calculando.set(true);
    try {
      const h = await this.hashService.hashFile(file);
      this.hash.set(h);
    } catch {
      this.erro.set('Erro ao calcular o hash do documento. Tente novamente.');
      this.calculando.set(false);
      return;
    }
    this.calculando.set(false);

    // Consultar blockchain
    await this.consultarBlockchain();
  }

  private async consultarBlockchain(): Promise<void> {
    const h = this.hash();
    if (!h) return;

    this.consultando.set(true);
    this.erro.set(null);

    this.decisaoService.buscarPorHash(h).subscribe({
      next: (d) => {
        this.decisao.set(d);
        this.resultado.set('autentico');
        this.consultando.set(false);
      },
      error: (err) => {
        // 404 = não encontrado (esperado)
        if (err?.status === 404) {
          this.resultado.set('nao-encontrado');
        } else {
          this.erro.set(
            extrairMensagemErro(err, 'Erro ao consultar a blockchain. Verifique sua conexão.'),
          );
        }
        this.consultando.set(false);
      },
    });
  }

  // ── Helpers para o template ─────────────────────────────────

  statusLabel(status: number): string {
    return obterStatusLabel(status);
  }

  statusClass(status: number): string {
    return obterStatusClass(status);
  }

  isOriginal(hashAnterior: string): boolean {
    return !hashAnterior || hashAnterior === ZERO_HASH;
  }
}
