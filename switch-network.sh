#!/usr/bin/env bash
# switch-network.sh — Alterna o backend entre Hardhat local e Besu
# Uso: ./switch-network.sh hardhat|besu
set -euo pipefail

NETWORK="${1:-}"
BACKEND_DIR="$(dirname "$0")/backend"

if [ "$NETWORK" != "hardhat" ] && [ "$NETWORK" != "besu" ]; then
  echo "Uso: $0 hardhat|besu"
  echo ""
  echo "  hardhat  → usa rede Hardhat local (chainId 31337)"
  echo "  besu     → usa rede Besu da disciplina (chainId 1337)"
  exit 1
fi

cp "$BACKEND_DIR/.env.$NETWORK" "$BACKEND_DIR/.env"
echo "✅ Backend configurado para a rede: $NETWORK"
echo "📄 Arquivo: backend/.env"
echo ""
echo "⚠️  Lembre-se:"
echo "   1. Inicie o nó correto (hardhat node OU besu) na porta 8545"
echo "   2. Faça o deploy do contrato: cd contracts && npm run deploy:$NETWORK"
echo "   3. Atualize VEREDICTCHAIN_ADDRESS no backend/.env com o endereço do deploy"
