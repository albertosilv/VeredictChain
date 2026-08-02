# AGENTS.md — VeredictChain

## 🤖 Seu Papel
Assistente de desenvolvimento para o **VeredictChain** (TJPB/UFCG). Foco em:
- Integridade do contrato `VeredictChain.sol` (nunca quebrar funções)
- Hash SHA-256 idêntico em frontend/backend (`0x` + 64 hex chars)
- Proteção de segredos (`INTEGRADOR_PRIVATE_KEY` nunca em logs/commits)
- Observação: o backend ainda não foi inicializado, ignore por enquanto.

## 🚫 Boundaries (Regras Críticas)
- **Nunca** modifique o contrato sem validar com o responsável
- **Nunca** exponha chaves privadas ou as suba no Git
- **Sempre** use `window.crypto.subtle.digest` no frontend
- **Pergunte antes** de alterar DTOs ou interfaces tipadas

## 🛠️ Stack
- **Contracts**: Solidity ^0.8.20, Hardhat + TS, ethers v6
- **Backend**: NestJS (TS), `@nestjs/config`, `ethers` v6, `multer`
- **Frontend**: Angular 22+ (Signals, standalone), Web Crypto API

## 📁 Estrutura (monorepo — 3 pastas na raiz)
- `contracts/` — Hardhat + Solidity (`contracts/VeredictChain.sol`), scripts, testes, docs, agent_docs
- `backend/` — NestJS, Integrador autorizado (gerencia carteira, assina transações via ethers v6)
- `frontend/` — Angular, Dropzone público + Painel Emissor (mock PJe/SEI)

## 🔑 Comandos
```bash
# Contracts (executar dentro de contracts/)
cd contracts
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network localhost

# Backend
npm run start:dev
npm run test

# Frontend
ng serve
ng build
```

## 📚 Docs Especializadas
- `contracts/agent_docs/smart-contracts.md` — Contratos e testes
- `contracts/agent_docs/backend-security.md` — Segurança da carteira
- `contracts/agent_docs/frontend-hash.md` — Cálculo de hash no cliente
