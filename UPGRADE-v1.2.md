# HANDARI v1.2 — шинэ боломжууд, Ubuntu /var/handari суулгалт

## Шинэ боломжуудыг ашиглах

**Авлага, төлбөр:** Борлуулалтын «Бодитоор төлсөн дүн» нийт үнээс бага бол бүртгэлтэй найз заавал сонгоно. Авлага, төлбөр цэснээс үлдэгдлийг хэсэгчлэн эсвэл бүтнээр хүлээн авч бүртгэнэ. Илүү төлөлт зөвшөөрөхгүй. Энэ үйлдэл банкнаас мөнгө татахгүй; бодит төлбөрийг бүртгэнэ.

Өмнөх v1.1 борлуулалтад хэдийг төлсөн мэдээлэл байгаагүй. Шинэ хувилбар тэднийг «Баталгаажаагүй» болгож хадгална. «Төлбөр баталгаажуулах» дээр тухайн үед бодитоор төлсөн дүнг оруулна. Үүнийг өнөөдрийн шинэ төлбөр гэж үзүүлэхгүй, `opening` тэмдэглэгээтэй байна. Баталгаажаагүй борлуулалт авлагын дүнд орохгүй; тоо нь тусдаа харагдана. Хуучин Firestore-ийн огноогүй архивын борлуулалт энэ тооцоонд орохгүй.

Борлуулалт цуцлахад нөөц буцаж нэмэгдэх боловч мөнгийг автоматаар буцаахгүй. «Буцаах төлбөр» үлдэгдэл харагдана; худалдан авагчид бодитоор мөнгө буцаасны дараа «Төлбөр буцаах» дээр бүртгэнэ. Буцаалтын үлдэгдлээс их дүн оруулахгүй. Төлбөр болон буцаалт бүр idempotency хамгаалалт, transaction, түүхтэй.

**Барааны зураг:** Бүтээгдэхүүний маягт → Камераар авах / Зураг сонгох. JPG, PNG, WebP; эх файл 20 MB хүртэл. Браузер 1600px хүртэл багасгаж JPEG болгоод серверт байршуулна. Сервер 5 MB хүртэл файл, MIME болон signature шалгана; SVG зөвшөөрөхгүй. Байршуулсан зураг зөвхөн нэвтэрсэн админд харагдана, кэшлэхгүй. Зураг SQLite дотор хадгалагдах тул нөөцөд хамт орно. HEIC-ийг JPG болгож сонгоно. Утасны камерын бодит ажиллагааг Samsung төхөөрөмж дээр турших шаардлагатай.

**Захиалга, хүргэлт:** Нэг захиалга нэг бүтээгдэхүүний мөртэй. Найз, бүтээгдэхүүн, тоо, үнэ, утас, хаяг, хүргэх огноо оруулна. Шинэ → Бэлтгэсэн → Хүргэсэн. «Шинэ» ба «Бэлтгэсэн» үед нөөцийг түгжихгүй. «Хүргэсэн» болгоход нөөц хүрэлцэхийг дахин шалгаж, борлуулалт, нөөцийн хасалт, төлбөрийг нэг transaction-аар үүсгэнэ. Нэг захиалгыг давхар хүргэж борлуулалт үүсгэхгүй. Хүргэхээс өмнө цуцлахад нөөц, борлуулалт өөрчлөгдөхгүй. Хүргэсэн борлуулалтыг цуцалбал хүргэсэн түүх хэвээр үлдэж, холбогдох борлуулалт цуцлагдсан төлөвтэй болно.

**Нөөцийн мэдэгдэл:** Бүтээгдэхүүний «Нөөцийн анхааруулах хэмжээ»-г тохируулна. Үлдэгдэл тэр хэмжээнд эсвэл доор ороход аппын толгойн мэдэгдлийн тоо, цэс, анхааруулга гарна. Нөөц нэмэгдэхэд анхааруулга хаагдана. Уншсан болгох боломжтой; нөөц дахин буурахад шинэчлэгдэнэ. Апп нээлттэй, хэрэглэгч маягт бөглөөгүй үед 60 секунд тутам мэдээллийг шинэчилнэ. Апп хаалттай үед push, SMS илгээхгүй.

