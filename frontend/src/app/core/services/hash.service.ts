import { Injectable } from '@angular/core';

/**
 * Serviço de hash SHA-256 via Web Crypto API.
 *
 * Regra crítica (AGENTS.md):
 * SEMPRE usar `window.crypto.subtle.digest` — nunca bibliotecas externas.
 * O hash gerado aqui precisa ser idêntico ao hash gerado no backend
 * para o mesmo arquivo binário.
 */
@Injectable({ providedIn: 'root' })
export class HashService {
  /**
   * Calcula o SHA-256 de um arquivo e retorna no formato `0x` + 64 hex chars.
   */
  async hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    return this.bufferToHex(hashBuffer);
  }

  /**
   * Calcula o SHA-256 de uma string (ex: para hash de metadados combinados).
   */
  async hashString(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return this.bufferToHex(hashBuffer);
  }

  /** Converte ArrayBuffer → "0x" + hex */
  private bufferToHex(buffer: ArrayBuffer): string {
    const bytes = Array.from(new Uint8Array(buffer));
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return '0x' + hex;
  }
}
