$manifestPath = "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\manifest.webmanifest"
$content = Get-Content -Path $manifestPath -Raw

# Add icon.png to manifest if not exists
if ($content -notlike "*icon.png*") {
    $content -replace '"icons":\[', '"icons":[{ "src": "/icon.png", "sizes": "256x256", "type": "image/png", "purpose": "any maskable" },' | Set-Content -Path $manifestPath -NoNewline
    Write-Host "Manifest updated with icon.png"
} else {
    Write-Host "Manifest already contains icon.png"
}

Write-Host "Done"