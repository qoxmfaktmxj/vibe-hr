$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$compose = Join-Path $repositoryRoot "docker-compose.spring-smoke.yml"
$ProjectName = "vibehr-spring-smoke-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$failure = $null
$authSecretWasDefined = Test-Path Env:AUTH_TOKEN_SECRET
$bffAssertionSecretWasDefined = Test-Path Env:VIBEHR_BFF_ASSERTION_SECRET
$previousAuthSecret = $env:AUTH_TOKEN_SECRET
$previousBffAssertionSecret = $env:VIBEHR_BFF_ASSERTION_SECRET

function New-SmokeSecret {
    $bytes = [byte[]]::new(32)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($bytes)
    } finally {
        $random.Dispose()
    }

    return [System.BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
}

function Invoke-Docker {
    param([Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$Arguments)

    & docker @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Docker command failed with exit code ${exitCode}: docker $($Arguments -join ' ')"
    }
}

function Assert-ComposeOwnership {
    $containerIds = @(Invoke-Docker compose --project-name $ProjectName -f $compose ps --all --quiet | Where-Object { $_ })
    $networkIds = @(Invoke-Docker network ls --filter "label=com.docker.compose.project=$ProjectName" --quiet | Where-Object { $_ })
    $volumeIds = @(Invoke-Docker volume ls --filter "label=com.docker.compose.project=$ProjectName" --quiet | Where-Object { $_ })

    foreach ($containerId in $containerIds) {
        $owner = ((Invoke-Docker inspect $containerId | Out-String | ConvertFrom-Json).Config.Labels.'com.docker.compose.project').Trim()
        if ($owner -ne $ProjectName) { throw "Refusing to tear down container without the expected Compose ownership label." }
    }
    foreach ($networkId in $networkIds) {
        $owner = ((Invoke-Docker network inspect $networkId | Out-String | ConvertFrom-Json).Labels.'com.docker.compose.project').Trim()
        if ($owner -ne $ProjectName) { throw "Refusing to tear down network without the expected Compose ownership label." }
    }
    foreach ($volumeId in $volumeIds) {
        $owner = ((Invoke-Docker volume inspect $volumeId | Out-String | ConvertFrom-Json).Labels.'com.docker.compose.project').Trim()
        if ($owner -ne $ProjectName) { throw "Refusing to tear down volume without the expected Compose ownership label." }
    }
}

try {
    $authSecret = New-SmokeSecret
    do {
        $bffAssertionSecret = New-SmokeSecret
    } while ($bffAssertionSecret -eq $authSecret)
    $env:AUTH_TOKEN_SECRET = $authSecret
    $env:VIBEHR_BFF_ASSERTION_SECRET = $bffAssertionSecret

    Invoke-Docker compose --project-name $ProjectName -f $compose up --build --detach --wait --wait-timeout 240
    $publishedAddress = (Invoke-Docker compose --project-name $ProjectName -f $compose port backend 8080).Trim()
    if ($publishedAddress -notmatch '^127\.0\.0\.1:\d+$') {
        throw "Spring-only compose did not publish backend:8080 on a loopback port."
    }
    $baseUrl = "http://$publishedAddress"
    node (Join-Path $repositoryRoot "scripts\spring-migration\verify-delivery.js") --image vibehr-backend-spring:smoke
    if ($LASTEXITCODE -ne 0) { throw "Spring delivery image verification failed with exit code $LASTEXITCODE." }
    node (Join-Path $repositoryRoot "scripts\spring-migration\verify-spring-openapi.js") --base-url $baseUrl
    if ($LASTEXITCODE -ne 0) { throw "Spring OpenAPI verification failed with exit code $LASTEXITCODE." }
} catch {
    $failure = $_
    try { Invoke-Docker compose --project-name $ProjectName -f $compose logs --no-color backend } catch { Write-Error $_ }
    throw
} finally {
    try {
        Assert-ComposeOwnership
        Invoke-Docker compose --project-name $ProjectName -f $compose down --volumes --remove-orphans
    } catch {
        if ($null -eq $failure) { throw }
        Write-Error "Smoke cleanup failed after the original error: $_"
    } finally {
        if ($authSecretWasDefined) {
            $env:AUTH_TOKEN_SECRET = $previousAuthSecret
        } else {
            Remove-Item Env:AUTH_TOKEN_SECRET -ErrorAction SilentlyContinue
        }
        if ($bffAssertionSecretWasDefined) {
            $env:VIBEHR_BFF_ASSERTION_SECRET = $previousBffAssertionSecret
        } else {
            Remove-Item Env:VIBEHR_BFF_ASSERTION_SECRET -ErrorAction SilentlyContinue
        }
    }
}
