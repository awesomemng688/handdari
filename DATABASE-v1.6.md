# HANDARI v1.6 — MariaDB болон нууц үгийн баталгаажуулалт

Нууц үг солигдвол хоосон талбар харуулахын оронд ✓ **Нууц үг амжилттай солигдлоо**, **Шинэ нууц үгээр нэвтрэх** товч гарна. Энэ нь сервер хадгалалтыг баталсан үед л гарна. Нууц үг буруу эсвэл холбоос хүчингүй бол алдааг харуулна. Нууц үгийн утгыг админ болон database-аас унших боломжгүй: зөвхөн scrypt хэш хадгална.

## 1. Шинэ файлуудыг суулгах

Windows PowerShell:

```powershell
scp "C:\Users\Awesome\Desktop\HANDARI_v1.0\handari-v1.6.zip" root@203.34.37.57:/tmp/handari-v1.6.zip
```

Ubuntu:

```bash
unzip -o /tmp/handari-v1.6.zip -d /tmp/handari-v1.6 &&
bash /tmp/handari-v1.6/deploy/update.sh
```

Шинэ код эхлээд одоогийн SQLite дээр ажиллана. Google/SMTP тохиргоо өөрчлөгдөхгүй.

## 2. MariaDB руу шилжүүлэх

MariaDB 10.11+ (эсвэл MySQL 8.0+) болон root Unix socket хандалт шаардлагатай. Одоо байгаа серверийг дахин суулгахгүй, бусад сайтын database-ийг өөрчлөхгүй.

```bash
/opt/handari-node/bin/node /var/handari/scripts/setup-mysql.mjs
```

Энэ команд:

- `handari_business` тусдаа сан, `handari_app` тусдаа хэрэглэгч үүсгэнэ. Ижил нэртэй сан/хэрэглэгч байвал дарж бичихгүй, зогсоно.
- Нууц үгийг санамсаргүй үүсгэж, зөвхөн root унших `/etc/handari/database.env` файлд хадгална. Чат/GitHub-д явуулахгүй.
- Аппыг түр зогсоож, SQLite-ийн нөөцийг `/var/backups/handari/migrations` дотор үүсгэнэ.
- Хэрэглэгч, нууц үгийн хэш, Google холбоос, бизнесийн бүх бүртгэл, зургийг InnoDB транзакцаар хуулна. Хүснэгт бүрийн тоо болон SHA-256-ийг тулгана. Байгаа өгөгдөлтэй destination руу хуулж дарахгүй.
- Зөвхөн шалгалт амжилттай болсны дараа HANDARI болон өдөр тутмын backup service-ийн database тохиргоог солино.

Шилжилтээр өмнөх sessions болон сэргээх холбоосуудыг хүчингүй болгоно. Имэйл, одоогийн нууц үг/Google дансаараа дахин нэвтэрнэ. Хуучин SQLite файл хэвээр хадгалагдана.

Сан үүссэн ч шилжүүлэлт амжилтгүй бол `/etc/handari/database.env` файлыг устгахгүй; шалтгааныг зассаны дараа setup командыг дахин ажиллуулж болно. Import commit хийгдсэн мөртлөө service switch амжилтгүй бол дахин import хийхгүй: тохиргоо, migration report-ийг шалгана.

## 3. Database шалгах

```bash
/opt/handari-node/bin/node --env-file=/etc/handari/database.env /var/handari/scripts/check-database.mjs
systemctl status handari --no-pager
```

Хариунд `engine:mysql`, `integrity:ok`, хүснэгтийн тоонууд гарна. Нууц үг, имэйл, зураг болон токен харуулахгүй. Аппд нэвтрээд өмнөх найзууд, бараа, борлуулалтаа шалгана. `setup-mysql.mjs`-ийг дахин давтаж migration хийхгүй.

## 4. Нөөцлөлт

```bash
/opt/handari-node/bin/node --env-file=/etc/handari/database.env /var/handari/scripts/backup.mjs
```

MariaDB өгөгдлийг транзакцын турш түгжиж, consistent portable SQLite snapshot гаргана. Энэ файлд бүх зураг орно. Өдрийн backup өмнөх AES-GCM .hbk шифрлэлт болон SFTP тохиргоог ашиглана. Backup key, retention, remote тохиргоог өмнөхөөр нь хадгална. Timer өмнө суусан бол:

```bash
systemctl start handari-backup.service
journalctl -u handari-backup.service -n 30 --no-pager
```

Түлхүүр болон SFTP сервер тохируулаагүйг энэ шинэчлэл автоматаар шийдэхгүй. Хуучин SQLite backup/restore зааврыг MariaDB дээр шууд хэрэглэхгүй. Сэргээхдээ snapshot-ийг шинэ хоосон MariaDB сан руу `migrate-mysql.mjs`-ээр шалгаж импортлоод service-ийг холбоно.

Шилжсэний дараа шинэ MariaDB-д бүртгэл хийсэн бол хуучин SQLite руу шууд буцахад шинэ бүртгэлүүд харагдахгүй. Rollback хийхээс өмнө MariaDB snapshot авч өгөгдлөө тулгана.

## Архитектур ба шалгалт

InnoDB хүснэгт, utf8mb4 Монгол текст, гадаад түлхүүр, unique constraint, параметртэй query ашиглана. Тусдаа worker дээрх нэг DB connection нь одоогийн synchronous store contract-ийг хадгална. Бизнес үйлдлүүд нийтлэг row lock авч дарааллаар транзакц хийнэ: олон process зэрэг борлуулахад үлдэгдлийг давхар зарцуулахгүй. Энэ нь локал MariaDB болон жижиг бизнесийн ачаалалд зориулагдсан; өндөр ачааллын async connection pool архитектур биш.

Бүтээгдэхүүн, борлуулалт зэрэг өмнөх JSON records payload-ийг эвдэхгүй хадгалсан; auth болон холбоосын хүснэгтүүд тусдаа. Бүх domain өгөгдлийг энэ удаад тус тусын relational хүснэгт рүү дахин задлаагүй.

Локал MariaDB 10.11 дээр migration, Монгол текст, нууц үгийн хэш, зураг, нэвтрэлт, үлдэгдэл, давхар хүсэлт, цуцлалт, нууц үг сэргээх, snapshot тулгалтыг шалгасан. Ubuntu production серверт migration хийсэн гэж үзэхгүй: дээрх командыг сервер дээр ажиллуулж үр дүнг шалгана.
