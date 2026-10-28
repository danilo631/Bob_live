param(
  [ValidateSet("qwen2.5:0.5b", "qwen2.5:1.5b")]
  [string]$Modelo = "qwen2.5:0.5b",
  [string]$TikTok = "nexttec_1"
)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repo

Write-Host ""
Write-Host "=== Bob Live Web | IA e voz no seu computador ===" -ForegroundColor Cyan
Write-Host "TikTok: @$TikTok | Modelo de IA: $Modelo"
Write-Host "A pagina web fica no GitHub Pages; o stream e o processamento ficam no PC."
Write-Host ""

if (-not (Test-Path "upstream\game\project.godot")) {
  throw "Submodulo ausente. Execute: git submodule update --init --recursive"
}
foreach ($bin in @("python", "node", "npm", "ollama")) {
  if (-not (Get-Command $bin -ErrorAction SilentlyContinue)) {
    throw "Falta $bin no PATH. Instale Python 3.11, Node.js LTS e Ollama. Veja README.md."
  }
}

& python scripts/prepare_web.py
if ($LASTEXITCODE -ne 0) { throw "Falha ao preparar o projeto Web." }
& npm ci --prefix .generated/server
if ($LASTEXITCODE -ne 0) { throw "Falha no npm ci." }

# Verifica se Ollama ja esta aberto; nao inicia outro servidor desnecessariamente.
$ollamaIniciadoAqui = $null
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop | Out-Null
} catch {
  Write-Host "Iniciando Ollama..." -ForegroundColor Yellow
  $exe = (Get-Command ollama -ErrorAction Stop).Source
  $ollamaIniciadoAqui = Start-Process -FilePath $exe -ArgumentList "serve" -WindowStyle Hidden -PassThru
  $pronto = $false
  for ($i = 0; $i -lt 80; $i++) {
    Start-Sleep -Seconds 1
    try {
      Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop | Out-Null
      $pronto = $true
      break
    } catch {}
  }
  if (-not $pronto) { throw "Ollama nao respondeu na porta 11434." }
}
Write-Host "Baixando/carregando modelo $Modelo (primeira vez requer internet)..." -ForegroundColor Cyan
& ollama pull $Modelo
if ($LASTEXITCODE -ne 0) { throw "Falha ao baixar o modelo Ollama." }

# A transmissao/captura acontece no navegador com OBS ou TikTok LIVE Studio.
# SAPI e a sintese de voz local do Windows. Nenhuma chave/API externa e necessaria.
$env:TIKTOK_USERNAME = $TikTok
$env:PORT = "9393"
$env:AI_PROVIDER = "ollama"
$env:OLLAMA_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = $Modelo
$env:OLLAMA_NUM_CTX = "4096"
$env:REPLY_LENGTH = "curta"
$env:TTS_PROVIDER = "sapi"
$env:SAPI_VOICE = "Maria"
$env:VOICE_AUTOSTART = "0"

Write-Host ""
Write-Host "Servidor local: http://127.0.0.1:9393" -ForegroundColor Green
Write-Host "Pagina publica (apos ativar Pages): https://danilo631.github.io/Bob_live/" -ForegroundColor Green
Write-Host "Abra esta pagina NO MESMO PC em que este script roda." -ForegroundColor Yellow
Write-Host "Mantenha esta janela aberta enquanto estiver ao vivo. CTRL+C encerra." -ForegroundColor Yellow
Write-Host ""
try {
  & node .generated/server/src/index.js
} finally {
  if ($null -ne $ollamaIniciadoAqui -and -not $ollamaIniciadoAqui.HasExited) {
    Stop-Process -Id $ollamaIniciadoAqui.Id -ErrorAction SilentlyContinue
  }
}
