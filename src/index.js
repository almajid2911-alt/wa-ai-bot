import 'dotenv/config';
import { startWebServer } from './server.js';
import { connectToWhatsApp } from './bot.js';

const PORT = process.env.PORT || 3000;

console.log('========================================');
console.log('🚀 MEMULAI WHATSAPP AI BOT CS INDIHOME');
console.log('========================================');

// Jalankan Web Server untuk Dashboard / QR Scanner
startWebServer(PORT);

// Jalankan Koneksi WhatsApp Baileys
connectToWhatsApp().catch((err) => {
  console.error('❌ Gagal menginisialisasi WhatsApp Bot:', err);
});