**Найзын худалдан авалтын түүх:** Найзууд → Жагсаалт → Түүх. Тухайн найзын бүх борлуулалт, төлсөн дүн, авлага, буцаалт, захиалга харагдана. Түүхтэй найзыг устгахгүй; идэвхгүй болгож болно.

## Windows-ийн шинэчлэлт

Хуучин сервер ажиллаж байвал Ctrl+C → `start-handari.cmd` дахин нээнэ. Админаа дахин үүсгэх шаардлагагүй. `data/handari.sqlite` болон өмнөх бүртгэлүүдийг шинэчлэлтийн кодоор солихгүй. Сервер эхлэхэд хуучин төлбөрийн тэмдэглэгээний migration нэг удаа transaction-аар ажиллана.

## Хоосон /var/handari хавтаст серверийн файлуудыг оруулах

1. Windows **PowerShell** дээр дараах командыг ажиллуулна. `SERVER_IP`-г speed серверийн бодит IP эсвэл өөрийн SSH alias-аар солино. Энэ нь нөөцийн нөгөө сервер биш, апп ажиллуулах сервер юм.

```powershell
scp C:\Users\Awesome\Desktop\HANDARI_v1.0\handari-v1.2.zip root@SERVER_IP:/var/handari/
```

2. Ubuntu (`root@speed`) дээр:

```sh
cd /var/handari
apt update
apt install unzip nginx certbot python3-certbot-nginx openssh-client
unzip -n handari-v1.2.zip
node --version
```

Энэ ZIP нь код, зураг, тохиргооны загвартай. Нууц үг, SQLite, SSH түлхүүр, тестийн browser profile агуулахгүй. `unzip -n` байгаа файлыг дарж бичихгүй — энэ команд **анхны хоосон суулгалтад** зориулсан. Дараагийн release шинэчлэхдээ эхлээд сангаа нөөцөлж, кодыг тусдаа staging хавтаст задлан service-ийг зогсоосны дараа шилжүүлнэ. Node 24.14+ байх ёстой; байхгүй бол албан ёсны Node.js 24 LTS суулгана. `command -v node`-ийн замыг service-ийн `/usr/bin/node`-той тулгана.

3. Анхны хэрэглэгч ба service:

```sh
id handari || useradd --system --home-dir /var/lib/handari --shell /usr/sbin/nologin handari
install -d -o handari -g handari -m 700 /var/lib/handari
chown root:handari /var/handari
chmod 750 /var/handari
find /var/handari/scripts /var/handari/lib /var/handari/public /var/handari/deploy -type d -exec chown root:handari {} + -exec chmod 750 {} +
find /var/handari/scripts /var/handari/lib /var/handari/public /var/handari/deploy -type f -exec chown root:handari {} + -exec chmod 640 {} +
chown root:handari /var/handari/server.mjs /var/handari/package.json
chmod 640 /var/handari/server.mjs /var/handari/package.json
sudo -u handari env DB_PATH=/var/lib/handari/handari.sqlite /usr/bin/node /var/handari/scripts/admin.mjs
```

Файлууд `/var/handari` дотроо root эзэмшилтэй, handari хэрэглэгч уншиж чаддаг байна. Зөвхөн сан, нөөц, SSH түлхүүрийн хавтаст үйлчилгээ бичнэ. Windows-ийн санг шилжүүлэх бол ажиллаж байгаа SQLite файлыг шууд хуулж болохгүй: Windows дээр `npm run backup` аваад, Ubuntu service зогссон үед тэр нөөцийг `/var/lib/handari/handari.sqlite` болгоно; owner handari, mode 600. Ингэвэл өмнөх админ, найз, борлуулалтууд хамт ирнэ. Нөөцөд хувийн мэдээлэл байгаа тул SSH-ээр дамжуулна.

