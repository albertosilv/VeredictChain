import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { DecisoesService } from '../decisoes/decisoes.service';

/**
 * MOCK DE INTEGRAÇÃO — SEEU / PJe / outros sistemas receptores.
 *
 * Este controller NÃO se conecta a nenhum sistema real do Judiciário. Ele
 * documenta e simula o formato de integração que o requisito do projeto
 * pede explicitamente ("integração via API com SEI ou PJe — mock aceito
 * com descrição da integração real").
 *
 * COMO FUNCIONARIA NA INTEGRAÇÃO REAL:
 * Um sistema receptor como o SEEU, ao receber uma decisão via Malote
 * Digital/DJe/outro canal, chamaria um endpoint equivalente a este
 * automaticamente, ANTES de incorporar o documento ao processo interno.
 * Se `aceitar` vier `false`, o documento seria bloqueado e sinalizado como
 * suspeito — exatamente o cenário descrito no Ofício-Circular nº 001/2026
 * (acórdão falso atribuído ao STJ, cujo hash nunca existiria na blockchain).
 *
 * A autenticação dessa chamada em produção seria feita via um mecanismo de
 * confiança entre sistemas (ex.: mTLS, API key dedicada por tribunal
 * integrado), não pelo JWT de magistrado usado no resto da API — está fora
 * do escopo mockado aqui.
 */
export class ValidarRecebimentoDto {
  /** Hash SHA-256 do documento recebido pelo sistema receptor. */
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'documentHash deve ser "0x" + 64 caracteres hex',
  })
  documentHash!: string;

  /** Identificador do sistema receptor simulado (ex.: "SEEU-TJPB"). */
  @IsString()
  sistemaOrigem!: string;
}

export interface ValidarRecebimentoResultado {
  aceitar: boolean;
  motivo: string;
  documentHash: string;
  metadados?: {
    numeroProcesso: string;
    tribunalOrigem: string;
    magistradoHash: string;
    status: number;
  };
}

@Controller('api/integracoes/seeu')
export class IntegracaoSeeuMockController {
  constructor(private readonly decisoesService: DecisoesService) {}

  /**
   * Simula a validação automática que um sistema receptor (ex.: SEEU) faria
   * antes de aceitar um documento recebido. Sem autenticação de magistrado
   * — esta rota representa uma chamada sistema-a-sistema, não uma ação de
   * um usuário humano.
   */
  @Post('validar-recebimento')
  @HttpCode(HttpStatus.OK)
  async validarRecebimento(
    @Body() dto: ValidarRecebimentoDto,
  ): Promise<ValidarRecebimentoResultado> {
    try {
      const decisao = await this.decisoesService.buscarPorHash(dto.documentHash);
      return {
        aceitar: true,
        motivo: `Hash encontrado na blockchain — decisão autêntica de ${decisao.tribunalOrigem}.`,
        documentHash: dto.documentHash,
        metadados: {
          numeroProcesso: decisao.numeroProcesso,
          tribunalOrigem: decisao.tribunalOrigem,
          magistradoHash: decisao.magistradoHash,
          status: decisao.status,
        },
      };
    } catch {
      // Hash não encontrado (ou qualquer erro de consulta): postura
      // conservadora — bloquear e sinalizar, nunca aceitar por omissão.
      return {
        aceitar: false,
        motivo:
          'Hash não encontrado na blockchain. Documento BLOQUEADO — não foi assinado ' +
          'por nenhum magistrado credenciado, ou foi adulterado após a assinatura.',
        documentHash: dto.documentHash,
      };
    }
  }
}
