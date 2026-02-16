$env:GEMINI_API_KEY = Get-Content .env | Select-String "GEMINI_API_KEY" | ForEach-Object { $_.ToString().Split('=')[1].Trim() }
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$env:GEMINI_API_KEY"
$body = @{
    contents = @(
        @{
            parts = @(
                @{ text = "Hello" }
            )
        }
    )
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    Write-Host "SUCCESS"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "ERROR"
    Write-Host $_.Exception.Message
    Write-Host $_.ErrorDetails.Message
}
