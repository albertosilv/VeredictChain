const { ethers } = require("hardhat");

async function main() {
  const contrato = await ethers.getContractAt("VeredictChain", "0x9B8397f1B0FEcD3a1a40CdD5E8221Fa461898517");

  const hash = process.argv[2] || "0x2b2cff0cd4b065800b460968f628bb66189f9c4a17fc2bb1927cabb94ae36d08";

  const [existe, decisao] = await contrato.verificarDecisao(hash);
  console.log("=== CONSULTA ON-CHAIN ===");
  console.log("Hash:", hash);
  console.log("Existe:", existe);
  if (existe) {
    console.log("Nº Processo:", decisao.numeroProcesso);
    console.log("Tribunal:", decisao.tribunalOrigem);
    console.log("Órgão:", decisao.orgaoJulgador);
    console.log("Canal:", decisao.canalTransmissao);
    console.log("Status:", ["Inexistente","Publicada","Retificada","Arquivada"][decisao.status]);
    console.log("Timestamp:", new Date(Number(decisao.timestamp) * 1000).toISOString());
  }
}

main();
