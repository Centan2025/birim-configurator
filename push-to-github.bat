@echo off
chcp 65001 >nul
echo ========================================================
echo BIRIM V4.2 — GITHUB & VERCEL OTOMATIK YUKLEME ARACI
echo ========================================================
if not exist .git (
  git init
  git remote add origin https://github.com/Centan2025/birim-configurator.git
)
git checkout -B feat/configurator-parametric-engine-v4
git add -A
git commit -m "feat(v4.2): visual catalog, world-brand accessories, runner deductions, adjustable hinges, Turkish panel brands, 3000K LED & PBR showroom"
echo.
echo [1/2] feat/configurator-parametric-engine-v4 dalina push ediliyor...
git push -u origin feat/configurator-parametric-engine-v4 --force
echo.
echo Tamamlandi! Vercel otomatik Preview linkini olusturacaktir.
echo Eger dogrudan main dalini da guncellemek isterseniz: git push origin feat/configurator-parametric-engine-v4:main --force
pause
