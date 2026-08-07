# Especificação: Assinatura Digital no VeredictChain

> Versão 2 — revisada após discussão de system design e segurança.

---

## 🎯 Objetivo

Implementar o fluxo de assinatura digital conforme o modelo proposto:

```
documento → hash SHA-256 → assinar hash com chave privada do magistrado → assinatura digital
```

Isso adiciona o terceiro pilar de segurança ao projeto: **autoria**. Hoje o sistema já garante integridade (hash) e existência temporal (blockchain), mas não prova criptograficamente que o magistrado endossou o documento.

---

## 🔐 Abordagem escolhida

**ECDSA (secp256k1)** — mesma curva elíptica do Ethereum. Verificação on-chain via `ecrecover`.

---

## 🏗️ Decisão de design: onde o hash é calculado?

Após discussão, a decisão é **híbrida**:

| Etapa | Onde | Por quê |
|-------|------|---------|
| Hash preliminar | Frontend | UX imediata (preview para o magistrado) |
| Hash oficial | **Backend** | Ambiente controlado, imune a XSS/extensões/CDN compromise |
| PDF | Backend (RAM, < 500ms) | Só assim o backend pode calcular o hash; descartado em seguida |
| Assinatura | Frontend | Chave privada do magistrado nunca sai do navegador |
| Verificação da assinatura | Contrato (on-chain) | `ecrecover` — sem confiança no integrador |

### Por que o backend recalcula o hash?

1. **O frontend (navegador) é o ambiente mais vulnerável.** Extensões maliciosas, XSS, CDN compromise e malware no computador do magistrado podem adulterar o hash antes do registro.

2. **Hash errado na blockchain é irreversível.** Se um bug ou ataque no frontend gerar um hash incorreto, o documento verdadeiro ficará eternamente invalidado. Não existe rollback em blockchain imutável.

3. **O backend é um ambiente controlado.** Sem DOM, sem extensões, sem CDN, tráfego limitado, logs auditáveis. É a fonte de verdade confiável para o hash.

4. **O PDF trafega sob TLS 1.3 e permanece apenas em RAM.** Não é armazenado em disco, S3 ou banco de dados. Descartado em menos de 500ms após o registro. LGPD atendida: o backend não é "controlador" de dados sensíveis.

5. **A integridade do hash é o requisito fundamental do sistema.** O VeredictChain existe para atestar que decisões judiciais não foram adulteradas. Priorizar confidencialidade em detrimento da integridade seria contraditório com o propósito do sistema.

---

## 🔄 Fluxo completo (registro de decisão)

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (navegador do magistrado)                           │
│                                                               │
│  1. Upload do PDF                                             │
│  2. SHA-256 → hashPreliminar (para preview/UX)                │
│  3. Envia PDF + hashPreliminar + metadados → POST /api/decisoes │
│     (TLS 1.3)                                                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (NestJS)                                             │
│                                                               │
│  4. Recebe PDF em memória RAM                                 │
│  5. Recalcula SHA-256 → hashOficial                           │
│  6. Compara hashOficial com hashPreliminar                    │
│     Se diferente: ERRO (possível ataque ou bug no front)      │
│  7. Chama contract.registrarDecisao(hashOficial, metadados)   │
│  8. Descarta PDF da RAM (nunca foi a disco)                   │
│  9. Retorna { txHash, documentHash: hashOficial } ao front    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (navegador do magistrado)                           │
│                                                               │
│  10. Recebe hashOficial do backend                            │
│  11. window.crypto.subtle.sign(ECDSA, chavePrivada,           │
│      hashOficial) → assinatura                                │
│  12. Envia assinatura → POST /api/decisoes/:hash/assinar      │
│      ⚠️ Chave privada NUNCA sai do navegador                  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (NestJS)                                             │
│                                                               │
│  13. Chama contract.vincularAssinatura(hashOficial,           │
│      assinatura)                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN (Solidity)                                        │
│                                                               │
│  14. ecrecover(hashOficial, assinatura) → endereço assinante  │
│  15. Verifica se endereço corresponde a magistrado            │
│  16. Se SIM: armazena assinatura no registro                  │
│      Se NÃO: reverte transação                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 O que muda — resumo

