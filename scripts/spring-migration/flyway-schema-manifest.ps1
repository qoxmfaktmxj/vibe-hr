param(
    [Parameter(Mandatory = $true)]
    [string]$JdbcUrl,
    [Parameter(Mandatory = $true)]
    [string]$Username,
    [Parameter(Mandatory = $true)]
    [string]$Password,
    [switch]$Verify
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $repositoryRoot
try {
    node scripts/spring-migration/flyway-baseline.js --verify
    $baseline = Get-Content docs/spring-migration/flyway-baseline-manifest.json -Raw | ConvertFrom-Json
    $resourceManifest = Join-Path $repositoryRoot "backend-spring/src/main/resources/db/migration/schema-metadata-manifest.json"
    $documentationManifest = Join-Path $repositoryRoot "docs/spring-migration/flyway-schema-metadata-manifest.json"
    $temporaryManifest = Join-Path $env:TEMP "vibehr-flyway-schema-metadata-manifest.json"
    $output = if ($Verify) { $temporaryManifest } else { $resourceManifest }
    Push-Location backend-spring
    try {
        ./gradlew.bat captureFlywaySchemaManifest "-PjdbcUrl=$JdbcUrl" "-Pusername=$Username" "-Ppassword=$Password" "-Pv1Sha256=$($baseline.canonical_sql_sha256)" "-Poutput=$output"
        if ($LASTEXITCODE -ne 0) { throw "Schema manifest capture failed." }
    } finally {
        Pop-Location
    }
    if ($Verify) {
        if (-not (Test-Path $resourceManifest) -or -not (Test-Path $documentationManifest)) { throw "Missing checked-in PostgreSQL schema metadata manifest." }
        if ((Get-FileHash $temporaryManifest -Algorithm SHA256).Hash -ne (Get-FileHash $resourceManifest -Algorithm SHA256).Hash) { throw "PostgreSQL metadata manifest drifted; regenerate and review it." }
        if ((Get-FileHash $resourceManifest -Algorithm SHA256).Hash -ne (Get-FileHash $documentationManifest -Algorithm SHA256).Hash) { throw "Documentation and runtime metadata manifests differ." }
        Remove-Item -LiteralPath $temporaryManifest -Force
    } else {
        Copy-Item -LiteralPath $resourceManifest -Destination $documentationManifest -Force
    }
} finally {
    Pop-Location
}
