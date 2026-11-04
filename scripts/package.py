"""Create a code-only Ubuntu release. Never include a database, keys or QA data."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from hashlib import sha256

root = Path(__file__).resolve().parent.parent
output = root / 'handari-v1.4.zip'
files = []
for name in ['REGISTRATION-v1.4.2.md', 'package-lock.json', 'UPGRADE-v1.4.md', 'package.json', 'server.mjs', 'index.html', 'start-handari.cmd', 'README.md', 'UPGRADE-v1.2.md', 'UPGRADE-v1.3.md', 'GITHUB.md', '.gitignore', '.gitattributes']:
    if (root / name).is_file(): files.append(root / name)
for name in ['lib', 'public', 'scripts', 'deploy', 'test']:
    files.extend(p for p in (root / name).rglob('*') if p.is_file() and not p.is_symlink())
files = sorted(set(files))
for file in files:
    parts = file.relative_to(root).parts
    assert not any(p in {'data', 'backups', '.qa', 'node_modules', '.git', '__pycache__'} for p in parts)
    assert not file.name.endswith(('.sqlite', '.hbk', '.key', '.pem'))
manifest = []
def write_source(archive, name, content):
    # ZipFile.writestr(name, ...) otherwise defaults to Unix mode 0600.
    info = ZipInfo(name)
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    info.compress_type = ZIP_DEFLATED
    archive.writestr(info, content)

with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for file in files:
        name = file.relative_to(root).as_posix()
        content = file.read_bytes()
        if file.suffix in {'.js','.mjs','.py','.html','.css','.md','.json','.sh','.cmd','.service','.timer'}:
            assert bytes([0]) not in content, f'Invalid NUL byte in {name}'
        write_source(archive, name, content)
        manifest.append(sha256(content).hexdigest() + '  ' + name)
    write_source(archive, 'RELEASE-SHA256.txt', '\n'.join(manifest) + '\n')
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert all(entry.create_system == 3 and (entry.external_attr >> 16) & 0o777 == 0o644 for entry in archive.infolist())
digest = sha256(output.read_bytes()).hexdigest()
output.with_suffix('.zip.sha256').write_text(digest + '  ' + output.name + '\n', encoding='utf-8')
print(f'Release ready: {output.name}, {len(files)} source files, {output.stat().st_size} bytes')