| Arquivo | Camada | Mudança |
|---------|--------|---------|
| `contracts/contracts/VeredictChain.sol` | Blockchain | +campo `bytes signature`, +função `vincularAssinatura()` com `ecrecover` |
| `contracts/test/VeredictChain.test.js` | Blockchain | +casos de teste para assinatura |
| `frontend/src/app/core/models/decisao.model.ts` | Frontend | +campo `assinatura` e interface `AssinarInput` |
| `frontend/src/app/core/services/hash.service.ts` | Frontend | +método `signHash()` |
| `frontend/src/app/features/emissor/registrar/registrar.component.ts` | Frontend | Fluxo em 2 etapas: registra → recebe hash → assina → envia assinatura |
| `frontend/src/app/features/emissor/retificar/retificar.component.ts` | Frontend | Idem |
| `backend/src/decisoes/decisoes.controller.ts` | Backend | +endpoint `POST /api/decisoes/:hash/assinar` |
| `backend/src/decisoes/decisoes.service.ts` | Backend | +método `vincularAssinatura()`, recalcula hash do PDF recebido |
| `backend/src/decisoes/dto/registrar-decisao.dto.ts` | Backend | +campo `hashPreliminar`, aceita PDF via `multer` |

---

## 📝 Alterações detalhadas

### 1. Contrato (`VeredictChain.sol`)

#### 1.1 Struct `Decisao` — novo campo

```solidity
struct Decisao {
    bytes32 documentHash;
    bytes signature;          // 🆕 assinatura ECDSA (65 bytes: r=32, s=32, v=1)
    // ... demais campos mantidos
}
```

#### 1.2 Nova função `vincularAssinatura`

A assinatura é registrada **após** o registro do hash, em transação separada:

```solidity
function vincularAssinatura(
    bytes32 documentHash,
    bytes calldata signature
) external onlyIntegrador {
    require(decisoes[documentHash].status != Status.Inexistente,
        "VeredictChain: hash nao registrado");
    require(decisoes[documentHash].signature.length == 0,
        "VeredictChain: assinatura ja vinculada");

    address signer = _recoverSigner(documentHash, signature);
    require(
        keccak256(abi.encodePacked(signer)) == decisoes[documentHash].magistradoHash,
        "VeredictChain: assinatura nao corresponde ao magistrado"
    );

    decisoes[documentHash].signature = signature;
}
```

#### 1.3 Função interna `_recoverSigner`

```solidity
function _recoverSigner(bytes32 hash, bytes memory signature)
    internal pure returns (address)
{
    require(signature.length == 65, "VeredictChain: assinatura deve ter 65 bytes");

    bytes32 r;
    bytes32 s;
    uint8 v;

    assembly {
        r := mload(add(signature, 32))
        s := mload(add(signature, 64))
        v := byte(0, mload(add(signature, 96)))
    }

    // Prefixo Ethereum: "\x19Ethereum Signed Message:\n32"
    bytes32 ethSignedHash = keccak256(
        abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
    );

    return ecrecover(ethSignedHash, v, r, s);
}
```

#### 1.4 `magistradoHash` como endereço Ethereum

Passa a ser `keccak256(abi.encodePacked(enderecoDoMagistrado))`, permitindo verificação on-chain com `ecrecover`.

---

### 2. Frontend

#### 2.1 Model (`decisao.model.ts`)

```typescript
export interface DecisaoInput {
  documentHash: string;        // hash preliminar (calculado no front)
  numeroProcesso: string;
  tribunalOrigem: string;
  orgaoJulgador: string;
  magistradoHash: string;
  canalTransmissao: string;
  hashAnterior?: string;
}

/** Enviado na 2ª etapa: após o registro, para vincular a assinatura. */
export interface AssinarInput {
  documentHash: string;        // hash OFICIAL (retornado pelo backend)
  assinatura: string;          // "0x" + 130 hex chars (65 bytes)
}
```

#### 2.2 DecisaoService — novo método

