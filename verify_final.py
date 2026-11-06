import os

files = [
    r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png",
    r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png",
    r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg",
    r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png",
]

for f in files:
    if os.path.exists(f):
        size = os.path.getsize(f)
        with open(f, 'rb') as fp:
            header = fp.read(20)
        print(f"{f}: {size} bytes, header: {header.hex()}")
    else:
        print(f"{f}: NOT FOUND")

print("\n--- Copying ---")

# Copy logo
src = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
dst = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"
with open(src, 'rb') as f:
    data = f.read()
with open(dst, 'wb') as f:
    f.write(data)
print(f"Copied logo: {len(data)} bytes")

# Copy icon
src2 = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"
dst2 = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"
with open(src2, 'rb') as f:
    data = f.read()
with open(dst2, 'wb') as f:
    f.write(data)
print(f"Copied icon: {len(data)} bytes")

print("\n--- After copy ---")
for f in files:
    if os.path.exists(f):
        size = os.path.getsize(f)
        with open(f, 'rb') as fp:
            header = fp.read(20)
        print(f"{f}: {size} bytes, header: {header.hex()}")
    else:
        print(f"{f}: NOT FOUND")