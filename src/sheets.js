import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedKnowledge = '';
let cachedStock = [];
let isRefreshing = false;

// 1. FUNGSI SIMPAN LEADS KE GOOGLE SHEETS
export async function appendLeadToSheet(leadData) {
  const webAppUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;

  if (webAppUrl && webAppUrl.startsWith('http')) {
    try {
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'append_lead',
          name: leadData.name || '-',
          email: leadData.email || '-',
          phone: leadData.phone || '-',
          package: leadData.package || '-',
          coordinates: leadData.coordinates || '-',
          status: 'Pelanggan Stand By (Siap Verifikasi OTP / 188)'
        })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        console.log(`📊 Lead [${leadData.name} - ${leadData.phone}] sukses dicatat ke Google Sheets via Web App!`);
        return true;
      }
    } catch (err) {
      console.warn('⚠️ Gagal kirim ke Google Sheets Web App:', err.message);
    }
  }

  // METODE B: Google Service Account
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const credPath = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || 'credentials.json');

  if (spreadsheetId && fs.existsSync(credPath)) {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: credPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const row = [
        now,
        leadData.name || '-',
        leadData.email || '-',
        leadData.phone || '-',
        leadData.package || '-',
        leadData.coordinates || '-',
        'Pelanggan Stand By'
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Leads_Pendaftaran!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
      });
      console.log(`📊 Lead [${leadData.name}] berhasil dicatat ke Google Sheets (Service Account)!`);
      return true;
    } catch (err) {
      console.error('❌ Gagal mencatat lead ke Google Sheets:', err.message);
    }
  }

  return false;
}

// 2. FUNGSI SINKRONISASI KNOWLEDGE BASE & STOK DARI GOOGLE SHEETS
export async function refreshDynamicKnowledgeBackground() {
  if (isRefreshing) return;
  const webAppUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;

  if (webAppUrl && webAppUrl.startsWith('http')) {
    isRefreshing = true;
    try {
      const res = await fetch(webAppUrl, { method: 'GET' });
      const data = await res.json();
      if (data.status === 'success') {
        let text = '';
        if (data.promo && data.promo.length > 1) {
          text += '\n\nUPDATE PROMO TERBARU DARI GOOGLE SHEETS (PROMO_PAKET):\n';
          for (let i = 1; i < data.promo.length; i++) {
            const row = data.promo[i];
            const price = typeof row[3] === 'number' ? `Rp ${row[3].toLocaleString('id-ID')}` : (row[3] || '');
            text += `- [${row[0] || 'Paket'}] ${row[1] || ''} (${row[2] || ''}): ${price} - ${row[4] || ''}\n`;
          }
        }
        if (data.knowledge && data.knowledge.length > 1) {
          text += '\n\nKNOWLEDGE TAMBAHAN PRODUK LAIN DARI GOOGLE SHEETS (KNOWLEDGE_CUSTOM):\n';
          for (let i = 1; i < data.knowledge.length; i++) {
            const row = data.knowledge[i];
            text += `PRODUK/TOPIK: ${row[0]}\nKATA KUNCI: ${row[1]}\nINFORMASI/JAWABAN: ${row[2]}\n---\n`;
          }
        }
        if (data.stock && data.stock.length > 1) {
          cachedStock = [];
          for (let i = 1; i < data.stock.length; i++) {
            const row = data.stock[i];
            const rawPrice = row[2];
            const formattedPrice = typeof rawPrice === 'number' ? `Rp ${rawPrice.toLocaleString('id-ID')}` : String(rawPrice || '').trim();
            cachedStock.push({
              name: String(row[0] || '').trim(),
              category: String(row[1] || '').trim(),
              price: formattedPrice,
              status: String(row[3] || 'Ready').trim().toLowerCase(),
              note: String(row[4] || '').trim()
            });
          }
        }
        if (text) {
          cachedKnowledge = text;
          console.log('🔄 Dynamic Knowledge, Promo & Stok berhasil disinkronkan dari Google Sheets!');
        }
      }
    } catch (e) {
    } finally {
      isRefreshing = false;
    }
  }
}

export function getCachedKnowledge() {
  return cachedKnowledge;
}

// 3. FUNGSI FORMAT LIST DAFTAR HARGA & STOK APLIKASI PREMIUM (GOOGLE SHEETS)
export function formatAppStockList() {
  let privateList = [];
  let sharingList = [];

  const stockList = (cachedStock && cachedStock.length > 0) ? cachedStock : [
    { name: 'Netflix 1P1U', category: 'Private', price: 'Rp 35.000', status: 'ready' },
    { name: 'CapCut PRO', category: 'Private', price: 'Rp 34.000', status: 'ready' },
    { name: 'ChatGPT Plus', category: 'Private', price: 'Rp 23.000', status: 'kosong' },
    { name: 'Spotify', category: 'Private', price: 'Rp 31.000', status: 'ready' },
    { name: 'Aplikasi Drama Pendek (Netshort, Dramabox, dll)', category: 'Private', price: 'Rp 24.000', status: 'ready' },
    { name: 'Canva', category: 'Private', price: 'Rp 5.000', status: 'ready' },
    { name: 'Prime Video', category: 'Private', price: 'Rp 19.000', status: 'ready' },
    { name: 'Viu', category: 'Private', price: 'Rp 5.000', status: 'ready' },
    { name: 'Netflix 1P2U', category: 'Sharing', price: 'Rp 23.000', status: 'kosong' },
    { name: 'CapCut PRO', category: 'Sharing', price: 'Rp 24.000', status: 'ready' },
    { name: 'Disney+', category: 'Sharing', price: 'Rp 24.000', status: 'ready' }
  ];

  for (const item of stockList) {
    const isReady = item.status !== 'kosong' && item.status !== 'habis';
    const statusBadge = isReady ? '🟢 *Ready*' : '🔴 *Kosong*';
    const line = `• *${item.name} :* ${item.price} / bln (${statusBadge})`;
    if (item.category.toLowerCase().includes('sharing')) {
      sharingList.push(line);
    } else {
      privateList.push(line);
    }
  }

  let result = '💎 *DAFTAR HARGA & STOK AKUN PRIVATE:*\n' + privateList.join('\n');
  if (sharingList.length > 0) {
    result += '\n\n👥 *DAFTAR HARGA & STOK AKUN SHARING:*\n' + sharingList.join('\n');
  }
  return result;
}

