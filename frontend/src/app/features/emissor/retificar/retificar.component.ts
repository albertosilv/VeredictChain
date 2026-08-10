import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecisaoService } from '../../../core/services/decisao.service';
import { HashService } from '../../../core/services/hash.service';
import type { Decisao, RetificarInput } from '../../../core/models/decisao.model';
import { StatusDecisao } from '../../../core/models/decisao.model';
import { statusLabel as obterStatusLabel, statusClass as obterStatusClass } from '../../../core/utils/status-decisao';
import { extrairMensagemErro } from '../../../core/utils/erro.util';

interface RetificarFormState {
  novoArquivo: File | null;
  hashPreview: string; // apenas para exibição — o hash real é calculado no servidor
  numeroProcesso: string;
  tribunalOrigem: string;
  orgaoJulgador: string;
  canalTransmissao: string;
  canalTransmissaoDetalhe: string;
}

const CANAIS = ['DJe', 'SEEU', 'Malote Digital', 'PJe', 'e-SAJ', 'Outro'];

@Component({
  selector: 'app-retificar',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './retificar.html',
  styleUrl: './retificar.css',
})
export class RetificarComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly decisaoService = inject(DecisaoService);
  private readonly hashService = inject(HashService);

  // ── Decisão original ─────────────────────────────────────────

  readonly hashAnterior = signal<string | null>(null);
  readonly original = signal<Decisao | null>(null);
  readonly carregandoOriginal = signal(true);
  readonly erroOriginal = signal<string | null>(null);

  // ── Índice da versão (exibido como "v2" se a original for v1) ─

  /** Estimativa do índice: se a original já é retificada, é pelo menos v2. */
  readonly indiceVersao = computed(() => {
    const o = this.original();
    if (!o) return 1;
    return o.status === StatusDecisao.Retificada ? 2 : 1;
  });

  // ── Formulário ────────────────────────────────────────────────

  readonly form = signal<RetificarFormState>({
    novoArquivo: null,
    hashPreview: '',
    numeroProcesso: '',
    tribunalOrigem: '',
    orgaoJulgador: '',
    canalTransmissao: 'DJe',
    canalTransmissaoDetalhe: '',
  });

  readonly calculando = signal(false);
  readonly enviando = signal(false);
  readonly resultado = signal<{ txHash: string; documentHash: string } | null>(null);
  readonly erro = signal<string | null>(null);

  readonly podeEnviar = computed(() => {
    const f = this.form();
    return (
      f.novoArquivo !== null &&
      f.numeroProcesso !== '' &&
      f.tribunalOrigem !== '' &&
      f.orgaoJulgador !== ''
    );
  });

  // ── Init ──────────────────────────────────────────────────────

  ngOnInit(): void {
    const hash = this.route.snapshot.paramMap.get('documentHash');
    if (!hash) {
      this.erroOriginal.set('Nenhum hash de decisão informado na rota.');
      this.carregandoOriginal.set(false);
      return;
    }

    this.hashAnterior.set(hash);
    this.decisaoService.buscarPorHash(hash).subscribe({
      next: (decisao) => {
        this.original.set(decisao);
        this.form.update((f) => ({
          ...f,
          numeroProcesso: decisao.numeroProcesso,
          tribunalOrigem: decisao.tribunalOrigem,
          orgaoJulgador: decisao.orgaoJulgador,
          canalTransmissao: decisao.canalTransmissao,
        }));
        this.carregandoOriginal.set(false);
      },
      error: (err) => {
        this.erroOriginal.set(extrairMensagemErro(err, 'Erro ao buscar decisão original.'));
        this.carregandoOriginal.set(false);
      },
    });
  }

  // ── Upload & Hash (preview local — o hash oficial é recalculado no servidor) ──

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.form.update((f) => ({ ...f, novoArquivo: file, hashPreview: '' }));
    this.calculando.set(true);
    this.erro.set(null);

    try {
      const hash = await this.hashService.hashFile(file);
      this.form.update((f) => ({ ...f, hashPreview: hash }));
    } catch {
      this.erro.set('Erro ao calcular hash do novo documento.');
    } finally {
      this.calculando.set(false);
    }
  }

  // ── Helpers de formulário ─────────────────────────────────────

  atualizarCampo(
    campo:
      | 'numeroProcesso'
      | 'tribunalOrigem'
      | 'orgaoJulgador'
      | 'canalTransmissao'
      | 'canalTransmissaoDetalhe',
    valor: string,
  ): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  // ── Envio ─────────────────────────────────────────────────────

  onSubmit(): void {
    const hashAnterior = this.hashAnterior();
    const f = this.form();

    if (!hashAnterior || !f.novoArquivo) {
      this.erro.set('Dados insuficientes para retificação.');
      return;
    }
    if (this.calculando()) {
      this.erro.set('Aguarde o cálculo do hash do arquivo terminar.');
      return;
    }

    this.enviando.set(true);
    this.erro.set(null);
    this.resultado.set(null);

    const input: RetificarInput = {
      arquivo: f.novoArquivo,
      numeroProcesso: f.numeroProcesso,
      tribunalOrigem: f.tribunalOrigem,
      orgaoJulgador: f.orgaoJulgador,
      canalTransmissao: f.canalTransmissao,
      canalTransmissaoDetalhe: f.canalTransmissaoDetalhe || undefined,
      hashCliente: f.hashPreview || undefined,
      hashAnterior,
    };

    this.decisaoService.retificar(input).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.enviando.set(false);
      },
      error: (err) => {
        this.erro.set(extrairMensagemErro(err, 'Erro ao registrar retificação.'));
        this.enviando.set(false);
      },
    });
  }

  reset(): void {
    const o = this.original();
    this.form.set({
      novoArquivo: null,
      hashPreview: '',
      numeroProcesso: o?.numeroProcesso ?? '',
      tribunalOrigem: o?.tribunalOrigem ?? '',
      orgaoJulgador: o?.orgaoJulgador ?? '',
      canalTransmissao: o?.canalTransmissao ?? 'DJe',
      canalTransmissaoDetalhe: '',
    });
    this.resultado.set(null);
    this.erro.set(null);
  }

  // ── Exposição para o template ──────────────────────────────────

  readonly canais = CANAIS;

  statusLabel(status: number): string {
    return obterStatusLabel(status);
  }

  statusClass(status: number): string {
    return obterStatusClass(status);
  }
}
