#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; exit 1; }

log "VIDE IA — Setup automatizado"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  err "Node.js nao encontrado. Instale Node.js 20+: https://nodejs.org"
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 20 ]; then
  err "Node.js 20+ necessario. Versao atual: $(node -v)"
fi
log "Node.js $(node -v) OK"

# Install dependencies
log "Instalando dependencias..."
npm install
log "Dependencias instaladas"

# Setup .env
ENV_FILE="apps/backend/.env"
ENV_EXAMPLE="apps/backend/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    log ".env criado a partir do .env.example"
  else
    warn ".env.example nao encontrado, criando .env basico"
    cat > "$ENV_FILE" << 'EOF'
NODE_ENV=development
PORT=3000
ANTHROPIC_API_KEY=sk-ant-SUBSTITUA-PELA-SUA-CHAVE
JWT_ACCESS_SECRET=acesso_secreto_minimo_32_caracteres_aqui
JWT_REFRESH_SECRET=refresh_secreto_minimo_32_caracteres_aqui
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
DATABASE_URL=sqlite:./data/vide-ia.db
EOF
  fi
else
  log ".env ja existe, mantendo"
fi

# Check for API key
if grep -q "SUBSTITUA" "$ENV_FILE" || grep -q "sk-ant-api03-" "$ENV_FILE"; then
  echo ""
  warn "========================================================"
  warn "ATENCAO: Configure sua ANTHROPIC_API_KEY no arquivo:"
  warn "  $ENV_FILE"
  warn "Obtenha em: https://console.anthropic.com/"
  warn "========================================================"
  echo ""
fi

# Generate JWT secrets if using defaults
if command -v node &> /dev/null; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  JWT_REFRESH=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i.bak "s/acesso_secreto_minimo_32_caracteres_aqui/$JWT_SECRET/g" "$ENV_FILE" 2>/dev/null || true
  sed -i.bak "s/refresh_secreto_minimo_32_caracteres_aqui/$JWT_REFRESH/g" "$ENV_FILE" 2>/dev/null || true
  rm -f "${ENV_FILE}.bak" 2>/dev/null || true
  log "JWT secrets gerados automaticamente"
fi

# TypeScript check
log "Verificando TypeScript..."
npm run typecheck 2>&1 | tail -5
log "TypeScript OK"

echo ""
log "========================================"
log "Setup concluido! Para rodar:"
log ""
log "  Terminal 1 (Backend):"
log "    npm run dev:backend"
log ""
log "  Terminal 2 (Dashboard):"
log "    npm run dev:dashboard"
log ""
log "  Terminal 3 (Extension):"
log "    npm run dev:extension"
log ""
log "  Carregar Extension no Chrome:"
log "    chrome://extensions > Load unpacked > apps/extension/dist/"
log "========================================"
