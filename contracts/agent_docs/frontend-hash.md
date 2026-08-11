# Frontend Hash — VeredictChain


## Modelo atual: hash sempre recalculado no servidor

O frontend **ainda** calcula um hash localmente com a Web Crypto API — mas
isso hoje serve só como **prévia de UX** (mostrar ao magistrado o hash antes
de enviar), não como o valor que é de fato registrado na blockchain.

O fluxo real de envio é:

1. O frontend envia o **arquivo completo** (não só o hash) via
   `multipart/form-data` para `POST /api/decisoes` (ou `/retificar`).
2. O **backend** recalcula o SHA-256 a partir dos bytes efetivamente
   recebidos (`DecisoesService.calcularHash`, em Node.js `crypto`).
3. O backend também confere magic bytes reais do arquivo e se o
   `numeroProcesso` declarado aparece no texto do documento, antes de
   registrar.
4. Só o hash calculado pelo **backend** é submetido ao contrato.


## Cálculo de hash no cliente (prévia de UX)

Ainda usado para mostrar uma prévia visual ao magistrado antes do envio —
`HashService` no Angular, via **Web Crypto API** (`window.crypto.subtle.digest`).

### Algoritmo

- **SHA-256** (o contrato usa `bytes32` genérico, não `keccak256`)
- Formato de saída: `"0x" + 64 hex chars`

### Exemplo de código (Angular) — apenas para prévia

```typescript
async function hashDocument(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hashHex;
}
```

### Atenção

- **Sempre** use `window.crypto.subtle.digest` no cliente — nunca bibliotecas
  externas (crypto-js, etc.) — reduz risco de supply-chain.
- **O hash calculado no cliente NÃO é o valor autoritativo.** O backend
  sempre recalcula a partir do arquivo recebido — é esse valor que vai
  para o contrato.
- No backend, ver `backend-security.md` para o cálculo equivalente em Node.js.

## Checagem de integridade de transporte (hashCliente)

O hash calculado no cliente também é enviado ao backend como campo opcional
`hashCliente` no `FormData`. O backend confere se ele bate com o hash
recalculado a partir dos bytes recebidos; se divergir, rejeita o registro
com `422` — sinal de que o arquivo foi corrompido/alterado em trânsito
(proxy, extensão de navegador, erro de encoding), evitando registrar
silenciosamente um documento diferente do que o magistrado pensava estar
enviando.

**Isso não é um controle de segurança contra um adversário** (quem chama a
API diretamente controla os dois valores) — é uma checagem de integridade
para o caminho legítimo navegador → backend. A proteção contra hash forjado
continua sendo, exclusivamente, o recálculo obrigatório no servidor.
