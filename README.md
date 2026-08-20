# 🤖 WhatsApp AI Bot CS IndiHome

Bot WhatsApp Customer Service & Sales Consultant IndiHome Telkomsel bertenaga **Google Gemini AI (Gemini 2.0 / 1.5 Flash)** dengan pustaka **@whiskeysockets/baileys**.

---

## 🌟 Fitur Utama
- **Otak AI Cerdas & Natural:** Didukung Google Gemini AI dengan pemahaman bahasa Indonesia santai ala chat WhatsApp.
- **Memory Chat:** Mengingat percakapan sebelumnya sehingga obrolan nyambung per nomor pelanggan.
- **Knowledge Base Produk:** Dilengkapi data paket IndiHome 1P, 2P TV, 3P, promo, SOP, dan format pendaftaran.
- **Auto-Kirim Brosur:** Otomatis mengirimkan gambar brosur dari folder `assets/brosur/` saat pelanggan memintanya.
- **Web QR Scanner (`/qr`):** Tampilan QR Code di web browser untuk memudahkan scan saat dideploy ke cloud (Railway).
- **Zero Cost Trial:** Bisa diuji coba gratis di laptop sebelum dipasang ke nomor bisnis utama.

---

## 🚀 Cara Menjalankan di Laptop (Pengujian Lokal)

### 1. Masuk ke folder proyek & install dependensi:
```bash
cd wa-ai-bot
npm install
```

### 2. Isi API Key Gemini di file `.env`:
Buka file `.env` dan masukkan API Key Gemini Anda:
```env
GEMINI_API_KEY=AIzaSy... (Dapatkan gratis di https://aistudio.google.com)
GEMINI_MODEL=gemini-2.0-flash
PORT=3000
AUTH_DIR=auth_session
BOT_NAME=Sarah
COMPANY_NAME=IndiHome Telkomsel
```

### 3. Jalankan Bot:
```bash
npm start
```

### 4. Scan QR Code:
- Terminal akan memunculkan QR Code, **ATAU**
- Buka browser di [http://localhost:3000/qr](http://localhost:3000/qr)
- Buka WhatsApp di HP pengujian -> **Perangkat Tertaut (Linked Devices)** -> Scan QR tersebut.
- Selesai! Bot sudah aktif dan siap menerima chat.

---

## ☁️ Cara Deploy ke Railway (Online 24/7)

1. **Buat Git Repository:**
   ```bash
   git init
   git add .
   git commit -m "feat: whatsapp ai bot indihome"
   ```
2. **Push ke GitHub:**
   - Buat repo baru di GitHub (misal: `wa-ai-bot`).
   - Push repository lokal ke GitHub.
3. **Deploy di Railway:**
   - Buka [Railway.app](https://railway.app) dan klik **New Project** -> **Deploy from GitHub repo**.
   - Pilih repo `wa-ai-bot`.
   - Di tab **Variables**, tambahkan:
     * `GEMINI_API_KEY` = `(API Key Gemini Anda)`
     * `GEMINI_MODEL` = `gemini-2.0-flash`
     * `PORT` = `3000`
   - Di tab **Settings** -> **Networking**, klik **Generate Domain** (misal: `https://wa-ai-bot-production.up.railway.app`).
4. **Scan QR di Cloud:**
   - Buka URL domain Railway Anda dengan akhiran `/qr`:
     `https://wa-ai-bot-production.up.railway.app/qr`
   - Scan QR code yang muncul menggunakan WhatsApp di HP Anda.
5. *(Opsional)* **Persistent Volume:**
   - Agar sesi login tidak ter-reset saat deploy ulang, tambahkan **Volume** di Railway dengan mount path `/app/auth_session`.
