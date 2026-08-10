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
    DROP["Dropzone<br/>Upload + SHA-256 (prévia) + consulta via backend"]:::browser
    VERIF["Verificação Pública<br/>✅ implementado (parte do Dropzone)"]:::browser
  end

  subgraph EMISSOR["🔐 Painel Emissor — /emissor"]
    LOGIN["Login (JWT real)<br/>POST /api/auth/login<br/>usuário/senha mock -> credencial ICP-Brasil real é trabalho futuro"]:::frontend
    REG["Formulário de Registro<br/>• Upload do documento (enviado por inteiro)<br/>• Hash calculado no BACKEND, não no cliente<br/>• Metadados do processo"]:::frontend
    CONSULTA["Consulta de Processo<br/>✅ implementado (consultar + minhas-decisoes)"]:::frontend
  end

  LOGIN -->|"JWT Bearer token"| REG
  DROP -->|"calcula SHA-256 (prévia local)"| DROP
  REG -->|"calcula SHA-256 (prévia local)"| REG
end


%% ═══════════════════════════════════════════════════════
%% 2. BACKEND — NestJS
%% ═══════════════════════════════════════════════════════
subgraph BACKEND["⚙️ Backend — NestJS (Integrador Autorizado)"]
  AUTH["AuthModule<br/>POST /api/auth/login<br/>JWT + bcrypt"]:::backend
  API["API REST :3000<br/>POST /api/decisoes (multipart, JWT)<br/>POST /api/decisoes/retificar (multipart, JWT)<br/>GET /api/decisoes/minhas (JWT)"]:::backend
  VAL["ValidationPipe + JwtAuthGuard<br/>class-validator DTOs<br/>DocumentoTextoService (magic bytes + conteúdo)"]:::backend
  WALLET["Carteira do Integrador<br/>ethers.Wallet<br/>INTEGRADOR_PRIVATE_KEY"]:::backend
  CONTRACT["ethers.Contract<br/>VeredictChain"]:::backend

  AUTH -->|"emite JWT"| API
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
REG -->|"POST /api/decisoes (multipart)<br/>arquivo + metadados + JWT Bearer"| API
CONTRACT -->|"registrarDecisao(hashCalculadoNoServidor, ...)"| SC
SC -->|"txHash"| CONTRACT
API -->|"201 { txHash, documentHash }"| REG

%% ── Verificação Pública ──
DROP -->|"GET /api/decisoes/:hash<br/>(hash calculado localmente, só para consulta)"| API
API -->|"verificarDecisao(hash)"| SC
SC -->|"Status + Metadados"| VERIF

%% ── Retificação ──
REG -->|"POST /api/decisoes/retificar (multipart)<br/>arquivo + hashAnterior + metadados + JWT"| API
CONTRACT -->|"registrarRetificacao(...)"| SC
```

## 🔄 Fluxos implementados

### Fluxo de Registro (✅ funcional)

```
Magistrado       Frontend                Backend              Blockchain
   │                │                       │                     │
   │  login         │                       │                     │
   ├───────────────►│  POST /api/auth/login │                     │
   │                ├──────────────────────►│                     │
   │                │◄──────────────────────┤  JWT accessToken    │
   │  preenche      │                       │                     │
   │  metadados +   │                       │                     │
   │  seleciona doc │                       │                     │
   ├───────────────►│                       │                     │
   │                │  POST /api/decisoes   │                     │
   │                │  (multipart + JWT)    │                     │
   │                ├──────────────────────►│                     │
   │                │                       │  valida magic bytes │
   │                │                       │  recalcula SHA-256  │
   │                │                       │  confere numProcesso│
   │                │                       │  no conteudo do doc │
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

Mesmo fluxo do registro, mas exige `hashAnterior` e chama `registrarRetificacao()` no contrato. A decisão anterior recebe status **Retificada**. O contrato agora também bloqueia uma segunda "original" (`registrarDecisao`) para o mesmo processo enquanto houver decisão ativa — força esse caminho de retificação.

### Fluxo de Verificação Pública (✅ funcional)

Qualquer pessoa faz upload de um documento no Dropzone → frontend calcula uma prévia de SHA-256 localmente → consulta `GET /api/decisoes/:hash` no backend → backend chama `verificarDecisao` no contrato → retorna se o hash existe e seus metadados públicos.

## 🧩 Camadas e responsabilidades

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|-----------------|
| **Frontend** | Angular 22, Web Crypto API | Login (JWT), UI de upload/registro/consulta, hash SHA-256 local só como prévia de UX, nunca vê a chave privada do integrador |
| **Backend** | NestJS, ethers v6 | Autentica (JWT+bcrypt), valida magic bytes e conteúdo do arquivo, **calcula o hash oficial**, assina transações com a carteira do integrador, expõe API REST |
| **Contrato** | Solidity ^0.8.20, Hardhat | Registro imutável, ciclo de vida das decisões, controle de acesso (admin/integrador), limites de tamanho, verificação pública |
