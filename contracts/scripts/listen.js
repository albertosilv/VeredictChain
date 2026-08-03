const { ethers } = require("hardhat");

async function main() {
  const contrato = await ethers.getContractAt("VeredictChain", "0x9B8397f1B0FEcD3a1a40CdD5E8221Fa461898517");

  console.log("Ouvindo eventos do VeredictChain...\n");

  // Evento: DecisaoRegistrada(documentHash, numeroProcesso, magistradoHash, canalTransmissao, timestamp)
  contrato.on("DecisaoRegistrada", (documentHash, numeroProcesso, magistradoHash, canal, timestamp) => {
    console.log(`\nNOVA DECISÃO REGISTRADA`);
    console.log(`   Hash:     ${documentHash}`);
    console.log(`   Processo: ${numeroProcesso}`);
    console.log(`   Canal:    ${canal}`);
    console.log(`   Data:     ${new Date(Number(timestamp) * 1000).toISOString()}`);
    console.log(`   ─────────────────────────────`);
  });

  contrato.on("DecisaoRetificada", (novoHash, hashAnterior, numeroProcesso, timestamp) => {
    console.log(`\n DECISÃO RETIFICADA`);
    console.log(`   Processo: ${numeroProcesso}`);
    console.log(`   Anterior: ${hashAnterior}`);
    console.log(`   Novo:     ${novoHash}`);
    console.log(`   ─────────────────────────────`);
  });

  contrato.on("DecisaoArquivada", (documentHash, timestamp) => {
    console.log(`\nDECISÃO ARQUIVADA`);
    console.log(`   Hash: ${documentHash}`);
    console.log(`   ─────────────────────────────`);
  });

  console.log("Pressione Ctrl+C para parar.\n");
}

main();
