# ai-spend-monitor push 脚本
# 用法: PowerShell 里跑 .\push.ps1
# 前提: FastGithub 已开（如未开请先开），git remote 已配 origin

$ErrorActionPreference = "Stop"
$repo = "C:\Users\王志勇\Desktop\ai-spend-monitor项目\源代码"

Write-Host "[1/4] 进入仓库..." -ForegroundColor Cyan
Set-Location $repo

Write-Host "[2/4] 当前 commit:" -ForegroundColor Cyan
git log --oneline -3
Write-Host ""

Write-Host "[3/4] 检查未推送 commit 数:" -ForegroundColor Cyan
$unpushed = git log --oneline origin/main..HEAD 2>$null
if ($unpushed) {
  Write-Host "  待推送: $($unpushed.Count) 个" -ForegroundColor Yellow
  $unpushed | ForEach-Object { Write-Host "    $_" }
} else {
  Write-Host "  无未推送（可能已推送过）" -ForegroundColor Green
}
Write-Host ""

Write-Host "[4/4] 推送 (FastGithub 已开时直连, 未开可能 443 timeout)..." -ForegroundColor Cyan
# 不要用 `2>&1` —— PowerShell 5.1 会把 git.exe stderr 当 PowerShell 自己的 error
git push origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✓ push 成功" -ForegroundColor Green
  Write-Host "  验证: https://github.com/ASL-K/ai-spend-monitor" -ForegroundColor Cyan
} else {
  Write-Host ""
  Write-Host "✗ push 失败 (exit $LASTEXITCODE)" -ForegroundColor Red
  Write-Host "  检查: 1) FastGithub 在跑?  2) gh auth login?  3) origin URL 对?" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "按 Enter 退出"
