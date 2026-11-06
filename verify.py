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