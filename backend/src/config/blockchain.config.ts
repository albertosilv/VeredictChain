import { registerAs } from '@nestjs/config';

export const blockchainConfig = registerAs('blockchain', () => ({
  rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545',
  chainId: parseInt(process.env.CHAIN_ID ?? '1337', 10),
  contractAddress:
    process.env.VEREDICTCHAIN_ADDRESS ??
    '0x42699A7612A82f1d9C36148af9C77354759b210b',
  integradorPrivateKey: process.env.INTEGRADOR_PRIVATE_KEY ?? '',
}));
