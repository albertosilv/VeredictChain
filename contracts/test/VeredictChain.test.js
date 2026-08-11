const { expect } = require("chai");
const { ethers } = require("hardhat");

function keccak(text) {
  return ethers.keccak256(ethers.toUtf8Bytes(text));
}

describe("VeredictChain", function () {
  let veredictChain, admin, integrador, outro;
  const magistradoHash = keccak("cert-icp-brasil-des-frederico-coutinho");
  const hashDecisao1 = keccak("acordao-processo-0001-2026-v1");
  const hashDecisao1Retificada = keccak("acordao-processo-0001-2026-v2-retificado");

  beforeEach(async function () {
    [admin, integrador, outro] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("VeredictChain");
    veredictChain = await Factory.deploy();
    await veredictChain.waitForDeployment();

    await veredictChain.credenciarMagistrado(magistradoHash);
    await veredictChain.autorizarIntegrador(integrador.address);
  });

  it("registra uma decisão publicada com sucesso", async function () {
    await expect(
      veredictChain
        .connect(integrador)
        .registrarDecisao(
          hashDecisao1,
          "0001234-56.2026.8.15.0001",
          "TJPB",
          "1a Vara de Execucao Penal",
          magistradoHash,
          "SEEU"
        )
    ).to.emit(veredictChain, "DecisaoRegistrada");

    const [existe, decisao] = await veredictChain.verificarDecisao(hashDecisao1);
    expect(existe).to.equal(true);
    expect(decisao.status).to.equal(1n); // Publicada
  });

  it("rejeita registro de magistrado nao credenciado", async function () {
    const magistradoFalso = keccak("magistrado-nao-credenciado");
    await expect(
      veredictChain
        .connect(integrador)
        .registrarDecisao(
          hashDecisao1,
          "0001234-56.2026.8.15.0001",
          "TJPB",
          "1a Vara",
          magistradoFalso,
          "SEEU"
        )
    ).to.be.revertedWith("VeredictChain: magistrado nao credenciado");
  });

  it("rejeita integrador nao autorizado (simula tentativa de fraude no ponto de transmissao)", async function () {
    await expect(
      veredictChain
        .connect(outro)
        .registrarDecisao(
          hashDecisao1,
          "0001234-56.2026.8.15.0001",
          "TJPB",
          "1a Vara",
          magistradoHash,
          "SEEU"
        )
    ).to.be.revertedWith("VeredictChain: integrador nao autorizado");
  });

  it("processa retificacao legitima preservando o historico", async function () {
    await veredictChain
      .connect(integrador)
      .registrarDecisao(
        hashDecisao1,
        "0001234-56.2026.8.15.0001",
        "TJPB",
        "1a Vara",
        magistradoHash,
        "SEEU"
      );

    await expect(
      veredictChain
        .connect(integrador)
        .registrarRetificacao(
          hashDecisao1Retificada,
          hashDecisao1,
          "0001234-56.2026.8.15.0001",
          "TJPB",
          "1a Vara",
          magistradoHash,
          "SEEU"
        )
    ).to.emit(veredictChain, "DecisaoRetificada");

    const [, original] = await veredictChain.verificarDecisao(hashDecisao1);
    expect(original.status).to.equal(2n); // Retificada

    const [, nova] = await veredictChain.verificarDecisao(hashDecisao1Retificada);
    expect(nova.status).to.equal(1n); // Publicada
    expect(nova.hashAnterior).to.equal(hashDecisao1);

    const historico = await veredictChain.historicoDoProcesso("0001234-56.2026.8.15.0001");
    expect(historico.length).to.equal(2);
  });

  it("rejeita retificacao sem referencia a uma decisao existente", async function () {
    const hashInexistente = keccak("hash-que-nunca-foi-registrado");
    await expect(
      veredictChain
        .connect(integrador)
        .registrarRetificacao(
          hashDecisao1Retificada,
          hashInexistente,
          "0001234-56.2026.8.15.0001",
          "TJPB",
          "1a Vara",
          magistradoHash,
          "SEEU"
        )
    ).to.be.revertedWith("VeredictChain: hash anterior nao existe");
  });

  it("permite ao admin arquivar uma decisao", async function () {
    await veredictChain
      .connect(integrador)
      .registrarDecisao(
        hashDecisao1,
        "0001234-56.2026.8.15.0001",
        "TJPB",
        "1a Vara",
        magistradoHash,
        "SEEU"
      );

    await veredictChain.arquivarDecisao(hashDecisao1);
    const [, decisao] = await veredictChain.verificarDecisao(hashDecisao1);
    expect(decisao.status).to.equal(3n); // Arquivada
  });

  it("simula o cenario do Oficio-Circular 001/2026: hash falso nunca registrado e detectado", async function () {
    // O acordao falso atribuido ao STJ nunca foi assinado por magistrado credenciado,
    // logo seu hash jamais existira na blockchain.
    const hashAcordaoFalso = keccak("acordao-stj-falso-inserido-no-seeu");
    const [existe] = await veredictChain.verificarDecisao(hashAcordaoFalso);
    expect(existe).to.equal(false); // sistema receptor bloquearia o documento
  });
});
