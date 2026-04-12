# ServiX — Universal Business Management Platform

**Biznesingizni bitta platformadan boshqaring.**

ServiX — bu restoran, do'kon, salon va boshqa har qanday biznes uchun mo'ljallangan CRM tizimi. Buyurtmalar, xodimlar, ombor, moliya, mijozlar — hammasi bitta joyda, AI buxgalter bilan kuchaytirilgan.

---

## 🌐 Platformalar

| Panel | URL | Kimlar uchun |
|-------|-----|-------------|
| **Biznes sayti** | [servi-x.vercel.app](https://servi-x.vercel.app/) | Mijozlar — onlayn buyurtma berish |
| **Admin panel** | [servix-admin.vercel.app](https://servix-admin.vercel.app/) | Biznes egasi — butun biznesni boshqarish |
| **Xodim panel** | [servix-imployee.vercel.app](https://servix-imployee.vercel.app) | Ishchilar — davomat, vazifalar |
| **Super Admin** | Server ichida | Platforma boshqaruvi — barcha bizneslar |

---

## 🧩 Tizim arxitekturasi

```
┌─────────────────────────────────────────────────────────┐
│                    SUPER ADMIN                          │
│  Barcha bizneslarni boshqarish, modul toggling,         │
│  AI monitoring, token/limit boshqaruvi                  │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────────┐
        │              │                  │
   ┌────▼────┐   ┌─────▼─────┐    ┌──────▼──────┐
   │ Biznes 1│   │ Biznes 2  │    │  Biznes N   │
   │Imperial │   │  Gavali   │    │  AqsoTour   │
   └────┬────┘   └─────┬─────┘    └──────┬──────┘
        │              │                  │
   ┌────▼──────────────▼──────────────────▼────┐
   │              ADMIN PANEL                   │
   │  Dashboard, Buyurtmalar, Mahsulotlar,     │
   │  Ishchilar, Ombor, Hisobot, AI Buxgalter  │
   └────────────────┬──────────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼────┐  ┌──────▼─────┐ ┌─────▼──────┐
│Ofitsiant│  │  Oshpaz    │ │  Xodim     │
│ /waiter │  │ /kitchen   │ │ /employee  │
└─────────┘  └────────────┘ └────────────┘
```

---

## 📋 Admin Panel — imkoniyatlar

Admin panel biznes egasiga butun biznesni bitta ekrandan boshqarish imkonini beradi.

### Dashboard
Real vaqtda biznes holati: bugungi buyurtmalar, daromad, o'rtacha chek, reyting, foydalanuvchilar soni. Kunlik trend grafigi, buyurtma turi (online/restoran) diagrammasi, TOP 10 mahsulotlar reytingi. Davr bo'yicha filter: bugun, kecha, hafta, oy, o'tgan oy yoki ixtiyoriy sana.

### Buyurtmalar
Barcha buyurtmalar ro'yxati real vaqtda. Status bo'yicha filter: Yangi, Qabul qilindi, Tayyorlanmoqda, Tayyor, Bekor qilindi. Har bir buyurtmaning tarkibi, jami summasi, mijoz ma'lumotlari, buyurtma turi (Online/Restoran) ko'rinadi. Statusni bir tugma bilan o'zgartirish mumkin.

### Mahsulotlar
Mahsulotlarni qo'shish, tahrirlash, o'chirish. Rasm, narx, kategoriya, UZ/RU nomi. Mahsulotni yashirish (vaqtincha menyudan olish) imkoniyati. Drag-and-drop tartib o'zgartirish.

### Kategoriyalar
Menyu kategoriyalarini boshqarish. Emoji, nom (UZ/RU), tartib raqami. Drag-and-drop bilan tartibni o'zgartirish.

### Xodimlar
Ishchilarni qo'shish, tahrirlash, o'chirish. Ism, telefon, lavozim, maosh, filial birikma, login/parol, ish vaqti, dam olish kuni. Face ID uchun rasm yuklash.

### Filiallar
Bir nechta filial boshqaruvi. Har bir filialga ishchilar biriktiriladi, hisobotlar filial bo'yicha filtrlanadi.

### Davomat
Bugungi davomat holati: kim keldi, kim kechikdi, kim kelmadi — real vaqtda. Face ID orqali avtomatik belgilash yoki qo'lda kiritish. Kechikish daqiqalari hisoblanadi.

### Hisobot va Maosh
Oylik/haftalik hisobot: ish kunlari, kelgan kunlar, kechikishlar, ishlagan soatlar. Maosh hisoblash. Filial bo'yicha filter. Excel ga eksport.

### Ofitsiantlar
Ofitsiant qo'shish, stol birikma. Ofitsiant /waiter panelidan buyurtma oladi, oshpazga yuboradi. Real-time tizim.

### Oshpazlar
Oshpaz qo'shish. /kitchen panelidan kelgan buyurtmalarni real vaqtda ko'radi, tayyor bo'lganda belgilaydi.

### Reytinglar
Mijozlar qo'ygan baholar ro'yxati. O'rtacha reyting, yulduz taqsimoti.

### Foydalanuvchilar
Telegram orqali ro'yxatdan o'tgan mijozlar. Ism, username, telefon, Telegram ID.

### Bildirishnomalar
Tizim bildirishnomalari: yangi buyurtma, AI token qo'shildi, xodim kechikdi. O'qilgan/o'qilmagan status.

### Ombor
Mahsulot qoldiqlari nazorati. Holat: OK, KAM, TUGAGAN — avtomatik hisoblash. Ombor harakatlari logi.

---

## 🤖 AI Buxgalter (ServiX AI)

Anthropic Claude Haiku 4.5 asosida ishlaydi. Admin panelda o'rnatilgan chatbot — biznes egasi o'zbek yoki rus tilida savol beradi, AI real vaqtda MongoDB dagi barcha ma'lumotlarni tahlil qilib javob beradi.

### AI nima qila oladi

- **"Bugungi sotuv qancha?"** — real vaqtda daromad va buyurtmalar soni
- **"Mart oyining hisobotini ber"** — 6 oylik arxivdan istalgan oy statistikasi
- **"Eng ko'p sotilgan mahsulot?"** — TOP mahsulotlar reytingi
- **"Qaysi ishchi kechikdi?"** — davomat tahlili
- **"Omborda nima tugagan?"** — ombor holati
- **"Haftalik sotuv trendi"** — kunlik breakdown
- **"Kecha bilan bugunni solishtir"** — qiyosiy tahlil

### AI xususiyatlari

- **Dinamik data collector** — MongoDB dagi BARCHA collectionlarni avtomatik skanerlaydi, yangi collection qo'shilsa ham avtomatik ko'radi
- **Aqlli tushunish** — qisqa va noto'g'ri yozilgan matnlarni fikrlab tushunadi ("5 aprel product" = 5-aprelda sotilgan mahsulotlar)
- **Maslahat** — har javob oxirida amaliy maslahat yoki ogohlantirish beradi
- **Excel eksport** — AI javobini Excelga yuklab olish imkoniyati
- **Izolyatsiya** — har bir biznes alohida (restaurantId bo'yicha)
- **Token boshqaruvi** — superadmin tomonidan limit belgilanadi va monitoring qilinadi

---

## 🛡️ Xavfsizlik (Security)

ServiX 8 ta hujum turidan himoyalangan:

| # | Hujum turi | Himoya | Tavsif |
|---|-----------|--------|--------|
| 1 | **XSS** (Cross-Site Scripting) | Helmet + Custom cleaner | `<script>`, `onclick=`, `javascript:` avtomatik tozalanadi |
| 2 | **NoSQL Injection** | express-mongo-sanitize | `$gt`, `$ne`, `$or` operatorlari bloklanadi |
| 3 | **Clickjacking** | X-Frame-Options | Saytni iframe ga joylashtirishni bloklaydi |
| 4 | **MIME Sniffing** | X-Content-Type-Options | Faylni noto'g'ri turda ochishni bloklaydi |
| 5 | **HTTP Parameter Pollution** | HPP | Takroriy parametrli hujumlar bloklanadi |
| 6 | **Path Traversal** | Custom middleware | `../../etc/passwd` kabi urinishlar bloklanadi |
| 7 | **DDoS** | Request size + Rate limit | 20MB limit, ortiqcha yuklanishdan himoya |
| 8 | **Brute Force** | Login rate limiter | Ketma-ket noto'g'ri parolda vaqtinchalik bloklash |

### Qo'shimcha himoyalar

- JWT token autentifikatsiya (7 kunlik muddatli)
- Bcrypt parol hashlash (salt: 10 round)
- HMAC-SHA256 webhook himoyasi
- Input sanitizatsiya va validatsiya
- Audit log — barcha muhim amallar loglanadi
- Har bir hujum urinishi logga yoziladi (IP bilan)

---

## 👨‍💼 Super Admin Panel

Platforma darajasidagi boshqaruv paneli — barcha bizneslarni bitta joydan nazorat qilish.

- **Bizneslar boshqaruvi** — yaratish, tahrirlash, o'chirish. Biznes turi tanlash (restoran, do'kon, salon, klinika va h.k.)
- **Modul boshqaruvi** — 27 ta modul, har bir biznesga keraklilarini yoqish/o'chirish
- **AI Monitoring** — har bir biznesning surov soni, token sarfi, xarajati. Token qo'shish modali
- **Audit Log** — barcha muhim amallar logi: login, o'chirish, modul o'zgartirish

---

## 👷 Xodim Panel

Ishchilar uchun alohida panel: davomat belgilash (Face ID yoki qo'lda), ish vaqti ko'rish, kechikish holati.

---

## 🧑‍🍳 Ofitsiant Panel (/waiter)

Ofitsiant uchun optimallashtirilgan interfeys: stoldagi buyurtmalarni ko'rish, yangi buyurtma yaratish, oshpazga yuborish. Real-time Socket.IO bilan.

---

## 🍳 Oshpaz Panel (/kitchen)

Oshpaz ekranida kelgan buyurtmalar real vaqtda ko'rinadi, tayyor bo'lganda belgilaydi, ofitsiantga signal yuboriladi.

---

## 🌍 Til qo'llab-quvvatlash

Admin panel 2 tilda ishlaydi: 🇺🇿 O'zbekcha va 🇷🇺 Русский. Sidebar pastidagi tugma bilan til almashtiriladi. Barcha sahifalar — dashboard, buyurtmalar, mahsulotlar, ishchilar, davomat, hisobot va boshqalar — tanlangan tilda ko'rinadi.

---

## 🔧 Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Frontend | Vanilla HTML/CSS/JS, Tailwind CSS |
| AI | Anthropic Claude Haiku 4.5 API |
| Bot | Telegram Bot API |
| Face ID | Face++ API |
| Real-time | Socket.IO |
| Auth | JWT + Bcrypt |
| Deploy | Railway (backend) + Vercel (frontend) |
| Security | Helmet, mongo-sanitize, HPP, rate-limit |

---

## 📊 Raqamlar

- **103** ta API endpoint
- **6** ta route modul
- **16** ta MongoDB model
- **4** ta middleware (auth, validation, rate-limit, module-guard)
- **4** ta service (AI, Bot, Face ID, Notification)
- **5** ta panel (Admin, SuperAdmin, Waiter, Kitchen, Employee)
- **8** ta security himoya
- **27** ta biznes modul
- **9** ta biznes turi

---

## 🚀 Boshqa CRM tizimlardan farqi

| Xususiyat | ServiX | 1C | BILLZ | iiko |
|-----------|--------|-----|-------|------|
| AI buxgalter | ✅ | ❌ | ❌ | ❌ |
| Telegram bot | ✅ | ❌ | ❌ | ❌ |
| Face ID davomat | ✅ | ❌ | ❌ | ❌ |
| Multi-tenant (ko'p biznes) | ✅ | ❌ | ✅ | ❌ |
| Universal (restoran + do'kon + salon) | ✅ | ✅ | ❌ | ❌ |
| UZ/RU til | ✅ | ✅ | ✅ | ❌ |

---

*ServiX — biznesingizni aqlli boshqaring.*