# Diagrama de Arquitetura — VeredictChain (atualizado)

```mermaid
graph TD

%% ═══════════════════════════════════════════════════════
%% ESTILOS
%% ═══════════════════════════════════════════════════════
classDef frontend fill:#e3f2fd,stroke:#1976d2,stroke-width:2px;
classDef backend fill:#fff3e0,stroke:#ef6c00,stroke-width:2px;
classDef blockchain fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
classDef browser fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;


%% ═══════════════════════════════════════════════════════
%% 1. FRONTEND — Angular 22 (standalone, signals)
%% ═══════════════════════════════════════════════════════
subgraph FRONTEND["🖥️ Frontend — Angular 22"]
  direction TB

  subgraph PUBLIC["🌐 Área Pública"]
    DROP["Dropzone<br/>Upload + SHA-256"]:::browser
    VERIF["Verificação<br/>(em breve)"]:::browser
  end

  subgraph EMISSOR["🔐 Painel Emissor — /emissor"]
    LOGIN["Login Mock<br/>magistrado / tjpB2026"]:::frontend
    REG["Formulário de Registro<br/>• Upload do documento<br/>• Hash automático (Web Crypto)<br/>• Metadados do processo"]:::frontend
    CONSULTA["Consulta de Processo<br/>(em breve)"]:::frontend
  end

  LOGIN -->|"autentica"| REG
  DROP -->|"calcula SHA-256"| DROP
  REG -->|"calcula SHA-256"| REG
end


%% ═══════════════════════════════════════════════════════
%% 2. BACKEND — NestJS
%% ═══════════════════════════════════════════════════════
subgraph BACKEND["⚙️ Backend — NestJS (Integrador Autorizado)"]
  API["API REST :3000<br/>POST /api/decisoes<br/>POST /api/decisoes/retificar"]:::backend
  VAL["ValidationPipe<br/>class-validator<br/>DTOs tipados"]:::backend
  WALLET["Carteira do Integrador<br/>ethers.Wallet<br/>INTEGRADOR_PRIVATE_KEY"]:::backend
  CONTRACT["ethers.Contract<br/>VeredictChain"]:::backend

  API --> VAL
  VAL --> WALLET
  WALLET -->|"signTransaction"| CONTRACT
end


%% ═══════════════════════════════════════════════════════
%% 3. BLOCKCHAIN
%% ═══════════════════════════════════════════════════════
subgraph CHAIN["⛓️ Blockchain (Hardhat / Ethereum)"]
  SC["VeredictChain.sol"]:::blockchain
  STORAGE[("Registro Imutável<br/>• documentHash (SHA-256)<br/>• numeroProcesso<br/>• tribunalOrigem<br/>• orgaoJulgador<br/>• magistradoHash (ICP-Brasil)<br/>• canalTransmissao<br/>• status (Publicada / Retificada / Arquivada)<br/>• timestamp<br/>• hashAnterior")]:::blockchain

  SC <--> STORAGE
end


%% ═══════════════════════════════════════════════════════
%% FLUXOS
%% ═══════════════════════════════════════════════════════

%% ── Registro de Decisão ──
REG -->|"POST /api/decisoes<br/>{ documentHash, metadados }"| API
CONTRACT -->|"registrarDecisao(hash, ...)"| SC
SC -->|"txHash"| CONTRACT
API -->|"201 { txHash, documentHash }"| REG

%% ── Verificação Pública ──
DROP -.->|"(em breve)<br/>verificarDecisao(hash)"| SC
SC -.->|"Status + Metadados"| VERIF

%% ── Retificação ──
REG -->|"POST /api/decisoes/retificar<br/>{ novoHash, hashAnterior, ... }"| API
CONTRACT -->|"registrarRetificacao(...)"| SC
```

## 🔄 Fluxos implementados

### Fluxo de Registro (✅ funcional)

```
Magistrado       Frontend                Backend              Blockchain
   │                │                       │                     │
   │  login         │                       │                     │
   ├───────────────►│                       │                     │
   │                │  upload documento     │                     │
   │                │  SHA-256 (Web Crypto) │                     │
   │  preenche      │                       │                     │
   │  metadados     │                       │                     │
   ├───────────────►│                       │                     │
   │                │  POST /api/decisoes   │                     │
   │                ├──────────────────────►│                     │
   │                │                       │  registrarDecisao() │
   │                │                       ├────────────────────►│
   │                │                       │       txHash        │
   │                │                       │◄────────────────────┤
   │                │  201 { txHash, hash } │                     │
   │                │◄──────────────────────┤                     │
   │  confirmação   │                       │                     │
   │◄───────────────┤                       │                     │
```

### Fluxo de Retificação (✅ funcional)

Mesmo fluxo do registro, mas exige `hashAnterior` e chama `registrarRetificacao()` no contrato. A decisão anterior recebe status **Retificada**.

### Fluxo de Verificação (⏳ em breve)

Qualquer pessoa faz upload de um documento → frontend calcula SHA-256 → consulta direto no contrato (`verificarDecisao`) → retorna se o hash existe e seus metadados.

## 🧩 Camadas e responsabilidades

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|-----------------|
| **Frontend** | Angular 22, Web Crypto API | Hash SHA-256 no navegador, UI de upload/registro, nunca vê a chave privada |
| **Backend** | NestJS, ethers v6 | Assina transações com a carteira do integrador, valida DTOs, expõe API REST |
| **Contrato** | Solidity ^0.8.20, Hardhat | Registro imutável, ciclo de vida das decisões, verificação pública |
