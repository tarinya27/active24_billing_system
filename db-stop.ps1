# Stops the local portable PostgreSQL for Active24.
$bin = Join-Path $PSScriptRoot '.pg\bin'
$data = Join-Path $PSScriptRoot '.pgdata'
& "$bin\pg_ctl.exe" -D $data stop
Write-Host "PostgreSQL stopped."
