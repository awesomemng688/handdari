import os

src_logo = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
dst_logo = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"

src_icon = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"
dst_icon = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"

with open(src_logo, 'rb') as f:
    data = f.read()
with open(dst_logo, 'wb') as f:
    f.write(data)
print(f"Logo copied: {len(data)} bytes")

with open(src_icon, 'rb') as f:
    data = f.read()
with open(dst_icon, 'wb') as f:
    f.write(data)
print(f"Icon copied: {len(data)} bytes")

# Verify
for f in [dst_logo, dst_icon]:
    size = os.path.getsize(f)
    print(f"Verify {f}: {size} bytes")