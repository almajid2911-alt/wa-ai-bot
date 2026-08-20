import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import qrcodeTerminal from 'qrcode-terminal';
import { updateQR, updateStatus, setResetAuthHandler } from './server.js';
import { generateAIReply, resetAIConversation } from './ai.js';
import { appendLeadToSheet, logUnansweredQuestion, refreshDynamicKnowledgeBackground } from './sheets.js';
import { sendTelegramNotification, sendTelegramPhoto } from './telegram.js';
import { isUserPaused, pauseBotForUser, resumeBotForUser } from './takeover.js';
import { trackUserConsultation, markUserRegistered, startFollowUpScheduler } from './followup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: 'warn' });
let sock = null;

function deleteAuthDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      try {
        if (fs.lstatSync(fullPath).isDirectory()) {
          deleteAuthDirContents(fullPath);
          fs.rmdirSync(fullPath);
        } else {
          fs.unlinkSync(fullPath);
        }
      } catch (e) {}
    }
  } catch (err) {}
}

setResetAuthHandler(async () => {
  console.log('🔄 Permintaan Reset Sesi dari Web Dashboard...');
  const authDir = path.resolve(process.env.AUTH_DIR || 'auth_session');
  try {
    if (sock) {
      try { await sock.logout(); } catch (e) {}
      sock.end();
      sock = null;
    }
  } catch (e) {}
  deleteAuthDirContents(authDir);
  console.log('🧹 Seluruh file credentials di auth_session berhasil dikosongkan!');
  updateStatus('Menyiapkan QR Baru...');
  setTimeout(() => connectToWhatsApp(), 1000);
});

// Memory Buffer untuk menampung data pendaftaran, lokasi, dan foto sebelum di-forward bersih ke Telegram
const pendingLeadBuffer = new Map();
const userSavedLocations = new Map();
const userProductContext = new Map();
const userRegistrationStage = new Map(); // 'inquiry' | 'awaiting_standby' | 'options_offered' | 'done'

// Anti-Spam & Rate Limiter Store
const userRateLimiter = new Map(); // remoteJid -> { timestamps: number[], isWarned: boolean, cooldownUntil: number }

function checkAntiSpam(remoteJid) {
  const now = Date.now();
  let record = userRateLimiter.get(remoteJid);
  if (!record) {
    record = { timestamps: [], isWarned: false, cooldownUntil: 0 };
    userRateLimiter.set(remoteJid, record);
  }

  // Jika masih dalam masa cooldown spam, tolak pesan
  if (now < record.cooldownUntil) {
    console.log(`🛡️ Anti-Spam: Mengabaikan pesan spam cepat dari ${remoteJid} (Cooldown aktif).`);
    return { isSpam: true, shouldWarn: false };
  }

  // Bersihkan timestamp yang lebih dari 6 detik lalu
  record.timestamps = record.timestamps.filter(ts => now - ts < 6000);
  record.timestamps.push(now);

  // Jika lebih dari 5 pesan dalam 6 detik ➔ Deteksi Spam
  if (record.timestamps.length > 5) {
    record.cooldownUntil = now + 25000; // Cooldown 25 detik
    const shouldWarn = !record.isWarned;
    record.isWarned = true;
    console.log(`⚠️ Anti-Spam Terpicu untuk ${remoteJid}: Terlalu banyak pesan dalam waktu singkat.`);
    return { isSpam: true, shouldWarn };
  }

  record.isWarned = false;
  return { isSpam: false, shouldWarn: false };
}

function unwrapMessage(m) {
  if (!m) return {};
  if (m.ephemeralMessage?.message) return unwrapMessage(m.ephemeralMessage.message);
  if (m.viewOnceMessage?.message) return unwrapMessage(m.viewOnceMessage.message);
  if (m.viewOnceMessageV2?.message) return unwrapMessage(m.viewOnceMessageV2.message);
  if (m.documentWithCaptionMessage?.message) return unwrapMessage(m.documentWithCaptionMessage.message);
  return m;
}

function getOrCreateBuffer(remoteJid, senderName, senderPhone) {
  let buf = pendingLeadBuffer.get(remoteJid);
  const savedLoc = userSavedLocations.get(remoteJid) || '-';
  if (!buf) {
    buf = {
      name: senderName || 'Kak',
      email: '-',
      phone: senderPhone || '',
      package: '-',
      coordinates: savedLoc,
      photos: []
    };
    pendingLeadBuffer.set(remoteJid, buf);
  } else if (buf.coordinates === '-' && savedLoc !== '-') {
    buf.coordinates = savedLoc;
  }
  return buf;
}

