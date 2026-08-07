import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { DecisoesService, RegistrarResultado, DecisaoConsultada } from './decisoes.service';
import { RegistrarDecisaoDto, RetificarDecisaoDto } from './dto/registrar-decisao.dto';

@Controller('api/decisoes')
export class DecisoesController {
  constructor(private readonly decisoesService: DecisoesService) {}

  /** Registra uma nova decisão judicial na blockchain. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async registrar(@Body() dto: RegistrarDecisaoDto): Promise<RegistrarResultado> {
    return this.decisoesService.registrarDecisao(dto);
  }

  /** Retifica uma decisão existente, preservando o histórico. */
  @Post('retificar')
  @HttpCode(HttpStatus.CREATED)
  async retificar(@Body() dto: RetificarDecisaoDto): Promise<RegistrarResultado> {
    return this.decisoesService.retificarDecisao(dto);
  }

  /** Consulta o histórico completo de um número de processo. */
  @Get('processo/:numeroProcesso')
  async historicoPorProcesso(
    @Param('numeroProcesso') numeroProcesso: string,
  ): Promise<DecisaoConsultada[]> {
    return this.decisoesService.historicoPorProcesso(numeroProcesso);
  }

  /** Consulta os metadados de uma decisão pelo hash do documento. */
  @Get(':documentHash')
  async buscarPorHash(
    @Param('documentHash') documentHash: string,
  ): Promise<DecisaoConsultada> {
    return this.decisoesService.buscarPorHash(documentHash);
  }

  /** Arquiva uma decisão judicial (status muda para Arquivada). */
  @Post(':documentHash/arquivar')
  @HttpCode(HttpStatus.OK)
  async arquivar(
    @Param('documentHash') documentHash: string,
  ): Promise<{ txHash: string; status: number }> {
    return this.decisoesService.arquivarDecisao(documentHash);
  }
}
