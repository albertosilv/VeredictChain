const fs = require("fs");
const path = require("path");
const solc = require("solc");

function compileVeredictChain() {
  const contractPath = path.join(__dirname, "..", "contracts", "VeredictChain.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "VeredictChain.sol": { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const fatal = output.errors.filter((e) => e.severity === "error");
    output.errors.forEach((e) => console.log(e.formattedMessage));
    if (fatal.length > 0) {
      throw new Error("Falha na compilacao do contrato.");
    }
  }

  const contract = output.contracts["VeredictChain.sol"]["VeredictChain"];
  const abi = contract.abi;
  const bytecode = "0x" + contract.evm.bytecode.object;

  const buildDir = path.join(__dirname, "..", "build");
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);
  fs.writeFileSync(
    path.join(buildDir, "VeredictChain.json"),
    JSON.stringify({ abi, bytecode }, null, 2)
  );

  return { abi, bytecode };
}

if (require.main === module) {
  const { abi } = compileVeredictChain();
  console.log("Compilado com sucesso. Funcoes/eventos na ABI:", abi.length);
  console.log("Artefato salvo em build/VeredictChain.json");
}

module.exports = { compileVeredictChain };
