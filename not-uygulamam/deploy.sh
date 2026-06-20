#!/bin/bash
set -e

echo ""
echo "============================================"
echo "  NOT UYGULAMASI - OTOMATIK DEPLOY SCRIPTI"
echo "============================================"
echo ""

APP_PIN="Nts$(shuf -i 1000-9999 -n 1)"
echo "[1/10] Sifre belirlendi: $APP_PIN"

# --- Git init ---
echo "[2/10] Git reposu hazirlaniyor..."
git init -q
git add -A
git diff --cached --quiet 2>/dev/null && echo "  -> Zaten commit edilmis, devam ediliyor..." || git commit -q -m "Not uygulamasi - ilk commit"

# --- GitHub CLI ---
echo "[3/10] GitHub CLI kontrol ediliyor..."
if ! command -v gh &>/dev/null; then
  echo "  -> gh bulunamadi, yukleniyor..."
  GH_VER="2.95.0"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    ARCH="$(uname -m)"; [[ "$ARCH" == "x86_64" ]] && ARCH="amd64" || ARCH="arm64"
    curl -sL "https://github.com/cli/cli/releases/download/v${GH_VER}/gh_${GH_VER}_macOS_${ARCH}.zip" -o /tmp/gh.zip
    unzip -qo /tmp/gh.zip -d /tmp/
  else
    curl -sL "https://github.com/cli/cli/releases/download/v${GH_VER}/gh_${GH_VER}_linux_amd64.tar.gz" -o /tmp/gh.tar.gz
    tar -xzf /tmp/gh.tar.gz -C /tmp/
  fi
  GH_BIN=$(find /tmp -name gh -path '*/bin/gh' 2>/dev/null | head -1)
  if [ -n "$GH_BIN" ]; then
    cp "$GH_BIN" /usr/local/bin/gh 2>/dev/null || export PATH="$(dirname "$GH_BIN"):$PATH"
  fi
  if ! command -v gh &>/dev/null; then echo "HATA: gh kurulamadi"; exit 1; fi
fi

if ! gh auth status &>/dev/null; then
  echo ""
  echo "  *** TARAYICI ACILACAK - GitHub'a giris yapin ***"
  echo ""
  gh auth login --web -p https
fi
echo "  -> GitHub: OK"

# --- GitHub Repo ---
echo "[4/10] GitHub reposu olusturuluyor..."
REPO_NAME="not-uygulamam"
if gh repo view "$REPO_NAME" &>/dev/null; then
  echo "  -> Repo zaten var, push ediliyor..."
  git remote remove origin 2>/dev/null || true
  REPO_URL=$(gh repo view "$REPO_NAME" --json url -q .url)
  git remote add origin "$REPO_URL"
  gh auth setup-git 2>/dev/null || true
  git push -u origin HEAD 2>/dev/null || git push -u origin main 2>/dev/null || git push -u origin master 2>/dev/null || true
else
  gh repo create "$REPO_NAME" --private --source=. --push
fi

echo "  -> GitHub: Repo hazir"

# --- Railway CLI ---
echo "[5/10] Railway CLI kontrol ediliyor..."
if ! command -v railway &>/dev/null; then
  echo "  -> railway bulunamadi, yukleniyor..."
  npm install -g @railway/cli
fi

if ! railway whoami &>/dev/null; then
  echo ""
  echo "  *** TARAYICI ACILACAK - Railway'e giris yapin ***"
  echo ""
  railway login
fi
echo "  -> Railway: OK"

# --- Railway Proje ---
echo "[6/10] Railway projesi olusturuluyor..."
railway init --name not-uygulamam 2>/dev/null || railway init

echo "[7/10] Ortam degiskenleri ayarlaniyor..."
railway variables set APP_PASSWORD="$APP_PIN"
railway variables set DATA_DIR="/data"

echo "[8/10] Volume ekleniyor..."
railway volume add --mount-path /data 2>/dev/null || echo "  -> Volume manuel eklenecek (asagiya bak)"

echo "[9/10] Deploy ediliyor..."
railway up --detach

echo "[10/10] Domain olusturuluyor..."
DOMAIN=$(railway domain 2>/dev/null || echo "")

echo ""
echo "============================================"
echo "  DEPLOY TAMAMLANDI!"
echo "============================================"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "  Link:   https://$DOMAIN"
else
  echo "  Link:   Railway Dashboard'dan domain ekleyin"
  echo "          (Settings > Networking > Generate Domain)"
fi
echo "  Sifre:  $APP_PIN"
echo ""
echo "  Baska bir sey yapmaniza gerek yok."
echo ""
echo "  NOT: Eger 'volume' adiminda hata aldiysan,"
echo "  Railway Dashboard > projen > Settings > Volumes"
echo "  kismindan /data yoluna volume ekle ve redeploy et."
echo "============================================"
echo ""
