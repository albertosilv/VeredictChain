import { Module, Global } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';
import { blockchainConfig } from '../config';

/** Token para injeção do contrato VeredictChain. */
export const VEREDICT_CONTRACT = 'VEREDICT_CONTRACT';

/** Token para injeção do signer com gerenciamento local de nonce. */
export const NONCE_MANAGED_SIGNER = 'NONCE_MANAGED_SIGNER';

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
      /**
       * O Wallet é envolvido em NonceManager, que gerencia o nonce
       * localmente em memória (incrementando a cada envio) em vez de
       * reconsultar `getTransactionCount("pending")` a cada transação.
       *
       * MOTIVAÇÃO: como o Wallet é um provider singleton compartilhado por
       * toda a aplicação, transações sequenciais rápidas (ex.: registrar
       * uma decisão e, logo em seguida, arquivá-la) podem colidir no mesmo
       * nonce se depender só da consulta "pending" ao node — confirmado em
       * teste real (erro `NONCE_EXPIRED`/"nonce has already been used" ao
       * arquivar uma decisão logo após registrá-la). NonceManager é a
       * solução documentada pela própria `ethers` para esse cenário.
       */
      provide: NONCE_MANAGED_SIGNER,
      useFactory: (wallet: ethers.Wallet) => new ethers.NonceManager(wallet),
      inject: [ethers.Wallet],
    },
    {
      provide: VEREDICT_CONTRACT,
      useFactory: (
        cfg: ConfigType<typeof blockchainConfig>,
        signer: ethers.NonceManager,
      ) =>
        new ethers.Contract(cfg.contractAddress, loadABI(), signer),
      inject: [blockchainConfig.KEY, NONCE_MANAGED_SIGNER],
    },
  ],
  exports: [ethers.JsonRpcProvider, ethers.Wallet, VEREDICT_CONTRACT, NONCE_MANAGED_SIGNER],
})
export class BlockchainModule {}