4. `deploy/handari.service`, `deploy/nginx.conf` дахь `handari.example.com`-ийг бодит домэйноор солино. Домэйнээ speed серверийн IP рүү чиглүүлнэ. `APP_ORIGIN=https://бодит-домэйн`, төгсгөлд `/` байхгүй. `deploy/nginx.conf` нь тусдаа virtual host; speed-ийн одоогийн default болон бусад сайтуудыг устгахгүй.

```sh
cp /var/handari/deploy/handari.service /etc/systemd/system/handari.service
cp /var/handari/deploy/nginx.conf /etc/nginx/sites-available/handari
ln -s /etc/nginx/sites-available/handari /etc/nginx/sites-enabled/handari
nginx -t
systemctl daemon-reload
systemctl enable --now handari
systemctl reload nginx
certbot --nginx -d handari.example.com
```

Certbot команд дахь домэйныг мөн солино. HTTPS бэлэн болсон үед нэвтэрнэ. SSH-ийн одоогийн портоо хадгалж 80/443 нээнэ; 3100 портыг нийтэд нээхгүй. `journalctl -u handari -n 80 --no-pager`-аар алдааг шалгана.

## Өдөр тутмын шифрлэсэн нөөц

Нөөц нь SQLite online backup → gzip → AES-256-GCM шифрлэл → `.hbk` файл → сонголтоор өөр серверт SFTP гэсэн дарааллаар ажиллана. Зургууд сан дотор тул хамт нөөцлөгдөнө. Түлхүүрийг нөөцтэй нэг файлд хийдэггүй. Хуулахдаа `.partial` нэрээр байршуулж, SFTP амжилттай дуусахад нэрийг өөрчилнө. Гаднын хуулалт алдагдвал локал шифрлэсэн нөөц үлдэж, service алдаатай дуусна. Миний буланд төлөв харагдана.

Эхлээд үндсэн speed сервер дээр:

```sh
install -d -o root -g handari -m 750 /etc/handari
install -d -o handari -g handari -m 700 /var/backups/handari /var/lib/handari/ssh
sudo -u handari /usr/bin/node /var/handari/scripts/backup-key.mjs /var/lib/handari/backup.key
cp /var/handari/deploy/backup.env.example /etc/handari/backup.env
chown root:handari /etc/handari/backup.env
chmod 640 /etc/handari/backup.env
```

**backup.key файлыг тусдаа аюулгүй газар нөөцөлнө. Энэ түлхүүргүй бол .hbk файлыг сэргээх боломжгүй.** Private key болон backup.key-ийг чат, Git, public хавтаст оруулахгүй. Түлхүүр үүсгэх командыг хуучин түлхүүр дээр дарж бичдэггүй.

Хэрэв өөр сервер хараахан байхгүй бол `BACKUP_REMOTE_HOST` хоосон үлдээнэ. Локал шифрлэсэн нөөц ажиллаж болох боловч UI «зөвхөн локал» гэж харуулна; өөр төхөөрөмж рүү нөөцлөгдсөн гэсэн үг биш.

### SSH/SFTP-ийн нөгөө серверийг тохируулах

Нөгөө серверийн IP-г үйлчилгээний удирдлагын самбараас, username-г `whoami`-аар авна. SSH порт өөрчлөөгүй бол ихэвчлэн 22. Нөгөө сервер дээр нөөцийн тусдаа хэрэглэгч, түүнд бичих эрхтэй `/home/backup/handari` зэрэг хавтас бэлдэнэ.

Үндсэн speed серверт backup зориулсан SSH key үүсгэнэ:

```sh
sudo -u handari ssh-keygen -t ed25519 -f /var/lib/handari/ssh/backup_ed25519 -N '' -C handari-backup
cat /var/lib/handari/ssh/backup_ed25519.pub
```

Энэ `.pub` нь public key. Нөгөө серверийн backup хэрэглэгчийн `~/.ssh/authorized_keys` дотор нэмнэ. `~/.ssh` нь 700, `authorized_keys` 600, эзэмшигч нь backup хэрэглэгч байна. Private key-г нөгөө сервер рүү хуулахгүй.

