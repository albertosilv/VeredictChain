import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { DecisoesService, RegistrarResultado } from './decisoes.service';
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
}
