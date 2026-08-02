/** Status do ciclo de vida de uma decisão no contrato. */
export enum StatusDecisao {
  Inexistente = 0,
  Publicada = 1,
  Retificada = 2,
  Arquivada = 3,
}

/** Metadados completos de uma decisão registrada na blockchain. */
export interface Decisao {
  documentHash: string; // "0x" + 64 hex chars (SHA-256)
  numeroProcesso: string;
  tribunalOrigem: string;
  orgaoJulgador: string;
  magistradoHash: string; // hash do certificado ICP-Brasil
  canalTransmissao: string; // "DJe" | "SEEU" | "Malote Digital" | etc.
  timestamp: number; // Unix epoch (segundos)
  status: StatusDecisao;
  hashAnterior: string | null; // null se registro original
  registradoPor: string; // endereço Ethereum do integrador
}

/** Payload enviado pelo frontend/backend para registrar ou retificar uma decisão. */
export interface DecisaoInput {
  documentHash: string;
  numeroProcesso: string;
  tribunalOrigem: string;
  orgaoJulgador: string;
  magistradoHash: string;
  canalTransmissao: string;
  hashAnterior?: string; // obrigatório apenas em retificações
}