// In-memory message store for E2EE Signal retry key fulfillment (Anti Waiting for Message)
const messageStore = new Map();

async function getMessage(key) {
  if (key?.id && messageStore.has(key.id)) {
    return messageStore.get(key.id);
  }
  return undefined;
}

export async function connectToWhatsApp() {
  const authDir = path.resolve(process.env.AUTH_DIR || 'auth_session');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  let version = [2, 3000, 1043857760];
  try {
    const vResult = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    if (vResult?.version) version = vResult.version;
  } catch (e) {}

  console.log(`📦 Menggunakan Baileys versi v${version.join('.')}`);

  sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    getMessage,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: true,
    defaultQueryTimeoutMs: undefined,
    generateHighQualityLinkPreview: true,
    browser: ['Ubuntu', 'Chrome', '22.04.4']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n========================================');
      console.log('📌 SCAN QR CODE INI UNTUK LOGIN WHATSAPP:');
      console.log('========================================');
      qrcodeTerminal.generate(qr, { small: true });
      console.log('Atau buka browser: http://localhost:3000/qr\n');
      updateQR(qr);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Koneksi terputus (Status: ${statusCode}). Reconnect: ${shouldReconnect}`);
      updateStatus('Disconnected');

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🔒 Sesi telah logout. Menghapus sesi lama...');
        deleteAuthDirContents(authDir);
        setTimeout(() => connectToWhatsApp(), 2000);
      } else if (shouldReconnect) {
        setTimeout(() => connectToWhatsApp(), 5000);
      }
    } else if (connection === 'open') {
      const userPhone = sock.user?.id ? sock.user.id.split(':')[0] : 'Aktif';
      console.log(`\n========================================`);
      console.log(`✅ BOT WHATSAPP CS INDIHOME AKTIF!`);
      console.log(`📱 Nomor Bot: +${userPhone}`);
      console.log(`========================================\n`);
      updateStatus('Connected', `+${userPhone}`);

      refreshDynamicKnowledgeBackground();
      setInterval(refreshDynamicKnowledgeBackground, 10 * 60 * 1000);
      startFollowUpScheduler(() => sock);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid?.endsWith('@g.us');
        if (isGroup) continue;
        if (remoteJid === 'status@broadcast') continue;

        const senderName = msg.pushName || 'Kak';
        const senderPhone = remoteJid.split('@')[0];
        const leadBuf = getOrCreateBuffer(remoteJid, senderName, senderPhone);

        const realMsg = unwrapMessage(msg.message);

        let incomingText = '';
        let isLocation = false;
        let isImage = false;
        let imageBuffer = null;

        if (realMsg.conversation) {
          incomingText = realMsg.conversation;
        } else if (realMsg.extendedTextMessage?.text) {
          incomingText = realMsg.extendedTextMessage.text;
        } else if (realMsg.imageMessage) {
          isImage = true;
          incomingText = realMsg.imageMessage.caption || '[User mengirim foto berkas/KTP/rumah]';
          try {
            imageBuffer = await downloadMediaMessage(msg, 'buffer', {});
          } catch (e) {
            console.error('⚠️ Gagal mendownload foto:', e.message);
          }
        } else if (realMsg.documentMessage && realMsg.documentMessage.mimetype?.startsWith('image/')) {
          isImage = true;
          incomingText = realMsg.documentMessage.caption || '[User mengirim dokumen foto berkas]';
          try {
            imageBuffer = await downloadMediaMessage(msg, 'buffer', {});
          } catch (e) {
            console.error('⚠️ Gagal mendownload dokumen foto:', e.message);
          }
        } else if (realMsg.locationMessage || realMsg.liveLocationMessage) {
          isLocation = true;
          const loc = realMsg.locationMessage || realMsg.liveLocationMessage;
          const lat = loc.degreesLatitude || loc.latitude;
          const long = loc.degreesLongitude || loc.longitude;
          const mapsUrl = `https://maps.google.com/?q=${lat},${long}`;
          userSavedLocations.set(remoteJid, mapsUrl);
          leadBuf.coordinates = mapsUrl;
          incomingText = `[User mengirim Titik Share Location GPS: Lat ${lat}, Long ${long} - Link: ${mapsUrl}]`;
        }

        // Cek jika user mengirim link Google Maps dalam teks
        if (incomingText.includes('maps.google.com') || incomingText.includes('maps.app.goo.gl') || incomingText.includes('goo.gl/maps')) {
          const urlMatch = incomingText.match(/https?:\/\/[^\s]+/i);
          if (urlMatch) {
            userSavedLocations.set(remoteJid, urlMatch[0]);
            leadBuf.coordinates = urlMatch[0];
          }
        }

        if (!incomingText || incomingText.trim() === '') {
          continue;
        }

        // 🛡️ ANTI-SPAM PROTECTION
        const { isSpam, shouldWarn } = checkAntiSpam(remoteJid);
        if (isSpam) {
          if (shouldWarn) {
            await sock.sendMessage(remoteJid, {
              text: '⚠️ *[Sistem Anti-Spam]:* Mohon tidak mengirim pesan terlalu cepat secara beruntun ya kak. Sarah siap membantu pertanyaan Kakak satu per satu 🙏😊'
            });
          }
          continue; // Abaikan pesan spam beruntun
        }

        const lower = incomingText.trim().toLowerCase();

        // 0. COMMAND KHUSUS RESET PERCAKAPAN (UNTUK TESTING)
        if (lower === '#reset' || lower === '#clear' || lower === '#restart' || lower === '#reset-ai' || lower === '#hapus-sesi') {
          resetAIConversation(remoteJid);
          pendingLeadBuffer.delete(remoteJid);
          userSavedLocations.delete(remoteJid);
          userProductContext.delete(remoteJid);
          userRegistrationStage.delete(remoteJid);
          resumeBotForUser(remoteJid);
          await sock.sendMessage(remoteJid, {
            text: '🔄 *[Sistem]: Memori percakapan dan sesi pendaftaran Anda telah BERHASIL DI-RESET KE AWAL!* ✨\n\nSilakan mulai simulasi chat baru dari awal ya kak (contoh ketik: *"Halo"* atau *"Biaya pasang berapa"* atau kirim Shareloc).'
          }, { quoted: msg });
          console.log(`🔄 Sesi ${remoteJid} di-reset penuh lewat command: ${lower}`);
          continue;
        }

        // Perintah Admin dari nomor sendiri
        if (msg.key.fromMe) {
          if (lower === '#pause' || lower === '#stop') {
            pauseBotForUser(remoteJid, 'Admin Command #pause');
            await sock.sendMessage(remoteJid, { text: '⏸️ [Sistem]: AI Bot dinonaktifkan untuk chat ini. Admin manusia mengambil alih.' });
          } else if (lower === '#resume' || lower === '#start' || lower === '#bot-on') {
            resumeBotForUser(remoteJid);
            userRegistrationStage.delete(remoteJid);
            await sock.sendMessage(remoteJid, { text: '▶️ [Sistem]: AI Bot diaktifkan kembali untuk melayani percakapan.' });
          }
          continue;
        }

        // Cek jika nomor ini sedang dalam mode Human Takeover
        if (isUserPaused(remoteJid)) {
          console.log(`🤫 Bot di-pause untuk ${remoteJid} (Admin Takeover mode).`);
          continue;
        }

        console.log(`📩 Pesan Masuk dari [${senderName} (+${senderPhone})]: "${incomingText}"`);
        const currentProductCtx = userProductContext.get(remoteJid) || 'indihome';
        const hasLoc = userSavedLocations.has(remoteJid) || isLocation;
        trackUserConsultation(remoteJid, senderName, currentProductCtx, hasLoc);

        // Simulasi pengetikan manusiawi (Anti-Ban)
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', remoteJid);

        // Jika user kirim foto, simpan ke memory buffer sementara
        if (isImage && imageBuffer) {
          const caption = realMsg.imageMessage?.caption || realMsg.documentMessage?.caption || 'Foto Dokumen / Rumah / NPWP';
          leadBuf.photos.push({ buffer: imageBuffer, caption });
          console.log(`📸 Foto dari ${senderName} disimpan di buffer sementara (${leadBuf.photos.length} foto tersimpan).`);
        }

        // Dapatkan konteks produk & stage pengguna saat ini
        const currentStage = userRegistrationStage.get(remoteJid) || 'inquiry';

        // Generate AI Response
        const aiResult = await generateAIReply(remoteJid, incomingText, senderName, currentProductCtx);
        const {
          replyText,
          attachImage,
          copyFormTemplate,
          leadData,
          isConfirmedReady,
          customerChoiceAdmin,
          customerChoiceSelf,
          unansweredQuestion,
          requestHuman,
          setProductContext
        } = aiResult;

        if (setProductContext) {
          userProductContext.set(remoteJid, setProductContext);
        } else if (aiResult.updatedProduct) {
          userProductContext.set(remoteJid, aiResult.updatedProduct);
        }

        const humanDelay = Math.floor(Math.random() * 1200) + 1200;
        await new Promise(resolve => setTimeout(resolve, humanDelay));
        await sock.sendPresenceUpdate('paused', remoteJid);

        // Update data pendaftaran ke buffer jika AI mendeteksi data formulir
        if (leadData) {
          if (leadData.name) leadBuf.name = leadData.name;
          if (leadData.email) leadBuf.email = leadData.email;
          if (leadData.phone) leadBuf.phone = leadData.phone;
          if (leadData.package) leadBuf.package = leadData.package;
          userRegistrationStage.set(remoteJid, 'awaiting_standby');
        }

        // Pastikan koordinat selalu diambil jika ada di history
        if (userSavedLocations.has(remoteJid)) {
          leadBuf.coordinates = userSavedLocations.get(remoteJid);
        }

        // 1. KETIKA PELANGGAN MEMBALAS "SIAP" ➔ TAWARKAN 2 OPSI & CATAT STAGE
        if (isConfirmedReady) {
          markUserRegistered(remoteJid);
          userRegistrationStage.set(remoteJid, 'options_offered');
          leadBuf.phone = leadBuf.phone || senderPhone;
          if (userSavedLocations.has(remoteJid)) {
            leadBuf.coordinates = userSavedLocations.get(remoteJid);
          }

          // A. Simpan ke Google Sheets
          await appendLeadToSheet(leadBuf);

          // B. Kirim Notifikasi Rangkuman Lengkap ke Telegram Sales
          await sendTelegramNotification(
            `🎉 <b>PENDAFTARAN LENGKAP MASUK!</b> 🎉\n\n` +
            `👤 <b>Nama Pelanggan:</b> ${leadBuf.name}\n` +
            `✉️ <b>Email:</b> ${leadBuf.email}\n` +
            `📱 <b>No HP / WA:</b> <a href="https://wa.me/${leadBuf.phone}">+${leadBuf.phone}</a>\n` +
            `📶 <b>Paket:</b> ${leadBuf.package}\n` +
            `📍 <b>Titik Shareloc / ODP:</b> ${leadBuf.coordinates}\n` +
            `📸 <b>Jumlah Foto Berkas:</b> ${leadBuf.photos.length} Foto\n` +
            `⏳ <b>Status:</b> Pelanggan STAND BY (Sedang Memilih Jalur: 1. Admin Sales / 2. Mandiri)\n\n` +
            `<i>Foto berkas terlampir di bawah:</i>`
          );

          // C. Forward Semua Foto Berkas yang Tersimpan
          if (leadBuf.photos.length > 0) {
            for (let i = 0; i < leadBuf.photos.length; i++) {
              const p = leadBuf.photos[i];
              await sendTelegramPhoto(
                p.buffer,
                `📸 Berkas ${i + 1}/${leadBuf.photos.length} - ${leadBuf.name} (${p.caption})`
              );
            }
          }
        }

        // 2. KETIKA PELANGGAN MEMILIH OPSI 1 (ADMIN SALES TAKE OVER)
        // 🔒 HANYA BOLEH AKTIF JIKA SEBELUMNYA SUDAH DI TAHAP options_offered
        const isExplicitOption1 = (lower === '1' || lower === 'opsi 1' || lower === 'pilih 1' || lower === 'dibantu admin' || lower === 'admin');
        if (customerChoiceAdmin && isExplicitOption1 && currentStage === 'options_offered') {
          pauseBotForUser(remoteJid, 'Pelanggan Memilih Jalur 1 (Input Admin Sales)');
          userRegistrationStage.set(remoteJid, 'handed_over_admin');
          if (userSavedLocations.has(remoteJid)) {
            leadBuf.coordinates = userSavedLocations.get(remoteJid);
          }
          await sendTelegramNotification(
            `🚨 <b>ACTION REQUIRED: PELANGGAN STAND BY & MINTA DIINPUTKAN ADMIN!</b> 🚨\n\n` +
            `👤 <b>Nama:</b> ${leadBuf.name}\n` +
            `📱 <b>WhatsApp:</b> <a href="https://wa.me/${leadBuf.phone}">+${leadBuf.phone}</a>\n` +
            `📶 <b>Paket:</b> ${leadBuf.package}\n` +
            `📍 <b>Lokasi:</b> ${leadBuf.coordinates}\n\n` +
            `⚡ <b>TINDAKAN:</b> Pelanggan sudah stand by di WA/HP. Admin sales silakan langsung proses input/chat sekarang! (Bot telah di-pause otomatis)`
          );
        }

        // 3. KETIKA PELANGGAN MEMILIH OPSI 2 (DAFTAR MANDIRI VIA LINK)
        if (customerChoiceSelf && currentStage === 'options_offered') {
          userRegistrationStage.set(remoteJid, 'self_registered');
          await sendTelegramNotification(
            `ℹ️ <b>UPDATE: PELANGGAN MEMILIH DAFTAR MANDIRI VIA LINK</b>\n\n` +
            `👤 <b>Nama:</b> ${leadBuf.name}\n` +
            `📱 <b>WhatsApp:</b> <a href="https://wa.me/${leadBuf.phone}">+${leadBuf.phone}</a>\n` +
            `🔗 <i>Pelanggan diarahkan mengisi form lewat link resmi.</i>`
          );
        }

        // 4. KETIKA PELANGGAN KONFIRMASI PEMBAYARAN APK PREMIUM (#SUDAHBAYAR)
        if (aiResult.isApkPaid) {
          pauseBotForUser(remoteJid, 'Pelanggan Konfirmasi Bayar APK Premium (#sudahbayar)');
          await sendTelegramNotification(
            `💳 <b>KONFIRMASI PEMBAYARAN APK PREMIUM MASUK!</b> 💳\n\n` +
            `👤 <b>Nama:</b> ${senderName}\n` +
            `📱 <b>WhatsApp:</b> <a href="https://wa.me/${senderPhone}">+${senderPhone}</a>\n` +
            `🎬 <b>Pesanan:</b> APK Premium (Yuyun Premium Store)\n` +
            `💬 <b>Pesan:</b> Pelanggan konfirmasi pembayaran via QRIS (#sudahbayar)\n\n` +
            `⚡ <b>TINDAKAN:</b> Pelanggan sudah konfirmasi bayar. Admin silakan cek mutasi QRIS dan kirimkan akun ke pelanggan!`
          );
        }

        // 5. CATAT PERMINTAAN CS MANUSIA LANGSUNG JIKA ADA
        if (requestHuman) {
          pauseBotForUser(remoteJid, `Permintaan Pelanggan: ${requestHuman}`);
          await sendTelegramNotification(
            `🔔 <b>PERMINTAAN CS MANUSIA (HUMAN TAKEOVER)</b>\n\n` +
            `👤 <b>Nama:</b> ${senderName}\n` +
            `📱 <b>WhatsApp:</b> <a href="https://wa.me/${senderPhone}">+${senderPhone}</a>\n` +
            `💬 <b>Alasan:</b> ${requestHuman}\n` +
            `<i>Bot di-pause otomatis. Admin silakan balas langsung via WhatsApp.</i>`
          );
        }

        // 5. CATAT PERTANYAAN TAK TERJAWAB JIKA ADA
        if (unansweredQuestion) {
          await logUnansweredQuestion(senderName, senderPhone, incomingText);
        }

        // 6. KIRIM BALASAN UTAMA
        const quoteOption = (msg?.message && Object.keys(msg.message).length > 0 && !remoteJid.includes('@lid')) ? { quoted: msg } : {};
        let sentMsg = null;

        if (attachImage) {
          const imagePath = path.resolve(__dirname, `../assets/brosur/${attachImage}`);
          if (fs.existsSync(imagePath)) {
            const imgBuf = fs.readFileSync(imagePath);
            sentMsg = await sock.sendMessage(remoteJid, {
              image: imgBuf,
              caption: replyText
            }, quoteOption);
          } else {
            sentMsg = await sock.sendMessage(remoteJid, { text: replyText }, quoteOption);
          }
        } else {
          sentMsg = await sock.sendMessage(remoteJid, { text: replyText }, quoteOption);
        }

        if (sentMsg?.key?.id && sentMsg?.message) {
          messageStore.set(sentMsg.key.id, sentMsg.message);
        }

        // 7. JIKA ADA FORMAT FORMULIR, KIRIM DALAM CHAT TERPISAH YANG SIAP DI COPY-PASTE
        if (copyFormTemplate) {
          await new Promise(resolve => setTimeout(resolve, 800));
          const sentForm = await sock.sendMessage(remoteJid, { text: copyFormTemplate });
          if (sentForm?.key?.id && sentForm?.message) {
            messageStore.set(sentForm.key.id, sentForm.message);
          }
        }

      } catch (err) {
        console.error('❌ Error memproses pesan masuk:', err);
      }
    }
  });

  return sock;
}
