import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { ethers } from 'ethers';
import { VEREDICT_CONTRACT, NONCE_MANAGED_SIGNER } from '../blockchain';
import { RegistrarDecisaoDto, RetificarDecisaoDto } from './dto/registrar-decisao.dto';

export interface RegistrarResultado {
  txHash: string;
  documentHash: string;
}

/** Metadados de uma decisão retornados pela consulta. */
export interface DecisaoConsultada {
  documentHash: string;
  numeroProcesso: string;
  tribunalOrigem: string;
  orgaoJulgador: string;
  magistradoHash: string;
  canalTransmissao: string;
  timestamp: number;
  status: number;
  hashAnterior: string;
  registradoPor: string;
  /**
   * Indica se o magistrado que assinou este registro ainda está credenciado
   * HOJE, no momento da consulta — não no momento do registro. `false` aqui
   * não invalida a decisão (já produziu efeito), mas é um sinal relevante
   * para auditoria: o credenciamento do signatário foi revogado depois do
   * registro, o que pode merecer investigação.
   */
  magistradoAtualmenteCredenciado: boolean;
}

/** Formato esperado de um hash de 32 bytes: "0x" + 64 caracteres hex. */
const HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

@Injectable()
export class DecisoesService {
  private readonly logger = new Logger(DecisoesService.name);

  constructor(
    @Inject(VEREDICT_CONTRACT)
    private readonly contract: ethers.Contract,
    @Inject(NONCE_MANAGED_SIGNER)
    private readonly nonceManager: ethers.NonceManager,
  ) {}

  /**
   * Registra uma nova decisão.
   *
   * @param dto Metadados (SEM hash — nunca aceito do cliente).
   * @param arquivo Bytes do documento assinado, enviado via multipart. O hash é
   *   SEMPRE calculado aqui, a partir do conteúdo real recebido — nunca confiamos
   *   em um hash pronto vindo do body da requisição.
   * @param magistradoHash Identidade do magistrado autenticado, extraída do JWT
   *   (ver JwtStrategy) — nunca aceito como campo livre do body.
   */
  async registrarDecisao(
    dto: RegistrarDecisaoDto,
    arquivo: Buffer,
    magistradoHash: string,
  ): Promise<RegistrarResultado> {
    const documentHash = this.calcularHash(arquivo);
    const canalTransmissao = this.comporCanalTransmissao(dto);
    this.logger.log(`Registrando decisão: ${documentHash}`);

    const tx = await this.contract
      .registrarDecisao(
        documentHash,
        dto.numeroProcesso,
        dto.tribunalOrigem,
        dto.orgaoJulgador,
        magistradoHash,
        canalTransmissao,
      )
      .catch((err: unknown) => this.tratarErroContrato(err));

    const receipt = await tx.wait();
    this.logger.log(`Decisão registrada — tx: ${receipt.hash}`);

    return { txHash: receipt.hash, documentHash };
  }

  /**
   * Registra uma retificação. Mesmas garantias de `registrarDecisao`: o hash
   * da nova versão é sempre recalculado a partir do arquivo enviado.
   */
  async retificarDecisao(
    dto: RetificarDecisaoDto,
    arquivo: Buffer,
    magistradoHash: string,
  ): Promise<RegistrarResultado> {
    this.validarFormatoHash(dto.hashAnterior, 'hashAnterior');
    const documentHash = this.calcularHash(arquivo);
    const canalTransmissao = this.comporCanalTransmissao(dto);
    this.logger.log(`Retificando decisão: ${dto.hashAnterior} → ${documentHash}`);

    const tx = await this.contract
      .registrarRetificacao(
        documentHash,
        dto.hashAnterior,
        dto.numeroProcesso,
        dto.tribunalOrigem,
        dto.orgaoJulgador,
        magistradoHash,
        canalTransmissao,
      )
      .catch((err: unknown) => this.tratarErroContrato(err));

    const receipt = await tx.wait();
    this.logger.log(`Retificação registrada — tx: ${receipt.hash}`);

    return { txHash: receipt.hash, documentHash };
  }

  // -------------------------------------------------------------------
  // Consultas públicas (read-only)
  // -------------------------------------------------------------------

  /** Busca os metadados de uma decisão pelo hash do documento. */
  async buscarPorHash(documentHash: string): Promise<DecisaoConsultada> {
    this.validarFormatoHash(documentHash, 'documentHash');

    const [existe, decisao] = await this.contract
      .verificarDecisao(documentHash)
      .catch((err: unknown) => this.tratarErroContrato(err));

    if (!existe) {
      throw new NotFoundException('Decisão não encontrada na blockchain');
    }

    return this.formatarDecisao(decisao);
  }

