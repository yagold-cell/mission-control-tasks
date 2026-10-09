# Pushes the app's secrets to Vercel.
#
#   powershell -File scripts/set-vercel-env.ps1
#
# Both values are read out of .env.local, so nothing is typed on the command
# line and no secret lands in shell history. Put these two lines there:
#
#   OPENAI_API_KEY=sk-...
#   VERCEL_APP_PASSWORD=the-password-for-the-live-site
#
# VERCEL_APP_PASSWORD is deliberately NOT called APP_PASSWORD: the local app
# ignores it, so your machine stays open while the deployed site is locked.
# -Password still works if you would rather pass it in directly.

param(
  [string]$Password
)

Set-Location (Join-Path $PSScriptRoot "..")

# Read the inputs with Stop, so a bad file fails loudly and early.
$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env.local")) { throw "No .env.local here. Run this from the project folder." }
$envLines = Get-Content ".env.local"

function Read-EnvValue($name) {
  $line = $envLines | Where-Object { $_ -like "$name=*" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^$name=", '').Trim().Trim('"', "'")
}

$key = Read-EnvValue "OPENAI_API_KEY"
if (-not $key -or $key.Length -lt 20) { throw "OPENAI_API_KEY is missing or malformed in .env.local" }

if (-not $Password) { $Password = Read-EnvValue "VERCEL_APP_PASSWORD" }
if (-not $Password) { throw "No password found. Add to .env.local:  VERCEL_APP_PASSWORD=your-password" }

# From here on we call npx. Windows PowerShell 5.1 turns anything a native
# command writes to stderr into a terminating ErrorRecord, and npm writes its
# "notice" lines there, so Stop would abort on perfectly normal output.
# Continue keeps us going and $LASTEXITCODE tells us what actually happened.
$ErrorActionPreference = "Continue"

function Set-Var($name, $value, $environment) {
  # Remove first so a re-run updates instead of failing on "already exists".
  cmd /c "npx vercel env rm $name $environment --yes >nul 2>&1"
  $value | cmd /c "npx vercel env add $name $environment >nul 2>&1"
  if ($LASTEXITCODE -eq 0) { Write-Host "  OK   $name -> $environment" }
  else { Write-Host "  FAIL $name -> $environment  (exit $LASTEXITCODE)" }
}

Write-Host "Pushing environment variables to Vercel..."
Set-Var "OPENAI_API_KEY" $key "production"
Set-Var "OPENAI_API_KEY" $key "preview"
Set-Var "APP_PASSWORD"   $Password "production"
Set-Var "APP_PASSWORD"   $Password "preview"

Write-Host ""
Write-Host "Current variables on Vercel:"
cmd /c "npx vercel env ls 2>&1"
