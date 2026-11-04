# HANDARI v1.4 — Имэйл болон Google бүртгэл

Имэйл/нууц үгийн бүртгэл хэвээр. Google товч нь OAuth Web Client ID тохируулсны дараа идэвхжинэ. Gmail хаягийг имэйл/нууц үгийн бүртгэлд шууд ашиглаж болно. Gmail-ийн өөрийн нууц үгийг HANDARI-д оруулахгүй: HANDARI-д тусдаа нууц үг сонгоно.

## Google Cloud дээр нэг удаа тохируулах

1. https://console.cloud.google.com/ нээгээд төсөл үүсгэх эсвэл өөрийн төслөө сонгоно. Firebase шаардлагагүй.
2. **Google Auth Platform → Branding** хэсэгт аппын нэр HANDARI, өөрийн support email, холбоо барих имэйл оруулна.
3. **Audience → External** сонгоно. Testing төлөвт байвал **Test users** хэсэгт турших Google хаягуудаа нэмнэ. Бусдад нээхдээ Google-ийн publishing/verification шаардлагыг дагана.
4. **Clients → Create client → Web application** сонгоно.
5. **Authorized JavaScript origins** дотор `https://handari.duckdns.org` оруулна. Хаягт `/#login`, `/auth/login` зэрэг зам нэмэхгүй. Энэ апп JavaScript callback ашигладаг тул redirect URI тохируулах шаардлагагүй.
6. Үүссэн **Client ID** буюу `…apps.googleusercontent.com` утгыг хуулна. Client secret энэ аппд хэрэггүй; чат, GitHub, frontend-д оруулахгүй.

Албан ёсны заавар: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

## Ubuntu серверийг шинэчлэх

Компьютероос шинэ `handari-v1.4.zip` файлыг `/tmp/handari-v1.4.zip` рүү хуулна. Сервер дээр:

```bash
mkdir -p /tmp/handari-v1.4
unzip /tmp/handari-v1.4.zip -d /tmp/handari-v1.4
bash /tmp/handari-v1.4/deploy/update.sh
bash /var/handari/deploy/enable-google.sh
```

Сүүлийн команд асуухад Web Client ID-гаа оруулна. Тохиргоо `/etc/handari/google.env` дотор хадгалагдана; GitHub-д орохгүй. Шинэчлэгч өгөгдөл болон өмнөх кодыг `/var/backups/handari/upgrades` дотор нөөцөлнө. npm dependency суулгахад интернэт хэрэгтэй. Одоо байгаа Nginx болон бусад сайтын тохиргоог өөрчлөхгүй.

## Компьютер дээр ажиллуулах

```powershell
cd C:\Users\Awesome\Desktop\HANDARI_v1.0
npm ci --omit=dev --ignore-scripts
npm start
```

Client ID байхгүй үед имэйл/нууц үг ажиллана. Google-ийг локал дээр турших бол Google client-д локал origin-оо тусад нь зөвшөөрч, сервер эхлүүлэхээс өмнө PowerShell-д `$env:GOOGLE_CLIENT_ID='YOUR_CLIENT_ID.apps.googleusercontent.com'` оруулна. Production тохиргоог ашиглахад HTTPS домэйн дээр туршихыг зөвлөе.

## Шалгах дараалал

1. `https://handari.duckdns.org/api/auth/config` нь `google.enabled: true` буцаах ёстой.
2. Аппыг refresh хийгээд шинэ хувилбарын мэдэгдэл гарвал шинэчилнэ. Гарах → Бүртгүүлэх → Google товч дарна.
3. Шинэ хэрэглэгч админы зөвшөөрөл хүлээнэ. Админ самбараас батлаад Google-ээр дахин нэвтэрнэ.
4. Өмнө имэйлээр бүртгүүлсэн бол эхлээд HANDARI нууц үгээр нэвтрээд **Миний булан → Google данс холбох** сонгоно. Ижил имэйлтэй Google данс сонгож, одоогийн HANDARI нууц үгээр батална. Ижил имэйл байна гээд дансыг автоматаар нэгтгэхгүй.
5. Google-only хэрэглэгчийн имэйл/нууц үгийн нэвтрэлт анх идэвхгүй. Шаардлагатай бол админ нууц үг шинэчилж идэвхжүүлнэ. Тэр үед заавал нууц үг солино.

`origin_mismatch` гарвал JavaScript origins-ийг шалгана. `access_denied` гарвал Google Audience/Test users тохиргоог шалгана. Google серверт холбогдох боломжгүй бол нэвтрэлтийг амжилттай гэж үзэхгүй. Клиент ба серверийн цаг зөв байх ёстой.

Автомат тестүүд Google nonce, audience/email шалгалт, давтан хүсэлт, зөвшөөрөл, данс холболтын хамгаалалтыг хиймэл баталгаажуулагчаар шалгана. Бодит Google дансны end-to-end нэвтрэлтийг Client ID тохируулсны дараа тусад нь шалгана. Имэйл баталгаажуулах болон нууц үг сэргээх имэйл илгээх SMTP энэ шинэчлэлд ороогүй.
