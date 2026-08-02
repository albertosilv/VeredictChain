require("@nomicfoundation/hardhat-toolbox");

// Para deploy em Sepolia (testnet pública Ethereum), defina as variáveis de ambiente:
//   SEPOLIA_RPC_URL   -> endpoint RPC (ex: Infura/Alchemy)
//   PRIVATE_KEY       -> chave privada de uma carteira de teste com ETH de faucet
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      // rede de testes local, efêmera, usada para compilar/testar/demonstrar o deploy
    },
    besu: {
      url: process.env.BESU_RPC_URL || 'http://127.0.0.1:8545',
      accounts: process.env.BESU_PRIVATE_KEY ? [process.env.BESU_PRIVATE_KEY] : [],
      chainId: 1337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
};
