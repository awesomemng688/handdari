import shutil
import os

src = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
dst = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"

print("Copying...")
shutil.copy2(src, dst)

print(f"Source: {os.path.getsize(src)} bytes")
print(f"Dest: {os.path.getsize(dst)} bytes")

# Verify they're identical
with open(src, 'rb') as f:
    s = f.read()
with open(dst, 'rb') as f:
    d = f.read()
print(f"Identical: {s == d}")

# Same for icon
src2 = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"
dst2 = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"
shutil.copy2(src2, dst2)
print(f"Icon source: {os.path.getsize(src2)} bytes")
print(f"Icon dest: {os.path.getsize(dst2)} bytes")