#!/usr/bin/env bash
set -e
echo "========================================================"
echo "BİRİM V4.2 — GITHUB & VERCEL OTOMATİK YÜKLEME ARACI"
echo "========================================================"
if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/Centan2025/birim-configurator.git
fi
git checkout -B feat/configurator-parametric-engine-v4
git add -A
git commit -m "feat(v4.2): visual catalog, world-brand accessories, runner deductions, adjustable hinges, Turkish panel brands, 3000K LED & PBR showroom" || true
git push -u origin feat/configurator-parametric-engine-v4 --force
echo "Tamamlandı! Vercel otomatik Preview Deployment bağlantısını oluşturacaktır."
