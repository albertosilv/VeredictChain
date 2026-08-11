# Smart Contracts — VeredictChain

## Contrato Principal: `VeredictChain.sol`

Localizado em `/contracts/contracts/VeredictChain.sol`.

### Funções públicas / externas

| Função | Autorização | Descrição |
|--------|------|-----------|
| `credenciarMagistrado(bytes32)` | `onlyAdmin` | Credencia um hash de certificado ICP-Brasil de magistrado |
| `revogarMagistrado(bytes32)` | `onlyAdmin` | Revoga o credenciamento de um magistrado |
| `autorizarIntegrador(address)` | `onlyAdmin` | Autoriza um endereço (carteira do backend) a registrar/retificar/arquivar |
| `revogarIntegrador(address)` | `onlyAdmin` | Revoga a autorização de um integrador |
| `transferirAdmin(address)` | `onlyAdmin` | Transfere a governança do contrato (transferência em uma etapa — sem multisig/timelock) |
| `registrarDecisao(...)` | `onlyIntegrador` | Registra uma nova decisão judicial. Rejeita magistrado não credenciado, hash duplicado, e uma segunda "original" para processo com decisão ativa |
| `registrarRetificacao(...)` | `onlyIntegrador` | Substitui/retifica decisão existente, exigindo `hashAnterior`, preservando histórico |
| `arquivarDecisao(bytes32)` | `onlyIntegrador` | Encerra o ciclo de vida do registro. **Nota:** é `onlyIntegrador`, não `onlyAdmin` — é uma operação do fluxo operacional normal (mesmo ator que registra/retifica), não uma ação de governança. 
| `verificarDecisao(bytes32 documentHash)` | `public view` | Verifica se uma decisão existe e retorna metadados |
| `historicoDoProcesso(string numeroProcesso)` | `public view` | Retorna todos os hashes vinculados a um processo, em ordem |
| `magistradosCredenciados(bytes32)` | `public view` (getter automático) | Confirma se um hash de magistrado está credenciado hoje |

### Modificadores

- `onlyAdmin` — restringe funções de **governança** (credenciamento de
  magistrados/integradores, transferência de admin) a uma única conta.
  Reservado para a entidade gestora (CNJ/TJPB no modelo da proposta).
- `onlyIntegrador` — restringe todo o **fluxo operacional** (registrar,
  retificar, arquivar) ao backend autorizado. Um endereço pode ser
  simultaneamente admin e integrador (é o caso do deployer, por construção
  do `constructor`), mas em produção estes deveriam ser contas **separadas**
  — a única exceção histórica foi corrigida (ver `arquivarDecisao` acima).

> Não existe modifier `onlyMagistrado`: magistrados nunca assinam transações
> diretamente. A identidade do magistrado (`magistradoHash`) é um parâmetro
> de dado passado pelo integrador, e sua autenticidade depende inteiramente
> do processo de autenticação do backend (ver `backend-security.md`) — hoje
> JWT + usuário/senha, idealmente assinatura ICP-Brasil real no futuro.

### Estruturas de dados

- `Decisao` — metadados completos de uma decisão (hash, processo, tribunal,
  órgão, magistrado, canal de transmissão, status, timestamp, hash anterior,
  endereço que registrou).
- `Status`: `Inexistente`, `Publicada`, `Retificada`, `Arquivada`.

### Validações no próprio contrato (não só no backend)

- Tamanho de string: `numeroProcesso` ≤ 30, `tribunalOrigem` ≤ 20,
  `orgaoJulgador` ≤ 60, `canalTransmissao` ≤ 40 bytes. Protege contra grief
  de gas/storage mesmo que a chave do integrador seja comprometida e o
  contrato seja chamado diretamente, sem passar pelo backend.
- Uma nova "original" (`registrarDecisao`) só é aceita se o processo não
  tiver decisão ativa (status ≠ `Arquivada`) — evita duplicidade/sequestro
  de número de processo; força o uso de `registrarRetificacao`.

### Atenção

- O hash usado no contrato é `bytes32` (SHA-256). Frontend e backend devem
  produzir o mesmo hash — mas o hash **autoritativo** é sempre o calculado
  pelo backend (ver `frontend-hash.md`), nunca o do cliente.
- Formato esperado: `"0x" + 64 hex chars` (SHA-256 completo).
- Testes: `scripts/manual-test.js` — 13 cenários, 13 passando
