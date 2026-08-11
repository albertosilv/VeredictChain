# VeredictChain — Smart Contract e Arquitetura

Entregável da Tarefa Final (ESMA-PB): diagrama de arquitetura + contrato inteligente
desenvolvido em **Solidity** e implantado em rede de testes.

---

## 🚀 Como rodar tudo localmente (Guia rápido)

São 4 terminais. Abra-os na raiz do projeto e siga a ordem.

### 1. Iniciar o nó blockchain local

```bash
cd contracts
npm install
npx hardhat node
```

Deixe esse terminal rodando. Você verá 20 contas pré-financiadas e o nó ouvindo em `http://127.0.0.1:8545`.

### 2. Fazer o deploy do contrato no nó local

```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

> ☝️ **Importante**: `--network localhost` conecta ao nó que está rodando no terminal 1.
> Não use `--network hardhat` — ele criaria uma rede efêmera separada e o deploy se perderia.

Copie o endereço que aparecer na linha `VeredictChain deployado em: 0x...`.

### 3. Configurar e iniciar o backend

```bash
cd backend
npm install
```

Edite `backend/.env` e cole o endereço do contrato:

```env
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
VEREDICTCHAIN_ADDRESS=<COLE AQUI O ENDEREÇO DO PASSO 2>
INTEGRADOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PORT=3000
```

> ℹ️ A chave privada acima é a conta #0 do nó Hardhat — **sempre a mesma** para desenvolvimento local.

Depois inicie:

```bash
npm run start:dev
```

Backend rodando em `http://localhost:3000`.

### 4. Iniciar o frontend

```bash
cd frontend
npm install
ng serve
```

Acesse `http://localhost:4200` no navegador.

---

### Resumo do fluxo

```
Terminal 1: contracts/   $ npx hardhat node
Terminal 2: contracts/   $ npx hardhat run scripts/deploy.js --network localhost
Terminal 3: backend/     $ npm run start:dev
Terminal 4: frontend/    $ ng serve
```

### Alternar entre redes (Hardhat ↔ Besu)

```bash
./switch-network.sh hardhat   # desenvolvimento local
./switch-network.sh besu      # rede Besu da disciplina
```

---

## Arquitetura (resumo)

```
Magistrado assina a decisão (certificado ICP-Brasil)
        |
Módulo de integração -> calcula hash SHA-256 + metadados
        |
Rede Blockchain do Brasil (RBB) -> smart contract VeredictChain
        |                                   |
Sistema receptor (SEEU/PJe)         Interface pública de verificação
valida hash antes do cumprimento    qualquer cidadão confere o hash
```

O diagrama completo foi enviado na conversa (arquitetura_veredictchain).

## Contrato (`contracts/VeredictChain.sol`)

Linguagem: **Solidity `^0.8.20`**.

Funcionalidades implementadas:
- `credenciarMagistrado` / `revogarMagistrado` — controle de quem pode assinar decisões válidas (via hash do certificado ICP-Brasil).
- `autorizarIntegrador` / `revogarIntegrador` — controle de quais sistemas (ex: módulo de publicação do TJPB) podem submeter registros.
- `registrarDecisao` — registra o hash de uma decisão nova com status `Publicada`. Rejeita automaticamente hashes de magistrados não credenciados.
- `registrarRetificacao` — registra uma nova versão referenciando obrigatoriamente o hash anterior (embargos de declaração, correção material). A versão anterior passa a `Retificada`; o histórico completo fica preservado e consultável.
- `arquivarDecisao` — encerra o ciclo de vida do registro (ex: trânsito em julgado).
- `verificarDecisao` — função pública de leitura: qualquer pessoa (parte, advogado, cidadão, sistema receptor) informa um hash e recebe status + metadados, sem precisar de acesso a sistemas internos do tribunal.
- `historicoDoProcesso` — retorna todas as versões (hashes) associadas a um número de processo, na ordem em que foram registradas.

