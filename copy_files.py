import shutil

# Copy handarilogo.png to handari_logo.png
src = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
dst = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"
shutil.copy2(src, dst)
print(f"Copied logo: {dst}")

# Copy handdariicon.jpg to icon.png
src2 = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"
dst2 = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"
shutil.copy2(src2, dst2)
print(f"Copied icon: {dst2}")

# Verify
import os
for f in [dst, dst2]:
    size = os.path.getsize(f)
    print(f"{f}: {size} bytes")