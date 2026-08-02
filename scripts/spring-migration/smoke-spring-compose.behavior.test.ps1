$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$smokeScript = Join-Path $repositoryRoot "scripts\spring-migration\smoke-spring-compose.ps1"

function Assert-True {
    param([bool]$Condition, [string]$Message)

    if (-not $Condition) {
        throw $Message
    }
}

function Invoke-SmokeScenario {
    param([ValidateSet("success", "ownership-mismatch", "cleanup-failure")][string]$Mode)

    $global:scenarioMode = $Mode
    $global:dockerCalls = [System.Collections.Generic.List[string]]::new()
    $global:projectNames = [System.Collections.Generic.List[string]]::new()
    $global:smokeSecrets = [System.Collections.Generic.List[object]]::new()

    function global:docker {
        param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

        $global:dockerCalls.Add(($Arguments -join " "))
        $projectIndex = [Array]::IndexOf($Arguments, "--project-name")
        if ($projectIndex -ge 0) {
            $global:projectNames.Add($Arguments[$projectIndex + 1])
        }

        $global:LASTEXITCODE = 0
        if ($Arguments[0] -eq "inspect") {
            if ($global:scenarioMode -eq "ownership-mismatch") {
                Write-Output '{"Config":{"Labels":{"com.docker.compose.project":"unowned-smoke"}}}'
            } else {
                Write-Output "{`"Config`":{`"Labels`":{`"com.docker.compose.project`":`"$($global:projectNames[0])`"}}}"
            }
            return
        }
        if ($Arguments[0] -ne "compose") {
            return
        }
        if ($Arguments -contains "up") {
            $global:smokeSecrets.Add([pscustomobject]@{
                Auth = $env:AUTH_TOKEN_SECRET
                BffAssertion = $env:VIBEHR_BFF_ASSERTION_SECRET
            })
        }
        if ($Arguments -contains "port") {
            Write-Output "127.0.0.1:38123"
            return
        }
        if (($Arguments -contains "ps") -and ($Arguments -contains "--quiet")) {
            if ($global:scenarioMode -eq "ownership-mismatch") {
                Write-Output "mock-container"
            }
            return
        }
        if (($Arguments -contains "down") -and $global:scenarioMode -eq "cleanup-failure") {
            $global:LASTEXITCODE = 41
        }
    }

    function global:node {
        param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

        $global:LASTEXITCODE = 0
    }

    $errorRecord = $null
    try {
        & $smokeScript
    } catch {
        $errorRecord = $_
    } finally {
        Remove-Item Function:\global:docker -ErrorAction SilentlyContinue
        Remove-Item Function:\global:node -ErrorAction SilentlyContinue
    }

    [pscustomobject]@{
        Error = $errorRecord
        Calls = @($global:dockerCalls)
        ProjectNames = @($global:projectNames)
        Secrets = @($global:smokeSecrets)
    }
}

$originalAuthSecretWasDefined = Test-Path Env:AUTH_TOKEN_SECRET
$originalBffAssertionSecretWasDefined = Test-Path Env:VIBEHR_BFF_ASSERTION_SECRET
$originalAuthSecret = $env:AUTH_TOKEN_SECRET
$originalBffAssertionSecret = $env:VIBEHR_BFF_ASSERTION_SECRET
try {
    $env:AUTH_TOKEN_SECRET = "preexisting-auth-secret"
    $env:VIBEHR_BFF_ASSERTION_SECRET = "preexisting-bff-assertion-secret"
    $success = Invoke-SmokeScenario "success"
    Assert-True ($env:AUTH_TOKEN_SECRET -eq "preexisting-auth-secret") "The smoke script did not restore the previous auth secret."
    Assert-True ($env:VIBEHR_BFF_ASSERTION_SECRET -eq "preexisting-bff-assertion-secret") "The smoke script did not restore the previous BFF assertion secret."
} finally {
    if ($originalAuthSecretWasDefined) {
        $env:AUTH_TOKEN_SECRET = $originalAuthSecret
    } else {
        Remove-Item Env:AUTH_TOKEN_SECRET -ErrorAction SilentlyContinue
    }
    if ($originalBffAssertionSecretWasDefined) {
        $env:VIBEHR_BFF_ASSERTION_SECRET = $originalBffAssertionSecret
    } else {
        Remove-Item Env:VIBEHR_BFF_ASSERTION_SECRET -ErrorAction SilentlyContinue
    }
}

Assert-True ($null -eq $success.Error) "The mocked success scenario failed: $($success.Error)"
Assert-True ($success.ProjectNames.Count -gt 0) "The smoke script did not invoke Compose with a project name."
Assert-True (($success.ProjectNames | Select-Object -Unique).Count -eq 1) "The smoke script used more than one project namespace."
Assert-True ($success.ProjectNames[0] -match '^vibehr-spring-smoke-[0-9a-f]{12}$') "The smoke script did not generate a safe internal project namespace."
Assert-True (($success.Calls -join "`n") -match 'compose --project-name .* down --volumes --remove-orphans') "The success scenario did not perform Compose cleanup."
Assert-True ($success.Secrets.Count -eq 1) "The smoke script did not inject secrets before Compose startup."
Assert-True ($success.Secrets[0].Auth -match '^[0-9a-f]{64}$') "The smoke script did not inject a valid 256-bit auth secret."
Assert-True ($success.Secrets[0].BffAssertion -match '^[0-9a-f]{64}$') "The smoke script did not inject a valid 256-bit BFF secret."
Assert-True ($success.Secrets[0].Auth -ne $success.Secrets[0].BffAssertion) "The smoke script reused its auth secret for BFF assertions."

$ownershipMismatch = Invoke-SmokeScenario "ownership-mismatch"
Assert-True ($null -ne $ownershipMismatch.Error) "The smoke script accepted a resource with a mismatched ownership label."
Assert-True ($ownershipMismatch.Error.ToString() -match 'Refusing to tear down') "The ownership mismatch did not report a safe refusal."
Assert-True (-not (($ownershipMismatch.Calls -join "`n") -match ' down --volumes --remove-orphans')) "The smoke script ran destructive cleanup after an ownership mismatch."

$cleanupFailure = Invoke-SmokeScenario "cleanup-failure"
Assert-True ($null -ne $cleanupFailure.Error) "A native Docker cleanup failure did not propagate."
Assert-True ($cleanupFailure.Error.ToString() -match 'exit code 41') "The cleanup failure did not preserve the native Docker exit code."
Assert-True (($cleanupFailure.Calls -join "`n") -match 'compose --project-name .* down --volumes --remove-orphans') "The cleanup-failure scenario did not reach Compose teardown."

Write-Output "Spring compose smoke behavioral tests passed."
