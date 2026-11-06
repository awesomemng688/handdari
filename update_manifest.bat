@echo off
cd /d C:\Users\Awesome\Desktop\HANDARI_v1.0
echo Updating manifest.webmanifest...
(
echo {"id": "/","name": "HANDARI — Хандарь ХХК","short_name": "HANDARI","lang": "mn","start_url": "/","scope": "/","display": "standalone","background_color": "#faf8fb","theme_color": "#5b316c","icons": [{"src": "/icon-192.png","sizes": "192x192","type": "image/png","purpose": "any maskable"},{"src": "/icon-512.png","sizes": "512x512","type": "image/png","purpose": "any maskable"},{"src": "/icon.png","sizes": "256x256","type": "image/png","purpose": "any maskable"}]}
) > public\manifest.webmanifest
echo Manifest updated!
echo.
echo Now restart your server or pull changes.
pause