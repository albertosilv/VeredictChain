import { StatusDecisao } from '../models/decisao.model';

/**
 * Fonte única de verdade para rótulos, classes CSS e ícones associados a
 * cada status de decisão. Antes, cada um dos 4 componentes que exibiam
 * status (dropzone, consultar, minhas-decisoes, retificar) redefinia essas
 * tabelas de forma independente e ligeiramente inconsistente entre si —
 * risco real de divergência se um novo status fosse adicionado ao contrato
 * e alguém esquecesse de atualizar um dos quatro lugares.
 */
export const STATUS_LABELS: Record<number, string> = {
  [StatusDecisao.Inexistente]: 'Inexistente',
  [StatusDecisao.Publicada]: 'Publicada',
  [StatusDecisao.Retificada]: 'Retificada',
  [StatusDecisao.Arquivada]: 'Arquivada',
};

export const STATUS_CLASSES: Record<number, string> = {
  [StatusDecisao.Inexistente]: 'status-inexistente',
  [StatusDecisao.Publicada]: 'status-publicada',
  [StatusDecisao.Retificada]: 'status-retificada',
  [StatusDecisao.Arquivada]: 'status-arquivada',
};

export const STATUS_ICONS: Record<number, string> = {
  [StatusDecisao.Inexistente]: '❔',
  [StatusDecisao.Publicada]: '📄',
  [StatusDecisao.Retificada]: '🔄',
  [StatusDecisao.Arquivada]: '📁',
};

export function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? 'Desconhecido';
}

export function statusClass(status: number): string {
  return STATUS_CLASSES[status] ?? '';
}

export function statusIcon(status: number): string {
  return STATUS_ICONS[status] ?? '❔';
}