```typescript
/** 2ª etapa: vincula assinatura do magistrado ao hash já registrado. */
assinar(input: AssinarInput): Observable<RegistrarResultado> {
  return this.http.post<RegistrarResultado>(
    `${this.baseUrl}/${input.documentHash}/assinar`,
    input,
  );
}
```

#### 2.3 RegistrarComponent — fluxo em 2 etapas

```typescript
async onSubmit(): Promise<void> {
  // ... validações ...

  // ── Etapa 1: Enviar PDF + metadados para registro ──
  this.enviando.set(true);
  this.decisaoService.registrar(formData).subscribe({
    next: async (res) => {
      // ── Etapa 2: Assinar o hash OFICIAL (retornado pelo backend) ──
      this.assinando.set(true);
      try {
        const assinatura = await this.hashService.signHash(
          res.documentHash,          // hash OFICIAL do backend
          this.auth.privateKey        // chave do magistrado
        );
        this.decisaoService.assinar({
          documentHash: res.documentHash,
          assinatura,
        }).subscribe({
          next: () => {
            this.resultado.set(res);
            this.assinando.set(false);
            this.enviando.set(false);
          },
          error: (err) => {
            this.erro.set('Hash registrado, mas falha ao vincular assinatura.');
            this.assinando.set(false);
            this.enviando.set(false);
          },
        });
      } catch {
        this.erro.set('Erro ao assinar. Hash registrado sem assinatura.');
        this.assinando.set(false);
        this.enviando.set(false);
      }
    },
    error: (err) => {
      this.erro.set(err?.message ?? 'Erro ao registrar decisão.');
      this.enviando.set(false);
    },
  });
}
```

---

### 3. Backend

#### 3.1 Controller — novo endpoint + upload de PDF

```typescript
@Post()
async registrar(
  @UploadedFile() pdf: Express.Multer.File,
  @Body() dto: RegistrarDecisaoDto,
) {
  return this.decisoesService.registrarDecisao(pdf, dto);
}

@Post(':hash/assinar')
async assinar(
  @Param('hash') hash: string,
  @Body() dto: AssinarDto,
) {
  return this.decisoesService.vincularAssinatura(hash, dto.assinatura);
}
```

#### 3.2 Service — recalcular hash + vincular assinatura

```typescript
async registrarDecisao(
  pdf: Express.Multer.File,
  dto: RegistrarDecisaoDto,
): Promise<RegistrarResultado> {
  // 🆕 Recalcular hash no backend (fonte confiável)
  const hashOficial = ethers.keccak256(pdf.buffer); // SHA-256

  // 🆕 Comparar com hash preliminar do frontend
  if (dto.hashPreliminar && hashOficial !== dto.hashPreliminar) {
    this.logger.warn('Hash do frontend difere do backend — possível bug ou ataque');
    throw new BadRequestException('Hash do documento não confere');
  }

  const tx = await this.contract.registrarDecisao(
    hashOficial,  // 🆕 usa o hash calculado no backend
    dto.numeroProcesso,
    dto.tribunalOrigem,
    dto.orgaoJulgador,
    dto.magistradoHash,
    dto.canalTransmissao,
  );

  const receipt = await tx.wait();

  // 🆕 Descartar PDF da memória
  pdf.buffer.fill(0); // sobrescreve o buffer

  return { txHash: receipt.hash, documentHash: hashOficial };
}

async vincularAssinatura(
  documentHash: string,
  assinatura: string,
): Promise<RegistrarResultado> {
  const tx = await this.contract.vincularAssinatura(documentHash, assinatura);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, documentHash };
}
```

#### 3.3 DTO — hash preliminar + PDF

```typescript
export class RegistrarDecisaoDto {
  /** Hash preliminar calculado no frontend (opcional, para verificação) */
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  hashPreliminar?: string;

  // ... demais campos mantidos
}
```

---

## 🧪 Testes (novos cenários)

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | Registro normal + assinatura válida | ✅ Sucesso |
| 2 | Assinatura com chave de outro magistrado (não credenciado) | ❌ Revert |
| 3 | Assinatura forjada (chave aleatória) | ❌ Revert |
| 4 | Assinatura de tamanho inválido (≠ 65 bytes) | ❌ Revert |
| 5 | Vincular assinatura em hash inexistente | ❌ Revert |
| 6 | Vincular assinatura em hash já assinado | ❌ Revert |
| 7 | Hash preliminar (front) ≠ hash oficial (back) | ❌ Backend rejeita |
| 8 | Retificação com assinatura válida | ✅ Sucesso |

