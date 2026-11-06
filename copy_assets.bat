@echo off
echo Copying logo and icon files...
copy /y "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png" "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"
copy /y "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg" "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"
echo.
echo Verifying copied files:
dir "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"
dir "C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"
echo.
echo Done!
pause