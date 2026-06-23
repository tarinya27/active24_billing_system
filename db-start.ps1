# Starts the local portable PostgreSQL for Active24 (port 5432).
$bin = Join-Path $PSScriptRoot '.pg\bin'
$data = Join-Path $PSScriptRoot '.pgdata'
$log = Join-Path $data 'server.log'
& "$bin\pg_ctl.exe" -D $data -o "-p 5432" -l $log start
Write-Host "PostgreSQL started on localhost:5432 (data: $data)"
