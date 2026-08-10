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
  hashAnterior: string; // 0x0000... se for registro original
  registradoPor: string; // endereço Ethereum do integrador
  /**
   * Indica se o magistrado que assinou este registro ainda está credenciado
   * HOJE (não no momento do registro). `false` não invalida a decisão, mas
   * é um sinal de auditoria: credenciamento revogado após o registro.
   */
  magistradoAtualmenteCredenciado: boolean;
}

/**
 * Payload enviado pelo frontend para registrar uma nova decisão.
 *
 * NOTA DE SEGURANÇA: não existe mais `documentHash` nem `magistradoHash`
 * aqui — o hash é sempre calculado pelo backend a partir de `arquivo`, e o
 * magistrado é sempre derivado do JWT da sessão autenticada. Isso evita que
 * o cliente possa "inventar" um hash ou se passar por outro magistrado.
 */
export interface RegistrarInput {
  arquivo: File;
  numeroProcesso: string;
  tribunalOrigem: string;
  orgaoJulgador: string;
  canalTransmissao: string;
  /** Detalhamento livre, usado apenas quando canalTransmissao === 'Outro'. */
  canalTransmissaoDetalhe?: string;
  /**
   * Hash SHA-256 já calculado no navegador (prévia local). Enviado junto
   * como checagem de integridade de transporte: o backend confere se bate
   * com o hash recalculado a partir dos bytes recebidos, e rejeita em caso
   * de divergência (arquivo corrompido/alterado em trânsito). Não é o hash
   * autoritativo — quem decide o que vai para a blockchain é sempre o hash
   * recalculado no servidor.
   */
  hashCliente?: string;
}

/** Payload para retificação: igual ao registro, mais a referência ao hash anterior. */
export interface RetificarInput extends RegistrarInput {
  hashAnterior: string;
}
