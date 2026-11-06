$src = "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
$dst = "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"
Copy-Item -Path $src -Destination $dst -Force
Write-Host "Copied logo: $src -> $dst"

$src2 = "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"
$dst2 = "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"
Copy-Item -Path $src2 -Destination $dst2 -Force
Write-Host "Copied icon: $src2 -> $dst2"

Get-ChildItem $dst, $dst2 | Select-Object Name, Length