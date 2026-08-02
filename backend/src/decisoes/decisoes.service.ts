import { Inject, Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { VEREDICT_CONTRACT } from '../blockchain';
import { RegistrarDecisaoDto, RetificarDecisaoDto } from './dto/registrar-decisao.dto';

export interface RegistrarResultado {
  txHash: string;
  documentHash: string;
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
}
