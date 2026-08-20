import cron from 'node-cron';
import { isUserPaused } from './takeover.js';

// remoteJid -> { name, lastChatTime, status: 'consulting' | 'registered' | 'followed_up', product: 'indihome' | 'indibiz' | 'apk_premium', hasLocation: boolean }
const leadTracker = new Map();

export function trackUserConsultation(remoteJid, name, product = 'indihome', hasLocation = false) {
  const current = leadTracker.get(remoteJid);
  // 🔒 ATURAN KETAT: Jika sudah pernah difollow-up 1x atau sudah mendaftar, JANGAN PERNAH track untuk follow-up ulang
  if (current && (current.status === 'registered' || current.status === 'followed_up')) {
    return;
  }

  leadTracker.set(remoteJid, {
    name: name || 'Kak',
    lastChatTime: Date.now(),
    status: 'consulting',
    product: product || 'indihome',
    hasLocation: hasLocation || (current?.hasLocation ?? false)
  });
}

export function markUserRegistered(remoteJid) {
  const current = leadTracker.get(remoteJid);
  if (current) {
    current.status = 'registered';
  } else {
    leadTracker.set(remoteJid, { name: 'Kak', lastChatTime: Date.now(), status: 'registered', product: 'indihome', hasLocation: false });
  }
  console.log(`🎯 User ${remoteJid} ditandai sudah registrasi / pesan (Follow-up dinonaktifkan permanen).`);
}

export function startFollowUpScheduler(getWASocket) {
  // Pengecekan tiap 10 menit
  cron.schedule('*/10 * * * *', async () => {
    const delayMinutes = parseInt(process.env.FOLLOW_UP_DELAY_MINUTES || '180', 10);
    const delayMs = delayMinutes * 60 * 1000;
    const now = Date.now();

    const sock = getWASocket();
    if (!sock) return;

    for (const [remoteJid, data] of leadTracker.entries()) {
      if (data.status !== 'consulting') continue;
      if (isUserPaused(remoteJid)) continue;

      const elapsed = now - data.lastChatTime;

      // Follow-up hanya dikirim 1x jika jeda sudah tercapai (misal 3 jam) dan kurang dari 24 jam
      if (elapsed >= delayMs && elapsed < 24 * 60 * 60 * 1000) {
        try {
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

          console.log(`⏰ Mengirimkan Smart Follow-Up (1x Only) ke [${data.name} (${remoteJid})]...`);
          await sock.sendMessage(remoteJid, { text: followUpMessage });

          // 🔒 KUNCI STATUS PERMANEN: Hanya 1 kali follow-up seumur hidup percakapan ini
          data.status = 'followed_up';
        } catch (err) {
          console.error(`❌ Gagal mengirim follow up ke ${remoteJid}:`, err.message);
        }
      }
    }
  });

  console.log('⏰ Smart Follow-Up Scheduler aktif (HANYA 1X Follow-Up per Calon Pelanggan).');
}