## Testes (`test/VeredictChain.test.js` e `scripts/manual-test.js`)

7 cenários cobertos, incluindo o caso concreto do Ofício-Circular nº 001/2026/GAPRES-TJPB
(acórdão falso atribuído ao STJ: seu hash nunca existirá na blockchain porque nunca foi
assinado por um magistrado credenciado — logo, seria bloqueado pelo sistema receptor).

Resultado: **7 passando, 0 falhando** (ver `deploy-log.txt` e `test-log.txt`).

## Deploy realizado (rede de testes)

O contrato foi **compilado e implantado com sucesso** na **Hardhat Network**
(EVM local, chain id `31337`) — uma rede de testes real (mesma tecnologia usada para testar
contratos antes de ir a produção), com endereço de contrato, transações e eventos reais.
Ver evidência completa em `deploy-log.txt`.

### Por que não uma testnet pública (Sepolia) diretamente aqui?
Este ambiente de execução não tem acesso de rede a provedores de RPC (Infura/Alchemy) nem à
internet pública em geral — só a alguns domínios de pacotes (npm, PyPI, GitHub). Por isso o
deploy "ao vivo" foi feito na rede de testes local do Hardhat, que é o padrão de mercado para
desenvolvimento e testes de contratos antes do deploy público.

### Como fazer vocês mesmos o deploy em Sepolia (testnet pública Ethereum)
Os scripts já estão prontos para isso — basta:

1. Criar uma conta em um provedor de RPC gratuito (ex: Infura ou Alchemy) e pegar a URL da rede Sepolia.
2. Criar uma carteira de teste (ex: no MetaMask) e pegar ETH de teste em um faucet de Sepolia.
3. Definir as variáveis de ambiente:
   ```
   export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/SEU_PROJECT_ID"
   export PRIVATE_KEY="0xSUACHAVEPRIVADA_DE_TESTE"
   ```
4. Rodar:
   ```
   npx hardhat run scripts/deploy.js --network sepolia
   ```
   (O `hardhat.config.js` já tem a rede `sepolia` configurada.)
5. O endereço do contrato aparecerá no terminal e poderá ser conferido publicamente no
   [Sepolia Etherscan](https://sepolia.etherscan.io).

> Observação: neste projeto acadêmico, a integração real com SEEU/PJe e a rede permissionada
> RBB (mencionadas na proposta) seriam a infraestrutura de produção. Sepolia/Hardhat servem
> aqui como prova de conceito funcional do smart contract e seu ciclo de vida.

## Como rodar os testes isoladamente (sem backend/frontend)

```bash
npm install
node scripts/compile.js                              # compila o contrato (solc via npm)
HARDHAT_NETWORK=hardhat node scripts/manual-test.js   # roda os 7 testes
HARDHAT_NETWORK=hardhat node scripts/manual-deploy.js # deploy + demonstração funcional
```

## Estrutura de arquivos

```
contracts/VeredictChain.sol   -> contrato Solidity
contracts/scripts/compile.js            -> compilação via solc (npm), sem dependências externas
contracts/scripts/manual-deploy.js      -> deploy na Hardhat Network + demo funcional
contracts/scripts/manual-test.js        -> suíte de 7 testes
contracts/scripts/deploy.js             -> versão "padrão" via CLI hardhat (para uso em Sepolia)
contracts/test/VeredictChain.test.js    -> mesma suíte em formato hardhat/mocha (para CI/CD futuro)
contracts/hardhat.config.js             -> config de redes (hardhat local + sepolia)
contracts/deploy-log.txt                -> evidência real do deploy (endereço, tx hash, eventos)
contracts/test-log.txt                  -> evidência real dos 7 testes passando
backend/                                -> API NestJS (porta 3000)
frontend/                               -> SPA Angular (porta 4200)
switch-network.sh                       -> alterna backend entre Hardhat e Besu
```
- `contracts/docs/` — diagramas de arquitetura e classe.
