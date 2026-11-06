import os

# Read source files
src_logo = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handarilogo.png"
src_icon = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\handdariicon.jpg"

dst_logo = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\assets\handari_logo.png"
dst_icon = r"C:\Users\Awesome\Desktop\HANDARI_v1.0\public\icon.png"

print("Reading source files...")

# Read logo
with open(src_logo, 'rb') as f:
    logo_data = f.read()
print(f"Logo: {len(logo_data)} bytes, first 20: {logo_data[:20].hex()}")

# Read icon
with open(src_icon, 'rb') as f:
    icon_data = f.read()
print(f"Icon: {len(icon_data)} bytes, first 20: {icon_data[:20].hex()}")

# Write to destination
with open(dst_logo, 'wb') as f:
    f.write(logo_data)
print(f"Written logo: {os.path.getsize(dst_logo)} bytes")

with open(dst_icon, 'wb') as f:
    f.write(icon_data)
print(f"Written icon: {os.path.getsize(dst_icon)} bytes")

print("Done!")