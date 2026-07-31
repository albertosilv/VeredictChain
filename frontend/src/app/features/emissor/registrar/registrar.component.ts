import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HashService } from '../../../core/services/hash.service';
import { DecisaoService } from '../../../core/services/decisao.service';
import type { DecisaoInput } from '../../../core/models/decisao.model';

interface FormState {
  arquivo: File | null;
  documentHash: string;
  numeroProcesso: string;
  tribunalOrigem: string;
  orgaoJulgador: string;
  magistradoHash: string;
  canalTransmissao: string;
}

const FORM_VAZIO: FormState = {
  arquivo: null,
  documentHash: '',
  numeroProcesso: '',
  tribunalOrigem: '',
  orgaoJulgador: '',
  magistradoHash: '',
  canalTransmissao: 'DJe',
};

const CANAIS = ['DJe', 'SEEU', 'Malote Digital', 'PJe', 'e-SAJ', 'Outro'];

@Component({
  selector: 'app-registrar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registrar.html',
  styleUrl: './registrar.css',
})
export class RegistrarComponent {
  private readonly hashService = inject(HashService);
  private readonly decisaoService = inject(DecisaoService);

  readonly form = signal<FormState>({ ...FORM_VAZIO });

  readonly calculando = signal(false);
  readonly enviando = signal(false);
  readonly resultado = signal<{ txHash: string; documentHash: string } | null>(null);
  readonly erro = signal<string | null>(null);

  // ── Upload & Hash ──────────────────────────────────────────────

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.form.update(f => ({ ...f, arquivo: file }));
    this.calculando.set(true);
    this.erro.set(null);

    try {
      const hash = await this.hashService.hashFile(file);
      this.form.update(f => ({ ...f, documentHash: hash }));
    } catch {
      this.erro.set('Erro ao calcular hash do arquivo.');
    } finally {
      this.calculando.set(false);
    }
  }

  // ── Envio ──────────────────────────────────────────────────────

  onSubmit(): void {
    const f = this.form();
    if (!f.arquivo || !f.documentHash) {
      this.erro.set('Selecione um arquivo para gerar o hash.');
      return;
    }
    if (!f.numeroProcesso || !f.tribunalOrigem || !f.orgaoJulgador || !f.magistradoHash) {
      this.erro.set('Preencha todos os campos obrigatórios.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.resultado.set(null);

    const input: DecisaoInput = {
      documentHash: f.documentHash,
      numeroProcesso: f.numeroProcesso,
      tribunalOrigem: f.tribunalOrigem,
      orgaoJulgador: f.orgaoJulgador,
      magistradoHash: f.magistradoHash,
      canalTransmissao: f.canalTransmissao,
    };

    this.decisaoService.registrar(input).subscribe({
      next: res => {
        this.resultado.set(res);
        this.enviando.set(false);
      },
      error: err => {
        this.erro.set(err?.message ?? 'Erro ao registrar decisão.');
        this.enviando.set(false);
      },
    });
  }

  // ── Reset ──────────────────────────────────────────────────────

  reset(): void {
    this.form.set({ ...FORM_VAZIO });
    this.resultado.set(null);
    this.erro.set(null);
  }

  // ── Exposição para o template ──────────────────────────────────

  readonly canais = CANAIS;
}
