# Frontend Hash — VeredictChain

## Cálculo de Hash no Cliente

O hash do documento é calculado **exclusivamente no frontend** usando a **Web Crypto API**
(`window.crypto.subtle.digest`).

### Por quê?

- O documento nunca deve trafegar em texto plano para o backend
- O hash é a "impressão digital" do documento — somente ele é enviado
- Garante que o backend e o contrato trabalhem com o mesmo hash sem expor conteúdo

### Algoritmo

- **SHA-256** (mesmo do Solidity `keccak256`? **Não!** O contrato usa `bytes32` genérico,
  então usamos SHA-256 puro.)
- Formato de saída: `"0x" + 64 hex chars`

### Exemplo de código (Angular)

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

- **Sempre** use `window.crypto.subtle.digest` — nunca use bibliotecas externas (crypto-js, etc.)
- O hash gerado no frontend **precisa ser idêntico** ao hash gerado no backend para o mesmo arquivo
- Teste com um arquivo binário conhecido para garantir consistência entre frontend e backend