Дараах placeholder-уудыг бодит утгаар солиод нэг удаа холбогдож, **серверийн host key fingerprint-ийг өөрийн серверийн самбар/админтай тулган баталгаажуулна**:

```sh
sudo -u handari ssh -i /var/lib/handari/ssh/backup_ed25519 -o UserKnownHostsFile=/var/lib/handari/ssh/known_hosts -p 22 backup@OTHER_SERVER_IP
```

Дараа нь `/etc/handari/backup.env`-ийн дөрвөн утгыг оруулна:

```text
BACKUP_REMOTE_HOST=OTHER_SERVER_IP
BACKUP_REMOTE_PORT=22
BACKUP_REMOTE_USER=backup
BACKUP_REMOTE_DIRECTORY=/home/backup/handari
```

Хадгалах хавтас нь нөгөө серверт урьдчилан байх ёстой. Хуваарийн процесс `StrictHostKeyChecking=yes`, password-гүй BatchMode ашиглах тул host key баталгаажаагүй, түлхүүр буруу бол хуулалт алдаатай дуусна. Host key шалгалтыг унтраахгүй.

### Хуваарь асаах, шалгах

```sh
cp /var/handari/deploy/handari-backup.service /etc/systemd/system/
cp /var/handari/deploy/handari-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl start handari-backup.service
systemctl status handari-backup.service
journalctl -u handari-backup.service -n 50 --no-pager
systemctl enable --now handari-backup.timer
systemctl list-timers handari-backup.timer
```

Таймер Улаанбаатарын цагаар өдөр бүр 03:00–03:05 хооронд ажиллана; унтарсан үед алдсан ажиллалтыг дахин асаахад гүйцэтгэнэ. Service-ийн төлөвийг шалгаад дараа нь schedule-ийг идэвхжүүлнэ. Локал `.hbk` нөөцийг үндсэндээ 30 хоног хадгална; гаднын серверийн retention автоматаар устгадаггүй. Нөгөө серверийн багтаамж, retention-ийг тусад нь удирдана. Сэргээх туршилтыг тогтмол хийнэ.

Хуваарь болон SFTP batch-ийн лавлах: [systemd.time](https://www.freedesktop.org/software/systemd/man/257/systemd.time.html), [OpenSSH sftp](https://man.openbsd.org/sftp.1).

### Шифрлэсэн нөөц сэргээх

```sh
BACKUP_ENCRYPTION_KEY_FILE=/var/lib/handari/backup.key node /var/handari/scripts/decrypt-backup.mjs /path/backup.hbk /path/new-restored.sqlite
```

Гаралтын файл өмнө нь байж болохгүй. Скрипт шифрийн authentication, gzip, SQLite integrity шалгаж шинэ файл гаргана. **Ажиллаж байгаа санд шууд сэргээхгүй:** эхлээд service зогсоож, одоогийн сан болон WAL/SHM-ийг rollback хавтаст нөөцөлнө. Шалгасан шинэ санг `/var/lib/handari/handari.sqlite` болгож owner handari, mode 600 өгөөд service асаана. Хуучин WAL/SHM шинэ сантай үлдэхгүй. Энэ нь үндсэн README-ийн сэргээх зааврыг дагана.

## Баталгаажуулалтын хязгаар

10 автомат тестээр төлбөрийн давхардал/илүү төлөлт/буцаалт, нөөц/хүргэлтийн transaction, хуучин төлбөрийн migration, зураг байршуулалт/эрх, шифрлэсэн нөөц/сэргээх, гаднын хуулалтын алдааны төлөвийг шалгасан. Chrome-ийн desktop/390px урсгал амжилттай. Гаднын SFTP серверийн жинхэнэ холболт, Ubuntu timer, production HTTPS, Samsung камерын бодит ажиллагаа энэ Windows орчноос туршигдаагүй; SSH хуулалтын автомат тест нь хяналттай fake transfer ашигладаг.
