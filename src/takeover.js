// Menyimpan daftar nomor yang sedang dalam status Human Takeover (AI di-pause)
const pausedUsers = new Map(); // remoteJid -> { reason, pausedAt }

export function isUserPaused(remoteJid) {
  const data = pausedUsers.get(remoteJid);
  if (!data) return false;

  // Cek apakah sudah melewati batas waktu auto-resume (default: 12 jam)
  const timeoutHours = parseFloat(process.env.TAKEOVER_TIMEOUT_HOURS || '12');
  const timeoutMs = timeoutHours * 60 * 60 * 1000;
  const elapsed = Date.now() - new Date(data.pausedAt).getTime();

  if (elapsed >= timeoutMs) {
    pausedUsers.delete(remoteJid);
    console.log(`⏰ Sesi Human Takeover untuk ${remoteJid} telah berakhir otomatis setelah ${timeoutHours} jam. Bot AI aktif kembali.`);
    return false;
  }

  return true;
}

export function pauseBotForUser(remoteJid, reason = 'Admin Takeover') {
  pausedUsers.set(remoteJid, {
    reason,
    pausedAt: new Date()
  });
  console.log(`⏸️ Bot di-pause untuk nomor: ${remoteJid} (Alasan: ${reason})`);
}

export function resumeBotForUser(remoteJid) {
  if (pausedUsers.has(remoteJid)) {
    pausedUsers.delete(remoteJid);
    console.log(`▶️ Bot di-aktifkan kembali untuk nomor: ${remoteJid}`);
    return true;
  }
  return false;
}

export function getPausedList() {
  return Array.from(pausedUsers.entries()).map(([jid, data]) => ({
    jid,
    ...data
  }));
}
