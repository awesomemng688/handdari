import shutil
import os

# Copy handarilogo.png to handari_logo.png
src_logo = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
dst_logo = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"

# Copy handdariicon.jpg to icon.png
src_icon = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"
dst_icon = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"

print("Starting copy...")

# Check source files exist
for src in [src_logo, src_icon]:
    if os.path.exists(src):
        print(f"Source exists: {src} ({os.path.getsize(src)} bytes)")
    else:
        print(f"Source MISSING: {src}")

# Copy
shutil.copy2(src_logo, dst_logo)
print(f"Copied logo to: {dst_logo} ({os.path.getsize(dst_logo)} bytes)")

shutil.copy2(src_icon, dst_icon)
print(f"Copied icon to: {dst_icon} ({os.path.getsize(dst_icon)} bytes)")

print("Done!")