import express from 'express';
import QRCode from 'qrcode';

const app = express();
let currentQR = null;
let botStatus = 'Initializing...';
let connectedNumber = null;
let resetAuthHandler = null;

export function setResetAuthHandler(handler) {
  resetAuthHandler = handler;
}

export function updateQR(qrCode) {
  currentQR = qrCode;
  botStatus = 'Scan QR Code';
}

export function updateStatus(status, number = null) {
  botStatus = status;
  if (status === 'Connected') {
    currentQR = null;
    connectedNumber = number;
  }
}

export function startWebServer(port = 3000) {
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp AI Bot - Status</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 420px; width: 90%; }
          .status { display: inline-block; padding: 0.4rem 1rem; border-radius: 9999px; font-weight: bold; margin: 1rem 0; }
          .status.connected { background: #059669; color: white; }
          .status.waiting { background: #d97706; color: white; }
          .status.init { background: #475569; color: white; }
          a.btn { display: inline-block; background: #2563eb; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 0.5rem; font-weight: bold; margin-top: 1rem; }
          a.btn:hover { background: #1d4ed8; }
          a.btn-danger { background: #dc2626; margin-left: 0.5rem; }
          a.btn-danger:hover { background: #b91c1c; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🤖 WA AI Bot Dashboard</h2>
          <p>Status Bot:</p>
          <div class="status ${botStatus === 'Connected' ? 'connected' : (currentQR ? 'waiting' : 'init')}">
            ${botStatus} ${connectedNumber ? `(${connectedNumber})` : ''}
          </div>
          ${botStatus !== 'Connected' 
            ? `<br><a class="btn" href="/qr">Buka Halaman Scan QR</a>` 
            : `<p style="color:#10b981;">✅ Bot sudah terhubung dan siap melayani chat WhatsApp!</p><br><a class="btn btn-danger" href="/reset-auth" onclick="return confirm('Apakah Anda yakin ingin logout dan generate QR baru?')">🔄 Logout & Scan Ulang</a>`
          }
        </div>
      </body>
      </html>
    `);
  });

  app.get('/reset-auth', async (req, res) => {
    if (resetAuthHandler) {
      await resetAuthHandler();
    }
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="refresh" content="2;url=/qr">
        <title>Resetting Session...</title>
        <style>body { font-family: sans-serif; background: #0f172a; color: white; text-align: center; padding-top: 50px; }</style>
      </head>
      <body>
        <h2>🔄 Sesi WhatsApp Lama Telah Dihapus!</h2>
        <p>Sedang membuat QR Code baru... Mohon tunggu sebentar (Otomatis diarahkan ke halaman QR).</p>
      </body>
      </html>
    `);
  });

  app.get('/qr', async (req, res) => {
    if (botStatus === 'Connected') {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Bot Connected</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: sans-serif; background: #0f172a; color: white; text-align: center; padding-top: 50px; }
            .box { background: #1e293b; display: inline-block; padding: 30px; border-radius: 12px; }
            a.btn-danger { display: inline-block; background: #dc2626; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 0.5rem; font-weight: bold; margin-top: 1.5rem; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>✅ WhatsApp Sudah Terhubung!</h2>
            <p>Nomor: <b>${connectedNumber || 'Aktif'}</b></p>
            <p>Silakan kirim pesan WhatsApp ke nomor ini untuk mencoba chat dengan AI.</p>
            <a href="/" style="color:#60a5fa;">Kembali ke Home</a><br>
            <a class="btn-danger" href="/reset-auth" onclick="return confirm('Apakah Anda yakin ingin logout dan membuat QR baru?')">🔄 Logout & Buat QR Baru</a>
          </div>
        </body>
        </html>
      `);
    }

    if (!currentQR) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta http-equiv="refresh" content="3">
          <title>Menunggu QR Code...</title>
          <style>
            body { font-family: sans-serif; background: #0f172a; color: white; text-align: center; padding-top: 50px; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; display: inline-block; max-width: 400px; }
            a.btn { display: inline-block; background: #dc2626; color: white; padding: 0.6rem 1.2rem; text-decoration: none; border-radius: 0.5rem; font-weight: bold; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⏳ Sedang Menyiapkan QR Code...</h2>
            <p>Halaman ini akan auto-refresh dalam 3 detik.</p>
            <br>
            <a class="btn" href="/reset-auth">🔄 Paksa Hapus Sesi & Buat QR Baru</a>
          </div>
        </body>
        </html>
      `);
    }

    try {
      const qrDataUrl = await QRCode.toDataURL(currentQR, { width: 320, margin: 2 });
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Scan WhatsApp QR Code</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="20">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; text-align: center; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            img { border-radius: 8px; background: white; padding: 8px; }
            p { font-size: 0.9rem; color: #94a3b8; }
            a.btn-reset { display: inline-block; color: #f87171; text-decoration: none; font-size: 0.85rem; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>📱 Scan QR WhatsApp</h2>
            <p>1. Buka WhatsApp di HP Anda<br>2. Pilih <b>Perangkat Tertaut (Linked Devices)</b><br>3. Arahkan kamera ke QR di bawah:</p>
            <img src="${qrDataUrl}" alt="Scan QR Code" />
            <p><i>QR Code akan otomatis refresh jika kedaluwarsa.</i></p>
            <a class="btn-reset" href="/reset-auth">🔄 QR bermasalah? Klik untuk Reset Sesi</a>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      res.status(500).send('Gagal membuat gambar QR code: ' + err.message);
    }
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      botStatus,
      connectedNumber,
      timestamp: new Date().toISOString()
    });
  });

  const server = app.listen(port, () => {
    console.log(`🌐 Web Dashboard & QR server running on port ${port}`);
    console.log(`🔗 Buka di browser: http://localhost:${port}/qr`);
  });

  return server;
}
