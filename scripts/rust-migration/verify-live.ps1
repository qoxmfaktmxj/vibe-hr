[CmdletBinding()]
param([string]$BackendImage = 'vibehr-backend-rust:live-test')
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$run = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(3)).ToLowerInvariant()
$pg = "vibehr-financial-20261017-$run"
$api = "vibehr-financial-api-$run"
$db = 'vibehr_financial_20261017'
$password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$env:AUTH_TOKEN_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:VIBEHR_BFF_ASSERTION_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:POSTGRES_PASSWORD = $password
$env:FLYWAY_PASSWORD = $password
$env:DATABASE_URL = "postgres://vibehr:$password@127.0.0.1:5432/$db"
$env:VIBEHR_TIME_PAYROLL_CONTAINER = $pg
$env:VIBEHR_FINANCIAL_E2E = 'isolated-only'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:CI = '1'
$frontend = Join-Path $repo 'frontend'
$migrations = Join-Path $repo 'backend-spring/src/main/resources/db/migration'
$resource = "type=bind,src=$migrations,dst=/migrations,readonly"
$label = "codex.proof=$run"

function Stop-ProofContainer([string]$Name) {
    $ids = @(docker ps -aq --filter "name=^/${Name}$" --filter "label=$label")
    if ($ids.Count -eq 1) { docker rm -fv $ids[0] | Out-Null }
}

function Invoke-PlaywrightProof([string]$Suite, [string[]]$Arguments) {
    $log = Join-Path ([IO.Path]::GetTempPath()) "vibehr-browser-$run-$Suite.log"
    $PSNativeCommandUseErrorActionPreference = $false
    npx playwright test @Arguments 2>&1 | Tee-Object -FilePath $log
    if ($LASTEXITCODE -eq 0) { return }
    $output = Get-Content -Raw -LiteralPath $log
    if ($output -match 'This command stopped to show the upgrade recommendation' -and
        $output -match 'config.webServer was not able to start' -and $output -notmatch 'Running \d+ tests? using') {
        npx playwright test @Arguments
        if ($LASTEXITCODE -eq 0) { return }
    }
    throw "Browser verification failed for $Suite. See $log and the Playwright output directory."
}

try {
    docker build -t $BackendImage (Join-Path $repo 'backend-rust')
    docker run -d --name $pg --label $label --label codex.task=financial-finalization-20261017 -p 127.0.0.1::5432 -p 127.0.0.1::8080 -e POSTGRES_USER=vibehr -e POSTGRES_PASSWORD -e "POSTGRES_DB=$db" postgres:16-alpine | Out-Null
    for ($attempt=0; $attempt -lt 40; $attempt++) {
        if ((docker inspect --format '{{.State.Running}}' $pg) -ne 'true') { throw 'Fixture PostgreSQL exited' }
        $ready = docker logs $pg 2>&1 | Select-String 'PostgreSQL init process complete'
        if ($ready) { break }
        Start-Sleep -Seconds 1
    }
    docker run --rm --network "container:$pg" -e DATABASE_URL -e VIBEHR_SCHEMA_OWNER=flyway $BackendImage schema-preflight
    docker run --rm --network "container:$pg" --mount $resource -e FLYWAY_LOCATIONS=filesystem:/migrations -e "FLYWAY_URL=jdbc:postgresql://127.0.0.1:5432/$db" -e FLYWAY_USER=vibehr -e FLYWAY_PASSWORD -e FLYWAY_CLEAN_DISABLED=true -e FLYWAY_BASELINE_ON_MIGRATE=false redgate/flyway:12.4.0 migrate
    docker run --rm --network "container:$pg" --mount $resource -e DATABASE_URL $BackendImage schema-verify /migrations/schema-metadata-manifest.json
    docker run --rm --network "container:$pg" -e DATABASE_URL -e SPRING_PROFILES_ACTIVE=local,dev-seed -e VIBEHR_ALLOW_FIXTURE_SEEDING=true $BackendImage seed dev dev
    docker run -d --name $api --label $label --network "container:$pg" -e DATABASE_URL -e AUTH_TOKEN_SECRET -e VIBEHR_BFF_ASSERTION_SECRET $BackendImage | Out-Null
    $mapping = docker port $pg 8080/tcp
    if ($mapping -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected public service binding' }
    $env:PLAYWRIGHT_API_URL = "http://$mapping"
    $portProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
    $portProbe.Start()
    $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:$($portProbe.LocalEndpoint.Port)"
    $portProbe.Stop()
    for ($attempt=0; $attempt -lt 40; $attempt++) {
        try { $r=Invoke-RestMethod "$env:PLAYWRIGHT_API_URL/api/v1/health"; if ($r.db -eq 'ok') { break } } catch { if ($attempt -eq 39) { throw } }
        Start-Sleep -Seconds 1
    }
    Push-Location $frontend
    try {
        Invoke-PlaywrightProof 'financial' @('--config','playwright.financial.config.ts','--reporter=line',"--output=./test-results/rust-live-$run-financial")
        $specs = @('hr-finalist-appointment','rust-employee-grid','lifecycle-grid-qa','org-chart','org-types','org-type-personal-status','org-type-items','org-type-upload','common-code-dirty-navigation','grid-retirement-mng-crud','grid-retirement-workflow-mutations','payroll-runs-snapshot-backfill') | ForEach-Object { "$_.spec.ts" }
        $arguments = @('--config','playwright.config.ts','--reporter=line',"--output=./test-results/rust-live-$run-workflows") + $specs
        Invoke-PlaywrightProof 'workflows' $arguments
    } finally { Pop-Location }
} finally {
    Stop-ProofContainer $api
    Stop-ProofContainer $pg
}
