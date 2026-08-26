#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# Smart Space TNJ - Windows EXE Builder for Linux/Ubuntu
# Builds a Windows x64 portable EXE via Electron.
# Set SMARTSPACE_BUILD_NSIS=1 to also cross-build the NSIS installer.
# ============================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

step()  { printf "\n${CYAN}${BOLD}==> %s${RESET}\n" "$*"; }
ok()    { printf "${GREEN}✓ %s${RESET}\n" "$*"; }
warn()  { printf "${YELLOW}⚠ %s${RESET}\n" "$*"; }
fail()  { printf "${RED}✗ %s${RESET}\n" "$*" >&2; exit 1; }

on_error() {
  local code=$?
  printf "\n${RED}${BOLD}BUILD GAGAL${RESET} (exit code %s)\n" "$code" >&2
  printf "Periksa pesan error beberapa baris di atas.\n" >&2
  exit "$code"
}
trap on_error ERR

printf "${BOLD}==============================================${RESET}\n"
printf "${BOLD}  SMART SPACE TNJ - BUILD WINDOWS EXE (LINUX)${RESET}\n"
printf "${BOLD}==============================================${RESET}\n"
printf "Project : %s\n" "$ROOT_DIR"
printf "Target  : Windows x64 - Portable EXE\n"
if [[ "${SMARTSPACE_BUILD_NSIS:-0}" == "1" ]]; then
  printf "Tambahan: NSIS Installer (cross-build via Wine)\n"
fi

# ---------- System checks ----------
step "Memeriksa tool build"
command -v node >/dev/null 2>&1 || fail "Node.js belum terpasang. Install Node.js LTS terlebih dahulu."
command -v npm  >/dev/null 2>&1 || fail "npm belum terpasang."

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  fail "Node.js terlalu lama ($(node -v)). Gunakan Node.js 20 LTS atau lebih baru."
fi
ok "Node.js $(node -v)"
ok "npm $(npm -v)"

# Wine is recommended/required by electron-builder for a number of Windows packaging steps.
if command -v wine64 >/dev/null 2>&1; then
  WINE_BIN="wine64"
elif command -v wine >/dev/null 2>&1; then
  WINE_BIN="wine"
else
  printf "\n${YELLOW}${BOLD}Wine belum ditemukan.${RESET}\n"
  printf "Install di Ubuntu dengan:\n\n"
  printf "  sudo apt update\n"
  printf "  sudo apt install -y wine64\n\n"
  fail "Wine diperlukan untuk cross-build Windows dari Linux."
fi
ok "Wine: $($WINE_BIN --version 2>/dev/null || echo installed)"

[[ -f package.json ]] || fail "package.json root tidak ditemukan."
[[ -f frontend/package.json ]] || fail "frontend/package.json tidak ditemukan."
[[ -f backend/package.json ]] || fail "backend/package.json tidak ditemukan."

# ---------- Dependencies ----------
step "Menginstall dependency desktop/Electron"
npm install --no-audit --no-fund
ok "Dependency desktop siap"

step "Menginstall dependency frontend"
if [[ -f frontend/package-lock.json ]]; then
  npm --prefix frontend ci --no-audit --no-fund
else
  npm --prefix frontend install --no-audit --no-fund
fi
ok "Dependency frontend siap"

step "Menginstall dependency backend"
if [[ -f backend/package-lock.json ]]; then
  npm --prefix backend ci --no-audit --no-fund
else
  npm --prefix backend install --no-audit --no-fund
fi
ok "Dependency backend siap"

# ---------- Build application ----------
step "Build frontend React"
npm run build:web
ok "Frontend selesai"

step "Build backend Express"
npm run build:api
ok "Backend selesai"

# ---------- Package Windows ----------
step "Membersihkan output release lama"
rm -rf release
mkdir -p release

step "Membuat Windows Portable EXE x64"
# Run electron-builder directly here so frontend/backend are not rebuilt twice.
# Portable is built first because it is the most reliable Windows target when
# cross-building on Linux and does not depend on Wine's RPC services.
npx electron-builder --win portable --x64
ok "Portable EXE selesai"

if [[ "${SMARTSPACE_BUILD_NSIS:-0}" == "1" ]]; then
  step "Membuat Windows NSIS Installer x64"
  npx electron-builder --win nsis --x64
  ok "NSIS Installer selesai"
else
  warn "NSIS dilewati. Build installer paling stabil dilakukan lewat BUILD_EXE.bat di Windows."
  printf "Untuk mencoba NSIS dari Linux: SMARTSPACE_BUILD_NSIS=1 ./build-exe.sh\n"
fi

# ---------- Result ----------
step "Hasil build"
mapfile -t EXE_FILES < <(find release -maxdepth 2 -type f -iname '*.exe' -print | sort)

if (( ${#EXE_FILES[@]} == 0 )); then
  warn "Build selesai tetapi file .exe tidak ditemukan di release/."
  printf "Isi folder release:\n"
  find release -maxdepth 2 -type f -printf '  %p\n' | sort || true
  exit 2
fi

printf "\n${GREEN}${BOLD}BUILD BERHASIL${RESET}\n"
for file in "${EXE_FILES[@]}"; do
  size="$(du -h "$file" | awk '{print $1}')"
  printf "  • %s (%s)\n" "$file" "$size"
done

printf "\nFile Windows siap disalin ke PC Windows.\n"
printf "PC tujuan ${BOLD}tidak perlu${RESET} menginstall Node.js, npm, atau Wine.\n"
printf "\nFolder output: ${BOLD}%s/release${RESET}\n" "$ROOT_DIR"
