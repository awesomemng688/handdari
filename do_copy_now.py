import os

# Read handarilogo.png
src = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
dst = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"

print(f"Reading {src}...")
with open(src, 'rb') as f:
    data = f.read()
print(f"Read {len(data)} bytes")

print(f"Writing {dst}...")
with open(dst, 'wb') as f:
    f.write(data)
print(f"Written {os.path.getsize(dst)} bytes")

# Read handdariicon.jpg
src2 = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"
dst2 = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"

print(f"Reading {src2}...")
with open(src2, 'rb') as f:
    data = f.read()
print(f"Read {len(data)} bytes")

print(f"Writing {dst2}...")
with open(dst2, 'wb') as f:
    f.write(data)
print(f"Written {os.path.getsize(dst2)} bytes")

print("DONE!")