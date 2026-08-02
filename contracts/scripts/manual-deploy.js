const hre = require("hardhat");
const { compileVeredictChain } = require("./compile.js");

function keccak(text) {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(text));
}

async function main() {
  const { abi, bytecode } = compileVeredictChain();

  const [deployer] = await hre.ethers.getSigners();
  console.log("Rede:", hre.network.name, "(Hardhat Network - EVM local de testes)");
  console.log("Deployer:", deployer.address);

  const Factory = new hre.ethers.ContractFactory(abi, bytecode, deployer);
  const veredictChain = await Factory.deploy();
  await veredictChain.waitForDeployment();

  const enderecoContrato = await veredictChain.getAddress();
  console.log("VeredictChain deployado em:", enderecoContrato);

  const magistradoHash = keccak("cert-icp-brasil-des-frederico-coutinho");
  await (await veredictChain.credenciarMagistrado(magistradoHash)).wait();
  console.log("Magistrado credenciado (hash):", magistradoHash);

  const hashDecisao = keccak("acordao-processo-0001234-56.2026.8.15.0001-v1");
  const tx = await veredictChain.registrarDecisao(
    hashDecisao,
    "0001234-56.2026.8.15.0001",
    "TJPB",
    "1a Vara de Execucao Penal",
    magistradoHash,
    "SEEU"
  );
  const receipt = await tx.wait();
  console.log("Decisao registrada. Tx hash:", receipt.hash);
  console.log("Hash do documento registrado:", hashDecisao);

  const [existe, decisao] = await veredictChain.verificarDecisao(hashDecisao);
  console.log("\nVerificacao publica do hash:");
  console.log("  existe:", existe);
  console.log("  numeroProcesso:", decisao.numeroProcesso);
  console.log("  tribunalOrigem:", decisao.tribunalOrigem);
  console.log("  status (1=Publicada):", decisao.status.toString());

  const hashFalso = keccak("acordao-stj-falso-inserido-no-seeu");
  const [existeFalso] = await veredictChain.verificarDecisao(hashFalso);
  console.log("\nTentativa de verificar acordao FALSO atribuido ao STJ:");
  console.log("  existe na blockchain:", existeFalso, "-> documento seria BLOQUEADO pelo sistema receptor");

  console.log("\n=== RESUMO DO DEPLOY ===");
  console.log("Endereco do contrato:", enderecoContrato);
  console.log("Rede:", hre.network.name);
  console.log("Chain ID:", (await hre.ethers.provider.getNetwork()).chainId.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
