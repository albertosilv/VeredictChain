import {
  IsString,
  IsOptional,
  Matches,
  IsIn,
  MaxLength,
} from 'class-validator';

/** DTO para registro de nova decisão judicial. */
export class RegistrarDecisaoDto {
  /** Hash SHA-256 do documento: "0x" + 64 hex chars */
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'documentHash deve ser "0x" + 64 caracteres hex',
  })
  documentHash!: string;

  /** Número do processo no formato CNJ */
  @IsString()
  @MaxLength(30)
  numeroProcesso!: string;

  /** Tribunal de origem (ex: TJPB, STJ) */
  @IsString()
  @MaxLength(20)
  tribunalOrigem!: string;

  /** Órgão julgador (ex: 1ª Vara Cível) */
  @IsString()
  @MaxLength(60)
  orgaoJulgador!: string;

  /** Hash do certificado ICP-Brasil do magistrado */
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'magistradoHash deve ser "0x" + 64 caracteres hex',
  })
  magistradoHash!: string;

  /** Canal de transmissão (DJe, SEEU, Malote Digital, PJe, e-SAJ, etc.) */
  @IsString()
  @IsIn(['DJe', 'SEEU', 'Malote Digital', 'PJe', 'e-SAJ', 'Outro'])
  canalTransmissao!: string;
}

/** DTO para retificação de decisão existente. */
export class RetificarDecisaoDto extends RegistrarDecisaoDto {
  /** Hash da decisão anterior (obrigatório para retificações) */
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'hashAnterior deve ser "0x" + 64 caracteres hex',
  })
  hashAnterior!: string;
}
