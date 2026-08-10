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

1. Magistrado autentica-se via `POST /api/auth/login` (usuário/senha mock,
   validados com `bcrypt`) e recebe um JWT contendo seu `magistradoHash`.
2. Frontend envia o documento (arquivo completo, multipart) + metadados +
   header `Authorization: Bearer <JWT>` para o backend.
3. Backend:
   - valida o JWT (`JwtAuthGuard`) — sem token válido, `401` antes de
     qualquer processamento;
   - confere os magic bytes reais do arquivo contra o `Content-Type`
     declarado (`DocumentoTextoService.validarMagicBytes`) — nunca confia
     só no header do cliente;
   - extrai texto do documento (PDF via `pdf-parse`, ou `.txt` puro) e
     confirma que o `numeroProcesso` declarado aparece no conteúdo real;
   - calcula o SHA-256 do documento (Node.js `crypto`) — este é o hash
     autoritativo, não o calculado pelo frontend;
   - deriva `magistradoHash` do JWT, nunca de um campo livre do body.
4. Backend chama `registrarDecisao`/`registrarRetificacao` no contrato via
   `Wallet.signTransaction` (carteira do integrador).
5. Backend retorna o `txHash` e o `documentHash` ao frontend.

### Dependência: `pdf-parse`

Usada em `DocumentoTextoService.extrairTexto` para extrair o texto de PDFs
enviados, permitindo validar que os metadados declarados (número do
processo) correspondem ao conteúdo real do documento. Processa bytes
enviados por qualquer usuário autenticado — considerar isolamento/timeout
adicional antes de produção 

### Ataques a mitigar

- Replay attack: o nonce é gerenciado pelo `ethers` automaticamente
- Front-running: validar se o hash já existe antes de submeter (feito pelo
  próprio contrato via `require`)
- Exposição de chave: `.env` no `.gitignore`, usar secret manager em produção
- Falsificação de identidade: `magistradoHash` nunca aceito como campo livre
  do body — sempre derivado do JWT autenticado
- Hash forjado sem posse do documento: hash sempre recalculado no backend a
  partir dos bytes recebidos, nunca aceito pronto do cliente
- Upload de arquivo malicioso disfarçado: magic bytes reais conferidos, não
  só o `Content-Type` declarado pelo cliente
- `JWT_SECRET` fraco/padrão: `main.ts` recusa iniciar em produção
  (`NODE_ENV=production`) sem a variável de ambiente explicitamente definida
