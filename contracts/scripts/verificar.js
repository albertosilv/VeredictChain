const { ethers } = require("hardhat");

async function main() {
  const endereco = "0x9B8397f1B0FEcD3a1a40CdD5E8221Fa461898517";
  const contrato = await ethers.getContractAt("VeredictChain", endereco);

  const hash = "0xee092bc38400dac414fe7e4c673e7fe4079806ec66a6c65e23d824a8f770aeb2";

  console.log("=== Verificando hash:", hash);
  const [existe, decisao] = await contrato.verificarDecisao(hash);
  console.log("Existe:", existe);
  console.log("Número do processo:", decisao.numeroProcesso);
  console.log("Tribunal:", decisao.tribunalOrigem);
  console.log("Órgão julgador:", decisao.orgaoJulgador);
  console.log("Magistrado hash:", decisao.magistradoHash);
  console.log("Canal:", decisao.canalTransmissao);
  console.log("Status (0=Inexistente, 1=Publicada, 2=Retificada, 3=Arquivada):", decisao.status.toString());
  console.log("Timestamp:", new Date(Number(decisao.timestamp) * 1000).toISOString());

  console.log("\n=== Histórico do processo 0001234-56.2026.8.15.0001 ===");
  const historico = await contrato.historicoDoProcesso("0001234-56.2026.8.15.0001");
  historico.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));

  console.log("\n=== Magistrados credenciados ===");
  const magHash = "0x1f3d89c259932131898eba5c76186e6b44d0e4a152456d70ce3063ad56c2094b";
  console.log("  ", magHash, "=>", await contrato.magistradosCredenciados(magHash));

  console.log("\n=== Integradores autorizados ===");
  console.log("  Deployer:", await contrato.integradoresAutorizados("0xFE3B557E8Fb62b89f4916B721be55cEb828dBd73"));
}

main();
