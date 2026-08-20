import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { isUserPaused } from './takeover.js';

const authDir = process.env.AUTH_DIR || 'auth_session';
const trackerFilePath = path.resolve(authDir, 'lead_tracker.json');

// remoteJid -> { name, lastChatTime, status: 'consulting' | 'registered' | 'followed_up', product: 'indihome' | 'indibiz' | 'apk_premium', hasLocation: boolean, isRealLead: boolean }
const leadTracker = new Map();

// Load persistent tracker on startup
function loadLeadTracker() {
  try {
    if (fs.existsSync(trackerFilePath)) {
      const raw = fs.readFileSync(trackerFilePath, 'utf-8');
      const data = JSON.parse(raw);
      for (const [key, val] of Object.entries(data)) {
        leadTracker.set(key, val);
      }
      console.log(`📦 Memuat ${leadTracker.size} data lead tracker dari persistent storage.`);
    }
  } catch (err) {
    console.warn('⚠️ Gagal memuat lead_tracker.json:', err.message);
  }
}

function saveLeadTracker() {
  try {
    const dir = path.dirname(trackerFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = {};
    for (const [key, val] of leadTracker.entries()) {
      obj[key] = val;
    }
    fs.writeFileSync(trackerFilePath, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Gagal menyimpan lead_tracker.json:', err.message);
  }
}

loadLeadTracker();

/**
 * Track user consultation - HANYA jika terbukti calon prospek (bukan chat santai/keluarga)
 */
export function trackUserConsultation(remoteJid, name, product = 'indihome', hasLocation = false, isRealLead = true) {
  if (!remoteJid || remoteJid.includes('@g.us')) return;

  const current = leadTracker.get(remoteJid);
  // 🔒 ATURAN KETAT: Jika sudah pernah difollow-up 1x atau sudah mendaftar, JANGAN PERNAH track untuk follow-up ulang
  if (current && (current.status === 'registered' || current.status === 'followed_up')) {
    return;
  }

  // Jika bukan lead asli (misal chat santai/keluarga/tanya non-produk), jangan track
  if (!isRealLead && !hasLocation && !current?.hasLocation) {
    return;
  }

  leadTracker.set(remoteJid, {
    name: name || 'Kak',
    lastChatTime: Date.now(),
    status: 'consulting',
    product: product || 'indihome',
    hasLocation: hasLocation || (current?.hasLocation ?? false),
    isRealLead: true
  });

  saveLeadTracker();
}

export function markUserRegistered(remoteJid) {
  if (!remoteJid) return;
  const current = leadTracker.get(remoteJid);
  if (current) {
    current.status = 'registered';
  } else {
    leadTracker.set(remoteJid, { name: 'Kak', lastChatTime: Date.now(), status: 'registered', product: 'indihome', hasLocation: false, isRealLead: false });
  }
  saveLeadTracker();
  console.log(`🎯 User ${remoteJid} ditandai sudah registrasi / pesan (Follow-up dinonaktifkan permanen).`);
}

let isSchedulerStarted = false;

export function startFollowUpScheduler(getWASocket) {
  // 🔒 SINGLETON LOCK: Pastikan cron HANYA PERNAH dibuat 1 KALI SEUMUR SERVER
  if (isSchedulerStarted) {
    return;
  }
  isSchedulerStarted = true;

  // Pengecekan tiap 15 menit
  cron.schedule('*/15 * * * *', async () => {
    // ⏰ ATURAN JAM KERJA KETAT: HANYA kirim follow up pukul 09.00 - 19.30 WITA/WIB (DILARANG TENGAH MALAM!)
    let currentHour = 12;
    try {
      const witaTime = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: 'numeric', hour12: false }).format(new Date());
      currentHour = parseInt(witaTime, 10);
    } catch (e) {
      currentHour = new Date().getHours();
    }

    if (currentHour < 9 || currentHour >= 20) {
      // Di luar jam 09.00 - 20.00 WITA, jangan kirim pesan follow-up
      return;
    }

    const delayMinutes = parseInt(process.env.FOLLOW_UP_DELAY_MINUTES || '180', 10); // Default 3 jam
    const delayMs = delayMinutes * 60 * 1000;
    const now = Date.now();

    const sock = getWASocket();
    if (!sock) return;

    for (const [remoteJid, data] of leadTracker.entries()) {
      if (data.status !== 'consulting' || !data.isRealLead) continue;
      if (isUserPaused(remoteJid)) continue;

      const elapsed = now - data.lastChatTime;

      // Follow-up hanya dikirim 1x jika jeda sudah tercapai (misal 3 jam) dan kurang dari 24 jam
      if (elapsed >= delayMs && elapsed < 24 * 60 * 60 * 1000) {
        try {
          // 🔒 KUNCI STATUS PERMANEN TERLEBIH DAHULU SEBELUM MENGIRIM PESAN (Anti Double-Send)
          data.status = 'followed_up';
          saveLeadTracker();

          let followUpMessage = '';

          if (data.product === 'indibiz') {
            followUpMessage = `Halo Kak ${data.name}! 😊\n\nSarah mau follow-up sebentar terkait paket internet bisnis **IndiBiz** untuk tempat usaha Kakak. Apakah mau dibantu amankan slot pendaftarannya hari ini?\n\nJika ada yang masih perlu dikonsultasikan seputar paket atau spesifikasi jaringannya, jangan ragu hubungi Sarah yaa 🙏🏢`;
          } else if (data.product === 'apk_premium') {
            followUpMessage = `Halo Kak ${data.name}! 😊\n\nSarah mau menanyakan apakah pesanan akun aplikasi premiumnya mau dilanjutkan hari ini? Mumpung stok akunnya saat ini masih ready siap proses yaa kak 🙏✨`;
          } else {
            // IndiHome
            if (data.hasLocation) {
              followUpMessage = `Halo Kak ${data.name}! 😊\n\nTitik lokasi rumah Kakak kemarin sudah Sarah cek dan tiang ODP-nya sudah **TERSEDIA & SIAP PASANG** 📶\n\nApakah mau dibantu amankan jadwal pemasangannya untuk besok mumpung promo pasang **Rp 99.000** masih berlaku? Jika ada pertanyaan lain, jangan ragu kabari Sarah yaa 🙏✨`;
            } else {
              followUpMessage = `Halo Kak ${data.name}! 😊\n\nSarah mau follow-up sebentar, apakah paket WiFi IndiHome-nya mau dibantu cek titik jaringan ODP atau amankan jadwal pasang mumpung ada **Promo Pasang Rp 99.000** hari ini?\n\nJika ada yang masih mau ditanyakan seputar paket, boleh langsung kabari Sarah yaa 🙏📶`;
            }
          }

          console.log(`⏰ Mengirimkan Smart Follow-Up (1x Only) ke [${data.name} (+${remoteJid.split('@')[0]})]...`);
          await sock.sendMessage(remoteJid, { text: followUpMessage });

        } catch (err) {
          console.error(`❌ Gagal mengirim follow up ke ${remoteJid}:`, err.message);
        }
      }
    }
  });

  console.log('⏰ Smart Follow-Up Scheduler aktif (Hanya 1x Follow-Up, Jam Kerja 09.00-20.00 WITA, Terkunci Permanen di Storage).');
}