---

## ⚠️ Regras de segurança

| Regra | Motivo |
|-------|--------|
| Chave privada do magistrado **nunca** sai do navegador | `window.crypto.subtle.sign` roda localmente |
| Hash oficial é calculado no **backend** | Ambiente controlado, imune a XSS/extensões/CDN |
| PDF trafega sob **TLS 1.3** | Criptografia em trânsito |
| PDF permanece apenas em **RAM** (< 500ms) | `pdf.buffer.fill(0)` ao final; nunca em disco |
| Backend **compara** hash preliminar com oficial | Detecta bugs ou ataques no frontend |
| Assinatura é verificada **on-chain** (`ecrecover`) | Sem confiança no integrador |
| Magistrado assina o **hash oficial** (pós-registro) | Atesta concordância com o que realmente foi registrado |

---

## 📋 Tasks pendentes (visão completa do projeto)

Estado atual de cada funcionalidade: ✅ pronto | 🔧 em implementar | ⏳ pendente

---

### T1 — Assinatura digital (spec atual)

> ⏳ A implementar conforme esta especificação.

- [ ] **T1.1** Contrato: adicionar campo `bytes signature` ao struct `Decisao`
- [ ] **T1.2** Contrato: função `vincularAssinatura(bytes32, bytes)` com `ecrecover`
- [ ] **T1.3** Contrato: função interna `_recoverSigner` (Assembly + prefixo Ethereum)
- [ ] **T1.4** Contrato: `magistradoHash` passa a ser `keccak256(abi.encodePacked(endereco))`
- [ ] **T1.5** Contrato: testes para assinatura (8 cenários)
- [ ] **T1.6** Backend: receber PDF via `multer` no endpoint `POST /api/decisoes`
- [ ] **T1.7** Backend: recalcular SHA-256 do PDF em RAM e comparar com `hashPreliminar`
- [ ] **T1.8** Backend: descartar PDF da RAM após registro (`buffer.fill(0)`)
- [ ] **T1.9** Backend: endpoint `POST /api/decisoes/:hash/assinar`
- [ ] **T1.10** Backend: DTOs com `hashPreliminar` e `AssinarDto`
- [ ] **T1.11** Frontend: `HashService.signHash()` — assinar com `window.crypto.subtle.sign`
- [ ] **T1.12** Frontend: `DecisaoService.assinar()` — endpoint de vinculação
- [ ] **T1.13** Frontend: `RegistrarComponent` — fluxo em 2 etapas (registra → assina)
- [ ] **T1.14** Frontend: `RetificarComponent` — idem para retificações

---

### T2 — Gerenciamento de chave do magistrado

> ⏳ Hoje o login é mock (usuário/senha fixos). A chave privada do magistrado precisa ser gerada, armazenada e usada para assinatura.

- [ ] **T2.1** `KeyService` — gerar par ECDSA (secp256k1) via `window.crypto.subtle.generateKey`
- [ ] **T2.2** `KeyService` — armazenar chave privada no IndexedDB (nunca sai do navegador)
- [ ] **T2.3** `KeyService` — exportar chave para backup (download de arquivo `.key`)
- [ ] **T2.4** `KeyService` — importar chave de backup (upload de `.key`)
- [ ] **T2.5** `AuthService` — expor `CryptoKey` privada para uso no `signHash()`
- [ ] **T2.6** Tela de primeiro acesso: "Gerar minha chave" + download do backup
- [ ] **T2.7** Tela de configurações: trocar senha, exportar/importar chave
- [ ] **T2.8** `magistradoHash` derivado da chave pública (endereço Ethereum do magistrado)

---

### T3 — Verificação pública (cidadão/advogado)

> 🔧 Em implementação na branch `feature/t3-verificacao-publica`. Hoje é um placeholder: `<p>Dropzone público — em breve.</p>`.

