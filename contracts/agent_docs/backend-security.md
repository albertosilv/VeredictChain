# Backend Security — VeredictChain

## Carteira do Integrador

O backend NestJS atua como **Integrador Autorizado** — é o único que pode assinar transações
para `registrarDecisao` e `registrarRetificacao`.

### Regras críticas

- **Nunca** exponha `INTEGRADOR_PRIVATE_KEY` em logs, respostas HTTP ou commits
- Use `@nestjs/config` para carregar a chave privada de `.env` **não versionado**
- A chave **nunca** deve trafegar para o frontend
- Use `ethers` v6 com `Wallet` + `JsonRpcProvider` para assinar transações

### Configuração esperada (.env)

```
RPC_URL=<URL do nó blockchain>
CHAIN_ID=<chain ID>
INTEGRADOR_PRIVATE_KEY=<chave privada sem 0x>
VEREDICTCHAIN_ADDRESS=<endereço do contrato deployado>
```

### Fluxo de assinatura

1. Frontend envia documento + metadados para o backend
2. Backend calcula SHA-256 do documento
3. Backend chama `registrarDecisao` no contrato via `Wallet.signTransaction`
4. Backend retorna o `txHash` e o `documentHash` ao frontend

### Ataques a mitigar

- Replay attack: o nonce é gerenciado pelo `ethers` automaticamente
- Front-running: validar se o hash já existe antes de submeter
- Exposição de chave: `.env` no `.gitignore`, usar secret manager em produção