  /** Retorna o histórico completo de um processo (todas as versões em ordem). */
  async historicoPorProcesso(numeroProcesso: string): Promise<DecisaoConsultada[]> {
    this.validarNumeroProcesso(numeroProcesso);

    const hashes: string[] = await this.contract
      .historicoDoProcesso(numeroProcesso)
      .catch((err: unknown) => this.tratarErroContrato(err));

    if (hashes.length === 0) {
      return [];
    }

    const decisoes = await Promise.all(
      hashes.map((hash: string) => this.contract.verificarDecisao(hash)),
    );

    return (
      await Promise.all(
        decisoes.map(([, decisao]: [boolean, ethers.Result]) => this.formatarDecisao(decisao)),
      )
    ).filter(d => d !== null) as DecisaoConsultada[];
  }
  /**
   * Lista todas as decisões registradas por um magistrado, usando os eventos
   * indexados do contrato (`DecisaoRegistrada`) em vez de depender de uma
   * lista fixa de processos conhecidos. Cobre o requisito de "dashboard de
   * auditoria com histórico" do enunciado do projeto.
   *
   * NOTA: `DecisaoRetificada` não indexa `magistradoHash` no contrato atual
   * (só `novoHash` e `hashAnterior`), então retificações não podem ser
   * filtradas diretamente pelo `queryFilter`. Para não perder retificações
   * feitas pelo magistrado, consultamos também esse evento (sem filtro) e
   * confirmamos a autoria consultando `verificarDecisao` de cada hash.
   */
  async listarPorMagistrado(magistradoHash: string): Promise<DecisaoConsultada[]> {
    const filtroOriginais = this.contract.filters.DecisaoRegistrada(
      undefined,
      undefined,
      magistradoHash,
    );

    const [eventosOriginais, eventosRetificacoes] = await Promise.all([
      (this.contract.queryFilter as (f: unknown) => Promise<ethers.EventLog[]>)(filtroOriginais),
      (this.contract.queryFilter as (f: unknown) => Promise<ethers.EventLog[]>)(
        this.contract.filters.DecisaoRetificada(),
      ),
    ]).catch((err: unknown) => this.tratarErroContrato(err));

    const hashesOriginais = eventosOriginais
      .map(evento => (evento as ethers.EventLog).args?.documentHash as string | undefined)
      .filter((h): h is string => typeof h === 'string');

    const hashesRetificacoesCandidatos = eventosRetificacoes
      .map(evento => (evento as ethers.EventLog).args?.novoHash as string | undefined)
      .filter((h): h is string => typeof h === 'string');

    const hashesUnicos = Array.from(
      new Set([...hashesOriginais, ...hashesRetificacoesCandidatos]),
    );

    const decisoes = await Promise.all(
      hashesUnicos.map(hash => this.contract.verificarDecisao(hash)),
    );

    const formatadas = await Promise.all(
      decisoes
        // Confirma autoria real (necessário para as retificações, cujo
        // evento não permite filtrar por magistrado diretamente).
        .filter(([, decisao]: [boolean, ethers.Result]) => decisao.magistradoHash === magistradoHash)
        .map(([, decisao]: [boolean, ethers.Result]) => this.formatarDecisao(decisao)),
    );

    // Mais recentes primeiro.
    return formatadas.sort((a, b) => b.timestamp - a.timestamp);
  }

  // -------------------------------------------------------------------
  // Arquivamento
  // -------------------------------------------------------------------

