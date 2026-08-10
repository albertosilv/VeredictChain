import { IsString, IsOptional, IsNotEmpty, Matches, IsIn, MaxLength } from 'class-validator';

/**
 * DTO para registro de nova decisão judicial.
 *
 * NOTA DE SEGURANÇA: `documentHash` e `magistradoHash` foram removidos
 * deste DTO de propósito.
 * - `documentHash` agora é sempre calculado pelo próprio backend a partir
 *   dos bytes do arquivo enviado (ver DecisoesController), nunca aceito
 *   como valor pronto vindo do cliente — isso impede que alguém registre
 *   um hash que não corresponda a nenhum documento real.
 * - `magistradoHash` agora vem exclusivamente do JWT do usuário autenticado
 *   (ver AuthService / JwtStrategy), nunca de um campo livre do body —
 *   isso impede que alguém registre uma decisão em nome de um magistrado
 *   que não é o autor da requisição.
 */
export class RegistrarDecisaoDto {
  /** Número do processo no formato CNJ */
  @IsString()
  @IsNotEmpty({ message: 'numeroProcesso não pode ser vazio' })
  @MaxLength(30)
  numeroProcesso!: string;

  /** Tribunal de origem (ex: TJPB, STJ) */
  @IsString()
  @IsNotEmpty({ message: 'tribunalOrigem não pode ser vazio' })
  @MaxLength(20)
  tribunalOrigem!: string;

  /** Órgão julgador (ex: 1ª Vara Cível) */
  @IsString()
  @IsNotEmpty({ message: 'orgaoJulgador não pode ser vazio' })
  @MaxLength(60)
  orgaoJulgador!: string;

  /** Canal de transmissão (DJe, SEEU, Malote Digital, PJe, e-SAJ, ou "Outro") */
  @IsString()
  @IsIn(['DJe', 'SEEU', 'Malote Digital', 'PJe', 'e-SAJ', 'Outro'])
  canalTransmissao!: string;

  /**
   * Detalhamento livre do canal, usado apenas quando `canalTransmissao === 'Outro'`.
   * Sem isso, a informação de qual canal foi realmente usado se perdia — o
   * backend compõe o valor final enviado ao contrato como "Outro: <detalhe>".
   */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  canalTransmissaoDetalhe?: string;

  /**
   * Hash SHA-256 calculado no CLIENTE (navegador), opcional — usado apenas
   * como checagem de integridade de transporte: se divergir do hash
   * recalculado pelo backend a partir dos bytes efetivamente recebidos, é
   * sinal de que o arquivo foi corrompido/alterado em trânsito (proxy,
   * extensão de navegador, erro de encoding), e o registro é recusado antes
   * de gastar uma transação. NÃO É o hash autoritativo — quem decide o que
   * vai para a blockchain é sempre o hash recalculado no servidor.
   */
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'hashCliente deve ser "0x" + 64 caracteres hex',
  })
  hashCliente?: string;
}

/** DTO para retificação de decisão existente. */
export class RetificarDecisaoDto extends RegistrarDecisaoDto {
  /** Hash da decisão anterior (obrigatório para retificações) */
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'hashAnterior deve ser "0x" + 64 caracteres hex',
  })
  hashAnterior!: string;
}
