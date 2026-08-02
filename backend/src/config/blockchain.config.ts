import { registerAs } from '@nestjs/config';

export const blockchainConfig = registerAs('blockchain', () => ({
  rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545',
  chainId: parseInt(process.env.CHAIN_ID ?? '31337', 10),
  contractAddress:
    process.env.VEREDICTCHAIN_ADDRESS ??
    '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  integradorPrivateKey: process.env.INTEGRADOR_PRIVATE_KEY ?? '',
}));
