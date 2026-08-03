import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ethers } from 'ethers';
import { VEREDICT_CONTRACT } from '../blockchain';
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
}

@Injectable()
export class DecisoesService {
  private readonly logger = new Logger(DecisoesService.name);

  constructor(
    @Inject(VEREDICT_CONTRACT)
    private readonly contract: ethers.Contract,
  ) {}

  async registrarDecisao(dto: RegistrarDecisaoDto): Promise<RegistrarResultado> {
    this.logger.log(`Registrando decisão: ${dto.documentHash}`);

    const tx = await this.contract.registrarDecisao(
      dto.documentHash,
      dto.numeroProcesso,
      dto.tribunalOrigem,
      dto.orgaoJulgador,
      dto.magistradoHash,
      dto.canalTransmissao,
    );

    const receipt = await tx.wait();
    this.logger.log(`Decisão registrada — tx: ${receipt.hash}`);

    return { txHash: receipt.hash, documentHash: dto.documentHash };
  }

  async retificarDecisao(dto: RetificarDecisaoDto): Promise<RegistrarResultado> {
    this.logger.log(`Retificando decisão: ${dto.hashAnterior} → ${dto.documentHash}`);

    const tx = await this.contract.registrarRetificacao(
      dto.documentHash,
      dto.hashAnterior,
      dto.numeroProcesso,
      dto.tribunalOrigem,
      dto.orgaoJulgador,
      dto.magistradoHash,
      dto.canalTransmissao,
    );

    const receipt = await tx.wait();
    this.logger.log(`Retificação registrada — tx: ${receipt.hash}`);

    return { txHash: receipt.hash, documentHash: dto.documentHash };
  }

  // -------------------------------------------------------------------
  // Consultas públicas (read-only)
  // -------------------------------------------------------------------

  /** Busca os metadados de uma decisão pelo hash do documento. */
  async buscarPorHash(documentHash: string): Promise<DecisaoConsultada> {
    const [existe, decisao] = await this.contract.verificarDecisao(documentHash);

    if (!existe) {
      throw new NotFoundException('Decisão não encontrada na blockchain');
    }

    return this.formatarDecisao(decisao);
  }

  /** Retorna o histórico completo de um processo (todas as versões em ordem). */
  async historicoPorProcesso(numeroProcesso: string): Promise<DecisaoConsultada[]> {
    const hashes: string[] = await this.contract.historicoDoProcesso(numeroProcesso);

    if (hashes.length === 0) {
      return [];
    }

    const decisoes = await Promise.all(
      hashes.map((hash: string) => this.contract.verificarDecisao(hash)),
    );

    return decisoes
      .map(([, decisao]: [boolean, ethers.Result]) => this.formatarDecisao(decisao))
      .filter(d => d !== null) as DecisaoConsultada[];
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private formatarDecisao(raw: ethers.Result): DecisaoConsultada {
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
    };
  }
}
