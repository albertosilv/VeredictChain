import { Module, Global } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';
import { blockchainConfig } from '../config';

/** Token para injeção do contrato VeredictChain. */
export const VEREDICT_CONTRACT = 'VEREDICT_CONTRACT';

/** Carrega o ABI do artefato compilado pelo Hardhat. */
function loadABI(): ethers.InterfaceAbi {
  const abiPath = join(__dirname, 'veredict-chain.abi.json');
  return JSON.parse(readFileSync(abiPath, 'utf-8'));
}

@Global()
@Module({
  providers: [
    {
      provide: ethers.JsonRpcProvider,
      useFactory: (cfg: ConfigType<typeof blockchainConfig>) =>
        new ethers.JsonRpcProvider(cfg.rpcUrl),
      inject: [blockchainConfig.KEY],
    },
    {
      provide: ethers.Wallet,
      useFactory: (
        cfg: ConfigType<typeof blockchainConfig>,
        provider: ethers.JsonRpcProvider,
      ) => new ethers.Wallet(cfg.integradorPrivateKey, provider),
      inject: [blockchainConfig.KEY, ethers.JsonRpcProvider],
    },
    {
      provide: VEREDICT_CONTRACT,
      useFactory: (
        cfg: ConfigType<typeof blockchainConfig>,
        wallet: ethers.Wallet,
      ) =>
        new ethers.Contract(cfg.contractAddress, loadABI(), wallet),
      inject: [blockchainConfig.KEY, ethers.Wallet],
    },
  ],
  exports: [ethers.JsonRpcProvider, ethers.Wallet, VEREDICT_CONTRACT],
})
export class BlockchainModule {}
