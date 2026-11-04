# HANDARI-г GitHub-д оруулах

Windows-ийн `C:\Users\Awesome\Desktop\HANDARI_v1.0` хавтсыг тусдаа repository болгоно. Эцэг `C:\Users\Awesome` болон `E:\cs2website` repository-г ашиглахгүй.

1. https://github.com/new нээж Repository name = HANDARI, Visibility = Private сонгоно. README, .gitignore, license автоматаар нэмэх сонголтыг унтрааж хоосон repository үүсгэнэ.
2. Windows PowerShell дээр төслийн хавтаст орно:

```powershell
cd C:\Users\Awesome\Desktop\HANDARI_v1.0
git rev-parse --show-toplevel
```

Зам яг HANDARI_v1.0 хавтас байх ёстой. Хэрэв эцэг хавтас гарвал энд `git init -b main` ажиллуулаад дахин шалгана. Эцэг хавтсанд `git add .` хийхгүй.

3. Эхний commit хийх:

```powershell
git add .
git status --short
git commit -m "Add HANDARI v1.3 registration and admin panel"
```

`.gitignore` нь data/, backups/, .qa/, өмнөх code/database backup, *.sqlite, *.hbk, *.key, *.pem, .env болон ZIP файлуудыг хасна. Хуучин Firebase файлууд legacy/ дотор локал хадгалагдаж, идэвхтэй кодын repository-д орохгүй. Зургуудын эх нь public/assets дотор орно. `deploy/backup.env.example` нь хоосон загвар тул орж болно; бодит backup.env орохгүй.

4. Шинэ GitHub repository-ийн HTTPS URL-ийг хэрэглэнэ. Өөрийн GitHub username, repo нэрийг зөв тааруулна:

```powershell
git remote add origin https://github.com/USERNAME/HANDARI.git
git push -u origin main
```

GitHub нэвтрэх browser цонх гарвал өөрийн дансаар нэвтэрнэ. GitHub token/password-ийг файл, чат, remote URL дотор бичихгүй. `origin already exists` гэвэл дахин нэмэхийн өмнө `git remote -v` шалгана; өөр repository руу force push хийхгүй.

GitHub нь код хадгална. Өөрөө Ubuntu дээр ажиллаж буй Node сервер болон SQLite өгөгдлийг орлохгүй. GitHub Pages дээр энэ backend ажиллахгүй.

Албан ёсны заавар: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
