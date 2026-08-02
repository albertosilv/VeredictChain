1. Abra o Remix, cole o contrato, compile com o compilador Solidity compatível) e faça o deploy usando o ambiente "Remix VM". 

2. Mostre que a conta que fez o deploy é a administradora chamando `admin()`. Em seguida, chame `credenciarMagistrado(bytes32)` usando um hash de exemplo, por exemplo:
   - `0x1111111111111111111111111111111111111111111111111111111111111111`

   Depois consulte `magistradosCredenciados()` com o mesmo hash para mostrar que retornou `true`.

3. Chame `registrarDecisao(...)` preenchendo os campos com valores simples, por exemplo:
   - `documentHash`:
     `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
   - `numeroProcesso`:
     `0001234-56.2026.8.15.0001`
   - `tribunalOrigem`:
     `TJPB`
   - `orgaoJulgador`:
     `1ª Vara Cível`
   - `magistradoHash`:
     `0x1111111111111111111111111111111111111111111111111111111111111111`
   - `canalTransmissao`:
     `PJe`

   Execute a transação e mostre que ela foi confirmada.

4. Chame `verificarDecisao()` passando o mesmo `documentHash` (`0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`). Mostre que o retorno indica `existe = true` e que os metadados da decisão foram armazenados, especialmente o número do processo, o tribunal, o status e o timestamp.

5. Chame `registrarRetificacao(...)` usando um novo hash, por exemplo:
   - `novoHash`:
     `0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`
   - `hashAnterior`:
     `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`

   Mantenha o mesmo processo, tribunal, órgão julgador, magistrado e canal. Depois consulte `verificarDecisao()` para o hash antigo e para o novo, mostrando que a versão anterior ficou com status **Retificada** e a nova ficou com status **Publicada**.

6. A principal funcionalidade do sistema foi demonstrada: o contrato foi implantado, um magistrado foi credenciado, uma decisão foi registrada na blockchain e posteriormente recuperada por meio da função pública de verificação, comprovando que a lógica central do projeto está operacional.
