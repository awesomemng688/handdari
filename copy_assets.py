import shutil
import os

src_logo = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
dst_logo = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"

src_icon = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"
dst_icon = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"

try:
    shutil.copy2(src_logo, dst_logo)
    print(f"Copied logo: {dst_logo}")
except Exception as e:
    print(f"Error copying logo: {e}")

try:
    shutil.copy2(src_icon, dst_icon)
    print(f"Copied icon: {dst_icon}")
except Exception as e:
    print(f"Error copying icon: {e}")

# List files
for root, dirs, files in os.walk(r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public"):
    for f in files:
        full = os.path.join(root, f)
        print(f"{full} - {os.path.getsize(full)} bytes")