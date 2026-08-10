import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, JwtAuthGuard } from '../auth';
import type { RequestUser } from '../auth';
import { DecisoesService, RegistrarResultado, DecisaoConsultada } from './decisoes.service';
import { DocumentoTextoService } from './documento-texto.service';
import { RegistrarDecisaoDto, RetificarDecisaoDto } from './dto/registrar-decisao.dto';

/** Limite de tamanho do documento enviado (20 MB é generoso para um PDF de decisão judicial). */
const LIMITE_ARQUIVO_BYTES = 20 * 1024 * 1024;

/**
 * Apenas PDF e texto simples são aceitos: são os formatos dos quais
 * conseguimos extrair texto de forma confiável para validar que o número do
 * processo declarado realmente aparece no documento (ver DocumentoTextoService).
 * A checagem aqui é só uma primeira triagem pelo `Content-Type` declarado —
 * INSUFICIENTE por si só, pois é definido pelo cliente e é forjável. A
 * validação que realmente importa é `validarConteudoArquivo`, que confere os
 * bytes reais do arquivo (magic bytes) antes de qualquer processamento.
 */
const FILE_INTERCEPTOR_OPTIONS = {
  limits: { fileSize: LIMITE_ARQUIVO_BYTES },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      callback(null, true);
    } else {
      callback(
        new BadRequestException('Apenas arquivos PDF ou texto simples (.txt) são aceitos.'),
        false,
      );
    }
  },
};

@Controller('api/decisoes')
export class DecisoesController {
  constructor(
    private readonly decisoesService: DecisoesService,
    private readonly documentoTextoService: DocumentoTextoService,
  ) {}

