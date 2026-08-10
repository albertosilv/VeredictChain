const assert = require("assert");
const hre = require("hardhat");
const { compileVeredictChain } = require("./compile.js");

function keccak(text) {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(text));
}

let passed = 0;
let failed = 0;

async function test(nome, fn) {
  try {
    await fn();
    console.log("  [PASS]", nome);
    passed++;
  } catch (err) {
    console.log("  [FAIL]", nome, "->", err.message);
    failed++;
  }
}

async function deployNovo() {
  const { abi, bytecode } = compileVeredictChain();
  const [admin, integrador, outro] = await hre.ethers.getSigners();
  const Factory = new hre.ethers.ContractFactory(abi, bytecode, admin);
  const contrato = await Factory.deploy();
  await contrato.waitForDeployment();
  return { contrato, admin, integrador, outro };
}

async function expectRevert(promise, mensagemEsperada) {
  try {
    await promise;
    throw new Error("esperava reverter, mas nao reverteu");
  } catch (err) {
    assert(
      err.message.includes(mensagemEsperada),
      `mensagem de erro nao contem "${mensagemEsperada}" (recebido: ${err.message})`
    );
  }
}

async function main() {
  console.log("Executando testes do VeredictChain na Hardhat Network...\n");

  const magistradoHash = keccak("cert-icp-brasil-des-frederico-coutinho");
  const hashDecisao1 = keccak("acordao-processo-0001-2026-v1");
  const hashDecisao1Retificada = keccak("acordao-processo-0001-2026-v2-retificado");

  await test("registra uma decisao publicada com sucesso", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);

    await contrato
      .connect(integrador)
      .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU");

    const [existe, decisao] = await contrato.verificarDecisao(hashDecisao1);
    assert.strictEqual(existe, true);
    assert.strictEqual(decisao.status.toString(), "1");
  });

  await test("rejeita registro de magistrado nao credenciado", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.autorizarIntegrador(integrador.address);
    const magistradoFalso = keccak("magistrado-nao-credenciado");

    await expectRevert(
      contrato
        .connect(integrador)
        .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoFalso, "SEEU"),
      "magistrado nao credenciado"
    );
  });

  await test("rejeita integrador nao autorizado (fraude no ponto de transmissao)", async () => {
    const { contrato, outro } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);

    await expectRevert(
      contrato
        .connect(outro)
        .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU"),
      "integrador nao autorizado"
    );
  });

  await test("processa retificacao legitima preservando o historico", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);

    await contrato
      .connect(integrador)
      .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU");

    await contrato
      .connect(integrador)
      .registrarRetificacao(
        hashDecisao1Retificada,
        hashDecisao1,
        "0001234-56.2026.8.15.0001",
        "TJPB",
        "1a Vara",
        magistradoHash,
        "SEEU"
      );

    const [, original] = await contrato.verificarDecisao(hashDecisao1);
    assert.strictEqual(original.status.toString(), "2"); // Retificada

    const [, nova] = await contrato.verificarDecisao(hashDecisao1Retificada);
    assert.strictEqual(nova.status.toString(), "1"); // Publicada
    assert.strictEqual(nova.hashAnterior, hashDecisao1);

    const historico = await contrato.historicoDoProcesso("0001234-56.2026.8.15.0001");
    assert.strictEqual(historico.length, 2);
  });

  await test("rejeita retificacao sem referencia a decisao existente", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);
    const hashInexistente = keccak("hash-que-nunca-foi-registrado");

    await expectRevert(
      contrato
        .connect(integrador)
        .registrarRetificacao(
          hashDecisao1Retificada,
          hashInexistente,
          "0001234-56.2026.8.15.0001",
          "TJPB",
          "1a Vara",
          magistradoHash,
          "SEEU"
        ),
      "hash anterior nao existe"
    );
  });

  await test("permite ao admin arquivar uma decisao", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);
    await contrato
      .connect(integrador)
      .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU");

    await contrato.arquivarDecisao(hashDecisao1);
    const [, decisao] = await contrato.verificarDecisao(hashDecisao1);
    assert.strictEqual(decisao.status.toString(), "3"); // Arquivada
  });

  await test("REGRESSAO (bug B1): arquivamento deve funcionar quando admin != integrador (topologia realista de producao)", async () => {
    const { contrato, integrador } = await deployNovo();
    // admin = deployer (governanca/CNJ-TJPB); integrador = carteira separada do backend.
    // Este e exatamente o cenario que expos o bug original: arquivarDecisao() exigia
    // onlyAdmin, mas quem assina a transacao no backend real e sempre o integrador.
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);
    await contrato
      .connect(integrador)
      .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU");

    // O backend real assina SEMPRE com a carteira do integrador, nunca a do admin.
    await contrato.connect(integrador).arquivarDecisao(hashDecisao1);
    const [, decisao] = await contrato.verificarDecisao(hashDecisao1);
    assert.strictEqual(decisao.status.toString(), "3"); // Arquivada
  });

  await test("rejeita arquivamento por conta nao autorizada (nem admin, nem integrador)", async () => {
    const { contrato, integrador, outro } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);
    await contrato
      .connect(integrador)
      .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU");

    await expectRevert(
      contrato.connect(outro).arquivarDecisao(hashDecisao1),
      "integrador nao autorizado"
    );
  });

  await test("simula o cenario do Oficio-Circular 001/2026: acordao falso nunca registrado", async () => {
    const { contrato } = await deployNovo();
    const hashAcordaoFalso = keccak("acordao-stj-falso-inserido-no-seeu");
    const [existe] = await contrato.verificarDecisao(hashAcordaoFalso);
    assert.strictEqual(existe, false);
  });

  await test("rejeita nova 'original' para processo que ja tem decisao ativa (evita duplicidade/sequestro de processo)", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);
    await contrato
      .connect(integrador)
      .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU");

    const hashAdulterado = keccak("versao-adulterada-do-mesmo-processo");
    await expectRevert(
      contrato
        .connect(integrador)
        .registrarDecisao(hashAdulterado, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU"),
      "processo ja possui decisao ativa"
    );
  });

  await test("permite nova 'original' apos arquivamento (processo reaberto/novo ciclo)", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);
    await contrato
      .connect(integrador)
      .registrarDecisao(hashDecisao1, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU");
    await contrato.connect(integrador).arquivarDecisao(hashDecisao1);

    const hashNovoCiclo = keccak("novo-ciclo-apos-arquivamento");
    await contrato
      .connect(integrador)
      .registrarDecisao(hashNovoCiclo, "0001234-56.2026.8.15.0001", "TJPB", "1a Vara", magistradoHash, "SEEU");
    const [existe] = await contrato.verificarDecisao(hashNovoCiclo);
    assert.strictEqual(existe, true);
  });

  await test("rejeita numeroProcesso com tamanho acima do limite (protecao contra grief de gas/storage)", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);

    await expectRevert(
      contrato
        .connect(integrador)
        .registrarDecisao(hashDecisao1, "X".repeat(200), "TJPB", "1a Vara", magistradoHash, "SEEU"),
      "numeroProcesso invalido"
    );
  });

  await test("aceita canalTransmissao com detalhe ('Outro: ...') dentro do novo limite de 40 bytes", async () => {
    const { contrato, integrador } = await deployNovo();
    await contrato.credenciarMagistrado(magistradoHash);
    await contrato.autorizarIntegrador(integrador.address);

    await contrato
      .connect(integrador)
      .registrarDecisao(
        hashDecisao1,
        "0001234-56.2026.8.15.0001",
        "TJPB",
        "1a Vara",
        magistradoHash,
        "Outro: oficio-circular-manual"
      );
    const [existe] = await contrato.verificarDecisao(hashDecisao1);
    assert.strictEqual(existe, true);
  });

  console.log(`\n${passed} passando, ${failed} falhando`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
