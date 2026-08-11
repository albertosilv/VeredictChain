import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

/**
 * Extrai texto de documentos e valida se metadados declarados (como o número
 * do processo) realmente aparecem no conteúdo do arquivo.
 *
 * MOTIVAÇÃO DE SEGURANÇA: o hash SHA-256 garante a integridade do arquivo,
 * mas por si só não garante que os METADADOS enviados junto (numeroProcesso,
 * tribunalOrigem, etc.) correspondem ao que está de fato escrito dentro do
 * documento — são campos de formulário independentes do conteúdo do PDF.
 * Sem esta verificação, alguém com credencial válida poderia registrar um
 * documento genuíno associando-o a um número de processo arbitrário
 * (inclusive de um processo que não é o dele), "sequestrando" aquele número
 * na blockchain. Esta checagem reduz — não elimina — esse risco, exigindo
 * que o número declarado apareça de fato no texto do documento enviado.
 */
@Injectable()
export class DocumentoTextoService {
  private readonly logger = new Logger(DocumentoTextoService.name);

  /**
   * Confere se os bytes do arquivo realmente correspondem ao `mimetypeDeclarado`.
   *
   * MOTIVAÇÃO DE SEGURANÇA: `file.mimetype` no Multer vem do cabeçalho
   * `Content-Type` da parte multipart — definido pelo próprio CLIENTE, logo
   * totalmente forjável. Sem esta checagem, um atacante poderia declarar
   * `Content-Type: application/pdf` e enviar qualquer outro tipo de arquivo
   * (executável, script, etc.), que passaria pelo `fileFilter` do Multer sem
   * problema. Aqui inspecionamos a assinatura binária real do início do arquivo.
   */
  validarMagicBytes(buffer: Buffer, mimetypeDeclarado: string): boolean {
    if (mimetypeDeclarado === 'application/pdf') {
      // Todo PDF válido começa literalmente com os bytes "%PDF-".
      const assinaturaPdf = Buffer.from('%PDF-', 'ascii');
      return buffer.subarray(0, assinaturaPdf.length).equals(assinaturaPdf);
    }
    if (mimetypeDeclarado === 'text/plain') {
      // Não há "magic bytes" formais para texto puro. Rejeitamos o que
      // claramente NÃO é texto: presença de byte nulo (comum em binários),
      // ou o arquivo começar com a assinatura de um PDF (mimetype mentindo
      // para o lado contrário: um PDF disfarçado de texto).
      const assinaturaPdf = Buffer.from('%PDF-', 'ascii');
      const comecaComPdf = buffer.subarray(0, assinaturaPdf.length).equals(assinaturaPdf);
      const contemByteNulo = buffer.subarray(0, Math.min(buffer.length, 8000)).includes(0x00);
      return !comecaComPdf && !contemByteNulo;
    }
    // Mimetypes não suportados nunca deveriam chegar aqui (já bloqueados
    // pelo fileFilter do Multer) — postura conservadora: rejeitar.
    return false;
  }

  /**
   * Extrai o texto do documento de acordo com seu mimetype.
   * Retorna `null` se o formato não é suportado para extração de texto
   * (ex.: PDF puramente escaneado sem camada de texto/OCR) — nesse caso,
   * o chamador deve tratar como "não foi possível validar" e ser conservador.
   */
  async extrairTexto(buffer: Buffer, mimetype: string): Promise<string | null> {
    try {
      if (mimetype === 'application/pdf') {
        const parser = new PDFParse({ data: buffer });
        try {
          const resultado = await parser.getText();
          return resultado.text;
        } finally {
          await parser.destroy();
        }
      }
      if (mimetype === 'text/plain') {
        return buffer.toString('utf-8');
      }
      return null;
    } catch (err) {
      this.logger.warn(`Falha ao extrair texto do documento (${mimetype}): ${String(err)}`);
      return null;
    }
  }

  /**
   * Verifica se `numeroProcesso` aparece no texto do documento.
   * Normaliza separadores comuns (pontos, traços, espaços) para tolerar
   * pequenas diferenças de formatação (ex.: quebras de linha no meio do
   * número) sem abrir mão do rigor da comparação.
   */
  contemNumeroProcesso(texto: string, numeroProcesso: string): boolean {
    const normalizar = (s: string) => s.replace(/[.\-\s]/g, '');
    const textoNormalizado = normalizar(texto);
    const numeroNormalizado = normalizar(numeroProcesso);
    return numeroNormalizado.length > 0 && textoNormalizado.includes(numeroNormalizado);
  }
}