  /**
   * Registra uma nova decisão judicial na blockchain.
   *
   * Protegido por JWT: `magistradoHash` vem do token do usuário autenticado,
   * nunca do body. O documento é enviado como arquivo (multipart) e seu hash
   * é sempre calculado no servidor. Além disso, o `numeroProcesso` declarado
   * é conferido contra o texto real do documento antes do registro.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('arquivo', FILE_INTERCEPTOR_OPTIONS))
  @HttpCode(HttpStatus.CREATED)
  async registrar(
    @Body() dto: RegistrarDecisaoDto,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: RequestUser,
  ): Promise<RegistrarResultado> {
    if (!arquivo) {
      throw new BadRequestException('Arquivo do documento (campo "arquivo") é obrigatório.');
    }
    this.validarConteudoArquivo(arquivo);
    this.validarIntegridadeUpload(arquivo, dto.hashCliente);
    await this.validarNumeroProcessoNoDocumento(arquivo, dto.numeroProcesso);
    return this.decisoesService.registrarDecisao(dto, arquivo.buffer, user.magistradoHash);
  }

  /** Retifica uma decisão existente, preservando o histórico. */
  @Post('retificar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('arquivo', FILE_INTERCEPTOR_OPTIONS))
  @HttpCode(HttpStatus.CREATED)
  async retificar(
    @Body() dto: RetificarDecisaoDto,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: RequestUser,
  ): Promise<RegistrarResultado> {
    if (!arquivo) {
      throw new BadRequestException('Arquivo do documento (campo "arquivo") é obrigatório.');
    }
    this.validarConteudoArquivo(arquivo);
    this.validarIntegridadeUpload(arquivo, dto.hashCliente);
    await this.validarNumeroProcessoNoDocumento(arquivo, dto.numeroProcesso);
    return this.decisoesService.retificarDecisao(dto, arquivo.buffer, user.magistradoHash);
  }

  /**
   * Lista todas as decisões do magistrado autenticado (dashboard de
   * auditoria). Precisa vir ANTES de `GET /:documentHash` na ordem de
   * declaração das rotas — caso contrário, "minhas" seria capturado pelo
   * parâmetro curinga `:documentHash`.
   */
  @Get('minhas')
  @UseGuards(JwtAuthGuard)
  async minhasDecisoes(@CurrentUser() user: RequestUser): Promise<DecisaoConsultada[]> {
    return this.decisoesService.listarPorMagistrado(user.magistradoHash);
  }

  /** Consulta o histórico completo de um número de processo. Leitura pública. */
  @Get('processo/:numeroProcesso')
  async historicoPorProcesso(
    @Param('numeroProcesso') numeroProcesso: string,
  ): Promise<DecisaoConsultada[]> {
    return this.decisoesService.historicoPorProcesso(numeroProcesso);
  }

  /** Consulta os metadados de uma decisão pelo hash do documento. Leitura pública. */
  @Get(':documentHash')
  async buscarPorHash(
    @Param('documentHash') documentHash: string,
  ): Promise<DecisaoConsultada> {
    return this.decisoesService.buscarPorHash(documentHash);
  }

  /** Arquiva uma decisão judicial (status muda para Arquivada). Requer autenticação. */
  @Post(':documentHash/arquivar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async arquivar(
    @Param('documentHash') documentHash: string,
  ): Promise<{ txHash: string; status: number }> {
    return this.decisoesService.arquivarDecisao(documentHash);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /**
   * Confere os bytes reais do arquivo (magic bytes) contra o `mimetype`
   * declarado pelo cliente. O `Content-Type` do multipart é definido pelo
   * próprio cliente e é totalmente forjável — esta é a validação que
   * efetivamente impede o upload de um arquivo arbitrário disfarçado de PDF.
   */
  private validarConteudoArquivo(arquivo: Express.Multer.File): void {
    if (!this.documentoTextoService.validarMagicBytes(arquivo.buffer, arquivo.mimetype)) {
      throw new BadRequestException(
        'O conteúdo do arquivo não corresponde ao tipo declarado. Envie um PDF ou texto simples genuíno.',
      );
    }
  }

  /**
   * Se o cliente enviou um hash calculado localmente (`hashCliente`),
   * confere se ele bate com o hash recalculado a partir dos bytes
   * efetivamente recebidos pelo servidor. Divergência aqui é sinal de
   * corrupção/alteração do arquivo em trânsito (proxy, extensão de
   * navegador, erro de encoding no upload) — não uma checagem de segurança
   * contra um adversário (quem chama a API diretamente controla os dois
   * valores), mas sim de integridade de transporte no caminho legítimo
   * (navegador → backend). Campo opcional: se ausente, esta checagem é
   * simplesmente pulada.
   */
  private validarIntegridadeUpload(arquivo: Express.Multer.File, hashCliente?: string): void {
    if (!hashCliente) return;

    const hashRecalculado = this.decisoesService.calcularHash(arquivo.buffer);
    if (hashRecalculado !== hashCliente) {
      throw new UnprocessableEntityException(
        'O arquivo recebido não corresponde ao hash calculado no seu navegador — ' +
          'pode ter sido alterado ou corrompido durante o envio. Tente enviar novamente.',
      );
    }
  }

  /**
   * Garante que o `numeroProcesso` declarado no formulário realmente aparece
   * no texto do documento enviado. Se não for possível extrair texto do
   * arquivo (ex.: PDF escaneado sem OCR), rejeita de forma conservadora —
   * preferimos um falso positivo de rejeição a aceitar metadados
   * dissociados do conteúdo real do documento.
   */
  private async validarNumeroProcessoNoDocumento(
    arquivo: Express.Multer.File,
    numeroProcesso: string,
  ): Promise<void> {
    const texto = await this.documentoTextoService.extrairTexto(arquivo.buffer, arquivo.mimetype);
    if (texto === null) {
      throw new UnprocessableEntityException(
        'Não foi possível extrair texto do documento para validar o número do processo. ' +
          'Envie um PDF com camada de texto (não apenas imagem escaneada) ou um arquivo .txt.',
      );
    }
    if (!this.documentoTextoService.contemNumeroProcesso(texto, numeroProcesso)) {
      throw new UnprocessableEntityException(
        'O número do processo informado não foi encontrado no conteúdo do documento enviado.',
      );
    }
  }
}
