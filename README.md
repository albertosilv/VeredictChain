# VeredictChain — Registro Imutável de Decisões Judiciais na Blockchain

Legal Tech desenvolvida para a Tarefa Final (ESMA-PB) — Blockchain, Contratos
Inteligentes e Direito. Sistema de registro e verificação de hashes de decisões
judiciais em blockchain, em resposta a casos concretos de falsificação de
acórdãos (Ofício-Circular nº 001/2026/GAPRES-TJPB).

Monorepo com **três módulos**:

```
VeredictChain/
├── contracts/   Smart contract (Solidity + Hardhat) — fonte da verdade
├── backend/     API REST (NestJS) — integra o frontend ao contrato
└── frontend/    Interface web (Angular) — portal público + painel do magistrado
```

## 1. Arquitetura

```
Magistrado autentica-se (JWT) no painel do emissor (frontend)
        |
Frontend envia o ARQUIVO da decisão (multipart) ao backend
        |
Backend (NestJS):
  - valida magic bytes reais do arquivo (não confia no Content-Type do cliente)
  - recalcula o hash SHA-256 a partir dos bytes recebidos
  - confere que o número do processo aparece no conteúdo do documento
  - assina a transação com a carteira do integrador e submete ao contrato
        |
Smart contract (Solidity, VeredictChain.sol):
  - só aceita registros de magistrados credenciados
  - impede duas "originais" ativas para o mesmo processo (força retificação)
  - preserva histórico completo (Publicada -> Retificada -> Arquivada)
        |
Qualquer cidadão consulta publicamente (sem login) via:
  - GET /api/decisoes/:hash            (backend)
  - Dropzone público no frontend        (upload de arquivo -> hash -> consulta)
```

## 2. Contrato (`contracts/contracts/VeredictChain.sol`)

Linguagem: **Solidity `^0.8.20`**.

Funcionalidades:
- `credenciarMagistrado` / `revogarMagistrado` — controle de quem pode assinar
  decisões válidas (via hash do certificado ICP-Brasil).
- `autorizarIntegrador` / `revogarIntegrador` — controle de quais sistemas
  (o backend) podem submeter registros. **`arquivarDecisao` também exige
  `onlyIntegrador`** — é uma operação do fluxo operacional normal, não uma
  ação de governança (`onlyAdmin` é reservado para credenciamento).
- `registrarDecisao` — registra o hash de uma decisão nova com status
  `Publicada`. Rejeita magistrados não credenciados, hashes duplicados, **e
  uma segunda "original" para um processo que já tem decisão ativa** (força
  o uso de retificação, evitando duplicidade/sequestro de número de processo).
- `registrarRetificacao` — registra uma nova versão referenciando
  obrigatoriamente o hash anterior. A versão anterior passa a `Retificada`;
  o histórico completo fica preservado e consultável.
- `arquivarDecisao` — encerra o ciclo de vida do registro (ex: trânsito em
  julgado). Permite reabrir um novo ciclo para o mesmo número de processo.
- `verificarDecisao` — leitura pública: qualquer pessoa informa um hash e
  recebe status + metadados, sem acesso a sistemas internos do tribunal.
- `historicoDoProcesso` — todas as versões (hashes) de um número de processo.

Limites de tamanho de string (`numeroProcesso`, `tribunalOrigem`,
`orgaoJulgador`, `canalTransmissao`) são validados **no próprio contrato**,
não só no backend — protege contra grief de gas/storage mesmo que a chave do
integrador seja comprometida e o contrato seja chamado diretamente.

### Testes (`contracts/scripts/manual-test.js`)

**13 cenários, 13 passando, 0 falhando**, incluindo:
- o caso concreto do Ofício-Circular nº 001/2026 (acórdão falso nunca registrado);
- regressão específica para o bug de privilégio admin/integrador em `arquivarDecisao`
  (topologia realista: admin ≠ integrador);
- bloqueio de segunda "original" para processo com decisão ativa;
- limites de tamanho de string.

```bash
cd contracts
npm install
node scripts/compile.js
HARDHAT_NETWORK=hardhat node scripts/manual-test.js
```

## 3. Backend (`backend/`)

NestJS + `ethers.js` v6. Ver `backend/README.md` para detalhes de setup.

- Autenticação JWT real (não mais mock client-side).
- Hash sempre recalculado no servidor a partir do arquivo recebido.
- Validação de magic bytes reais do upload (não confia no `Content-Type` declarado).
- `numeroProcesso` conferido contra o conteúdo real do documento.
- `magistradoHash` sempre derivado do JWT autenticado, nunca de campo livre do body.
- Rate limiting, `helmet()`, CORS restrito por origem.
- Dashboard de auditoria real (`GET /api/decisoes/minhas`), usando eventos do
  contrato — não uma lista fixa de processos.

## 4. Frontend (`frontend/`)

Angular 22 (standalone components, signals) + Tailwind v4. Ver `frontend/README.md`.

- Zona pública (`/`): Dropzone para verificar autenticidade de um documento.
- Zona autenticada (`/emissor/*`): login, registrar, retificar, consultar,
  arquivar, dashboard "Minhas Decisões" (com alerta de auditoria quando um
  magistrado é revogado após já ter registros ativos).

## 5. Rede blockchain

A proposta acadêmica (`VeredictChain_proposta.pdf`) escolhe a **Rede
Blockchain do Brasil (RBB)**, permissionada, para produção. O ambiente de
desenvolvimento/demonstração aqui usa **Hardhat Network local** (chain id
`31337`), com scripts já prontos para **Sepolia** (testnet pública Ethereum)
caso se queira demonstrar em rede real:

```bash
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/SEU_PROJECT_ID"
export PRIVATE_KEY="0xSUACHAVEPRIVADA_DE_TESTE"
cd contracts && npx hardhat run scripts/deploy.js --network sepolia
```

## 6. Como rodar tudo localmente

```bash
# 1) Rede blockchain local
cd contracts
npm install
npx hardhat node                                        # terminal 1, deixa rodando

# 2) Deploy do contrato (terminal 2)
cd contracts
HARDHAT_NETWORK=localhost node scripts/manual-deploy.js
# anote o "Endereco do contrato" impresso

# 3) Backend (terminal 3)
cd backend
npm install
cp .env.hardhat .env
# edite .env: VEREDICTCHAIN_ADDRESS=<endereço do passo 2>
npm run start:dev

# 4) Frontend (terminal 4)
cd frontend
npm install
npm start
```

## 7. Documentação relacionada

- `contracts/agent_docs/` — especificações internas por área (contrato,
  hash/frontend, segurança de backend).
- `contracts/docs/` — diagramas de arquitetura e classe.
