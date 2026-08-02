# Smart Contracts — VeredictChain

## Contrato Principal: `VeredictChain.sol`

Localizado em `/contracts/VeredictChain.sol`.

### Funções públicas / externas

| Função | Tipo | Descrição |
|--------|------|-----------|
| `registrarDecisao(...)` | `onlyIntegrador` | Registra uma nova decisão judicial na blockchain |
| `registrarRetificacao(...)` | `onlyIntegrador` | Substitui/retifica decisão existente, preservando histórico |
| `verificarDecisao(bytes32 documentHash)` | `public view` | Verifica se uma decisão existe e retorna metadados |
| `historicoDoProcesso(string numeroProcesso)` | `public view` | Retorna todos os hashes vinculados a um processo |

### Modificadores

- `onlyAdmin` — restringe funções administrativas ao deployer
- `onlyIntegrador` — restringe registro/retificação ao backend autorizado
- `onlyMagistrado` — restringe ações que exigem credencial de magistrado

### Estruturas de dados

- `Decisao` — metadados completos de uma decisão (hash, processo, tribunal, órgão, magistrado, status, timestamp, etc.)
- Status: `Publicada`, `Retificada`, `Arquivada`

### Atenção

- O hash usado no contrato é `bytes32` (SHA-256). Frontend e backend devem produzir o mesmo hash.
- Formato esperado: `"0x" + 64 hex chars` (SHA-256 completo).