// 4. FUNGSI CEK STOK APLIKASI PREMIUM (GOOGLE SHEETS)
export function getAppStockStatus(userText) {
  const query = (userText || '').toLowerCase();

  // Cari di cache Google Sheet jika ada
  if (cachedStock && cachedStock.length > 0) {
    for (const item of cachedStock) {
      const itemNameLower = item.name.toLowerCase();

      // Match Netflix
      if (query.includes('netflix') && itemNameLower.includes('netflix')) {
        const isSharing = query.includes('sharing') || query.includes('share') || query.includes('1p2u');
        if (isSharing && itemNameLower.includes('1p2u')) return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
        if (!isSharing && (itemNameLower.includes('1p1u') || !itemNameLower.includes('1p2u'))) return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
      // Match CapCut
      if (query.includes('capcut') && itemNameLower.includes('capcut')) {
        const isSharing = query.includes('sharing') || query.includes('share');
        if (isSharing && item.category.toLowerCase().includes('sharing')) return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
        if (!isSharing && (item.category.toLowerCase().includes('private') || !itemNameLower.includes('sharing'))) return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
      // Match ChatGPT
      if ((query.includes('chatgpt') || query.includes('chat gpt')) && (itemNameLower.includes('chatgpt') || itemNameLower.includes('chat gpt'))) {
        return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
      // Match Spotify
      if (query.includes('spotify') && itemNameLower.includes('spotify')) {
        return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
      // Match Disney+
      if (query.includes('disney') && itemNameLower.includes('disney')) {
        return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
      // Match Canva
      if (query.includes('canva') && itemNameLower.includes('canva')) {
        return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
      // Match Prime Video
      if ((query.includes('prime') || query.includes('amazon')) && (itemNameLower.includes('prime') || itemNameLower.includes('amazon'))) {
        return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
      // Match Viu
      if (query.includes('viu') && itemNameLower.includes('viu')) {
        return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
      // Match Drama Pendek / Netshort / Dramabox
      if ((query.includes('drama') || query.includes('netshort') || query.includes('dramabox')) && (itemNameLower.includes('drama') || itemNameLower.includes('netshort') || itemNameLower.includes('dramabox'))) {
        return { ...item, isReady: item.status !== 'kosong' && item.status !== 'habis' };
      }
    }
  }

  // Fallback defaults
  if (query.includes('netflix')) {
    const isSharing = query.includes('sharing') || query.includes('1p2u');
    return { name: isSharing ? 'Netflix 1P2U Sharing' : 'Netflix 1P1U Private', price: isSharing ? 'Rp 23.000' : 'Rp 35.000', isReady: !isSharing };
  }
  if (query.includes('chatgpt') || query.includes('chat gpt')) {
    return { name: 'ChatGPT Plus Private', price: 'Rp 23.000', isReady: false };
  }
  if (query.includes('capcut')) {
    const isSharing = query.includes('sharing');
    return { name: isSharing ? 'CapCut PRO Sharing' : 'CapCut PRO Private', price: isSharing ? 'Rp 24.000' : 'Rp 34.000', isReady: true };
  }
  if (query.includes('spotify')) {
    return { name: 'Spotify Private', price: 'Rp 31.000', isReady: true };
  }
  if (query.includes('disney')) {
    return { name: 'Disney+ Sharing', price: 'Rp 24.000', isReady: true };
  }
  if (query.includes('canva')) {
    return { name: 'Canva Pro Private', price: 'Rp 5.000', isReady: true };
  }
  if (query.includes('prime') || query.includes('amazon')) {
    return { name: 'Prime Video Private', price: 'Rp 19.000', isReady: true };
  }
  if (query.includes('viu')) {
    return { name: 'Viu Premium Private', price: 'Rp 5.000', isReady: true };
  }
  if (query.includes('drama') || query.includes('netshort') || query.includes('dramabox')) {
    return { name: 'Aplikasi Drama Pendek (Netshort, Dramabox, dll)', price: 'Rp 24.000', isReady: true };
  }

  return { name: 'Aplikasi Premium', price: '', isReady: true };
}

// Log pertanyaan baru
export async function logUnansweredQuestion(phone, question) {
  return true;
}