  async arquivarDecisao(documentHash: string): Promise<{ txHash: string; status: number }> {
    this.validarFormatoHash(documentHash, 'documentHash');
    this.logger.log(`Arquivando decisão: ${documentHash}`);

    const tx = await this.contract
      .arquivarDecisao(documentHash)
      .catch((err: unknown) => this.tratarErroContrato(err));
    const receipt = await tx.wait();
    this.logger.log(`Decisão arquivada — tx: ${receipt.hash}`);

    const [, decisao] = await this.contract.verificarDecisao(documentHash);
    return { txHash: receipt.hash, status: Number(decisao.status) };
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /**
   * Calcula o SHA-256 dos bytes do arquivo e retorna no formato "0x" + 64
   * hex chars. Público para ser reutilizado pelo controller na checagem de
   * integridade opcional contra o hash calculado no cliente (ver
   * `DecisoesController.validarIntegridadeUpload`) — mas continua sendo
   * SEMPRE recalculado aqui antes de qualquer registro na blockchain, nunca
   * aceito pronto do cliente como valor autoritativo.
   */
  calcularHash(arquivo: Buffer): string {
    return '0x' + createHash('sha256').update(arquivo).digest('hex');
  }

  /**
   * Compõe o valor final de `canalTransmissao` enviado ao contrato,
   * incorporando o detalhamento livre quando o canal for "Outro" — sem isso,
   * a informação de qual canal foi realmente usado se perdia.
   */
  private comporCanalTransmissao(dto: RegistrarDecisaoDto): string {
    if (dto.canalTransmissao === 'Outro' && dto.canalTransmissaoDetalhe) {
      return `Outro: ${dto.canalTransmissaoDetalhe}`;
    }
    return dto.canalTransmissao;
  }

  /** Valida o formato de um hash de 32 bytes antes de gastar uma chamada RPC. */
  private validarFormatoHash(valor: string, campo: string): void {
    if (!HASH_REGEX.test(valor)) {
      throw new BadRequestException(`${campo} inválido: esperado "0x" + 64 caracteres hexadecimais.`);
    }
  }

  /** Valida minimamente o número do processo antes de consultar a chain. */
  private validarNumeroProcesso(valor: string): void {
    if (!valor || valor.length === 0 || valor.length > 30) {
      throw new BadRequestException('numeroProcesso inválido.');
    }
  }

  /**
   * Traduz reverts comuns do contrato e falhas de infraestrutura (RPC fora
   * do ar) em erros HTTP claros para o cliente, em vez de deixar o erro
   * bruto do `ethers`/Node.js vazar como um 500 opaco.
   */
  private tratarErroContrato(err: unknown): never {
    // Qualquer falha aqui pode significar que uma transação populada nunca
    // chegou a ser enviada de fato (ex.: revert detectado na simulação
    // pré-envio) — o NonceManager já incrementou seu contador local de
    // forma otimista nesse ponto. Sem este reset, o próximo envio bem
    // sucedido usaria um nonce alto demais ("nonce too high"), travando
    // todas as transações seguintes até reiniciar o processo. Confirmado
    // em teste real: tentativa de registro duplicado (rejeitada na
    // simulação) seguida de um arquivamento legítimo, que falhava com
    // NONCE_EXPIRED/"too high" sem este reset.
    this.nonceManager.reset();

    const mensagem = err instanceof Error ? err.message : String(err);

    if (mensagem.includes('hash ja registrado')) {
      throw new ConflictException(
        'Este documento já está registrado na blockchain (hash duplicado).',
      );
    }
    if (mensagem.includes('processo ja possui decisao ativa')) {
      throw new ConflictException(
        'Este número de processo já possui uma decisão ativa registrada. ' +
          'Para publicar uma nova versão, utilize a retificação, referenciando o hash anterior.',
      );
    }
    if (mensagem.includes('hash nao existe')) {
      throw new NotFoundException('Decisão não encontrada na blockchain.');
    }
    if (mensagem.includes('decisao anterior arquivada')) {
      throw new ConflictException('A decisão anterior já está arquivada e não pode ser retificada.');
    }
    if (mensagem.includes('magistrado nao credenciado')) {
      throw new ConflictException('O magistrado autenticado não está credenciado no contrato.');
    }
    if (mensagem.includes('integrador nao autorizado') || mensagem.includes('somente admin')) {
      throw new ConflictException('A carteira do backend não está autorizada para esta operação.');
    }
    if (
      mensagem.includes('ECONNREFUSED') ||
      mensagem.includes('NETWORK_ERROR') ||
      mensagem.includes('could not detect network') ||
      mensagem.includes('SERVER_ERROR')
    ) {
      throw new ServiceUnavailableException(
        'Serviço de blockchain temporariamente indisponível. Tente novamente em instantes.',
      );
    }
    if (mensagem.includes('NONCE_EXPIRED') || mensagem.includes('nonce has already been used')) {
      throw new ServiceUnavailableException(
        'Conflito temporário ao assinar a transação. Tente novamente em alguns segundos.',
      );
    }
    throw err;
  }

  private async formatarDecisao(raw: ethers.Result): Promise<DecisaoConsultada> {
    const magistradoAtualmenteCredenciado: boolean = await this.contract.magistradosCredenciados(
      raw.magistradoHash,
    );

    return {
      documentHash: raw.documentHash,
      numeroProcesso: raw.numeroProcesso,
      tribunalOrigem: raw.tribunalOrigem,
      orgaoJulgador: raw.orgaoJulgador,
      magistradoHash: raw.magistradoHash,
      canalTransmissao: raw.canalTransmissao,
      timestamp: Number(raw.timestamp),
      status: Number(raw.status),
      hashAnterior: raw.hashAnterior,
      registradoPor: raw.registradoPor,
      magistradoAtualmenteCredenciado,
    };
  }
}
