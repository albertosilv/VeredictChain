import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HashService } from '../../../core/services/hash.service';
import { DecisaoService } from '../../../core/services/decisao.service';
import type { RegistrarInput } from '../../../core/models/decisao.model';
import { extrairMensagemErro } from '../../../core/utils/erro.util';

interface FormState {
  arquivo: File | null;
  hashPreview: string; // apenas para exibição — o hash real é calculado no servidor
  numeroProcesso: string;
  tribunalOrigem: string;
  orgaoJulgador: string;
  canalTransmissao: string;
  canalTransmissaoDetalhe: string;
}

const FORM_VAZIO: FormState = {
  arquivo: null,
  hashPreview: '',
  numeroProcesso: '',
  tribunalOrigem: '',
  orgaoJulgador: '',
  canalTransmissao: 'DJe',
  canalTransmissaoDetalhe: '',
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

  // ── Upload & Hash (preview local — o hash oficial é recalculado no servidor) ──

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.form.update(f => ({ ...f, arquivo: file, hashPreview: '' }));
    this.calculando.set(true);
    this.erro.set(null);

    try {
      const hash = await this.hashService.hashFile(file);
      this.form.update(f => ({ ...f, hashPreview: hash }));
    } catch {
      this.erro.set('Erro ao calcular hash do arquivo.');
    } finally {
      this.calculando.set(false);
    }
  }

  // ── Envio ──────────────────────────────────────────────────────

  onSubmit(): void {
    const f = this.form();

    if (!f.arquivo) {
      this.erro.set('Selecione um arquivo para registrar.');
      return;
    }
    if (!f.numeroProcesso || !f.tribunalOrigem || !f.orgaoJulgador) {
      this.erro.set('Preencha todos os campos obrigatórios.');
      return;
    }
    if (this.calculando()) {
      this.erro.set('Aguarde o cálculo do hash do arquivo terminar.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.resultado.set(null);

    const input: RegistrarInput = {
      arquivo: f.arquivo,
      numeroProcesso: f.numeroProcesso,
      tribunalOrigem: f.tribunalOrigem,
      orgaoJulgador: f.orgaoJulgador,
      canalTransmissao: f.canalTransmissao,
      canalTransmissaoDetalhe: f.canalTransmissaoDetalhe || undefined,
      hashCliente: f.hashPreview || undefined,
    };

    this.decisaoService.registrar(input).subscribe({
      next: res => {
        this.resultado.set(res);
        this.enviando.set(false);
      },
      error: err => {
        this.erro.set(extrairMensagemErro(err, 'Erro ao registrar decisão.'));
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