**Fluxo esperado:**
```
Cidadão faz upload do PDF
       ↓
Frontend calcula SHA-256
       ↓
Consulta o backend: GET /api/decisoes/:hash
       ↓
Backend consulta o contrato: verificarDecisao(hash)
       ↓
Retorna: status, metadados, assinatura (se houver)
       ↓
Frontend exibe:
  - ✅ Documento autêntico (hash registrado na blockchain)
  - Quem assinou (magistrado)
  - Data/hora do registro
  - Status (Publicada / Retificada / Arquivada)
  - Se tem assinatura: verificação off-chain da assinatura
```

- [x] **T3.1** `DropzoneComponent` — upload de PDF com drag & drop
- [x] **T3.2** `DropzoneComponent` — calcular hash e exibir ao usuário
- [x] **T3.3** `DropzoneComponent` — chamar `DecisaoService.buscarPorHash()`
- [x] **T3.4** `DropzoneComponent` — exibir resultado: autêntico ou não encontrado
- [x] **T3.5** `DropzoneComponent` — se autêntico, exibir metadados completos
- [x] **T3.6** `DropzoneComponent` — placeholder para verificação de assinatura (T1)
- [x] **T3.7** `DropzoneComponent` — mostrar status visual (✅ verde / ❌ vermelho)

---

### T4 — Painel do magistrado: melhorias

> 🔧 Registrar e Consultar estão funcionais. As demais telas precisam ser implementadas ou melhoradas.

- [x] **T4.1** Dashboard pós-login: visão geral (total de decisões, últimas registradas)
- [x] **T4.2** Filtrar "minhas decisões" na consulta (por `magistradoHash` do logado)
- [x] **T4.3** Exibir status da assinatura na listagem de consulta (assinado ✓ / pendente ⚠)
- [x] **T4.4** Botão "Arquivar" na consulta para decisões Publicadas/Retificadas
- [x] **T4.5** `DecisaoService.arquivar()` — chamar endpoint `POST /api/decisoes/:hash/arquivar`
- [x] **T4.6** Backend: endpoint `POST /api/decisoes/:hash/arquivar` → `contract.arquivarDecisao()`
- [x] **T4.7** Sidebar: link para "Minhas Decisões" e "Configurações"

---

### T5 — Verificação de assinatura na consulta

> ⏳ Quando a assinatura estiver implementada (T1), a tela de consulta deve mostrar se a assinatura é válida.

- [ ] **T5.1** `Decisao` model: adicionar campo `signature?: string`
- [ ] **T5.2** `ConsultarComponent`: exibir ícone de assinatura (✅ válida / ⚠ pendente / ❌ inválida)
- [ ] **T5.3** `ConsultarComponent`: ao expandir detalhes, mostrar endereço do signatário
- [ ] **T5.4** `HashService.verifySignature()` — verificar off-chain com Web Crypto

---

### T6 — Infraestrutura e DX

> ⏳ Melhorias de qualidade de vida para desenvolvimento.

- [ ] **T6.1** Script de deploy que credencia magistrados de teste com endereços Ethereum
- [ ] **T6.2** Backend: testes e2e para o fluxo completo (upload → registro → assinar → verificar)
- [ ] **T6.3** Frontend: testes unitários para `HashService` e `KeyService`
- [ ] **T6.4** `.env.example` no backend documentando todas as variáveis

---

## 📊 Ordem sugerida de implementação

```
1. T3 (Verificação pública) — fecha o ciclo para o cidadão
       ↓
2. T4 (Melhorias do painel do magistrado) — dashboard, arquivar, minhas decisões
       ↓
3. T6 (Infra e testes) — deploy script, e2e, unit tests, .env.example
       ↓
4. T2 (Gerenciamento de chave do magistrado) — gerar, guardar, backup
       ↓
5. T1 (Assinatura digital) — núcleo da spec, verificação on-chain
       ↓
6. T5 (Verificação de assinatura na consulta) — complementa T1
```

T3, T4 e T6 são independentes entre si e podem ser feitos em paralelo. T2 é pré-requisito para T1, e T1 é pré-requisito para T5.
