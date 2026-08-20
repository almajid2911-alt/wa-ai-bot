import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCachedKnowledge } from './sheets.js';
import { matchLocalIntent } from './localEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let staticKnowledge = '';
try {
  staticKnowledge = fs.readFileSync(path.resolve(__dirname, '../knowledge/indihome_faq.md'), 'utf-8');
} catch (e) {
  console.warn('⚠️ Knowledge base file not found, using fallback.');
}

const conversationHistory = new Map();
const MAX_HISTORY = 18;

export function resetAIConversation(remoteJid) {
  if (conversationHistory.has(remoteJid)) {
    conversationHistory.delete(remoteJid);
    console.log(`🧹 Histori AI dibersihkan untuk: ${remoteJid}`);
    return true;
  }
  return false;
}

function buildSystemInstruction(productContext = 'indihome') {
  const botName = process.env.BOT_NAME || 'Sarah';
  const companyName = process.env.COMPANY_NAME || 'IndiHome Telkomsel';
  const dynamicKnowledge = getCachedKnowledge();

  return `
Kamu adalah "${botName}", Customer Relationship & Sales Consultant resmi profesional dari ${companyName} & Telkom Indonesia.
Gaya bicaramu: Ramah, santun, responsif, solutif, komunikatif, profesional, dan menggunakan emoji yang pas. Panggil pelanggan dengan nama mereka jika diketahui, atau "Kak".

KNOWLEDGE BASE & DAFTAR PRODUK RESMI:
---
${staticKnowledge}
${dynamicKnowledge}
---

ATURAN ALUR PENDAFTARAN & SOP SALES:

1. **PRODUK INDIHOME (INTERNET RUMAH/KELUARGA - DEFAULT):**
   - Promo Biaya Pasang (PSB): Rp 99.000 saja (Normal 500rb), dibayar resmi setelah aktif (TIDAK ADA BAYAR DI MUKA KE TEKNISI).
   - Paket: 50 Mbps (230rb), 75 Mbps (250rb ⭐ Best Seller), 150 Mbps (325rb), 200 Mbps (490rb).
   - Link Daftar Mandiri: https://www.telkomsel.com/fmc-indihome/sobat-indihome?refcode=RT20941067
   - Berkas Foto: Foto Rumah Tampak Depan & Foto KTP.

2. **PRODUK INDIBIZ (INTERNET BISNIS / KANTOR / TEMPAT USAHA / KAFE / RUKO):**
   - Hanya ditawarkan jika pelanggan menanyakan internet kantor/bisnis/usaha/indibiz.
   - Paket 1S Basic (50M: 320rb, 75M: 365rb, 100M: 440rb, 150M: 540rb, 200M: 675rb, 300M: 950rb).
   - Paket 1S Bisnis Simetris (50M: 355rb, 75M: 415rb, 100M: 535rb, 150M: 620rb, 200M: 790rb, 300M: 1.130rb).
   - Link Daftar Mandiri IndiBiz: https://sobiz.indibiz.co.id/landingpage?rc=RBIZalmaj
   - Berkas Foto: Foto Bangunan/Tempat Usaha Tampak Depan, Foto KTP Penanggung Jawab, Foto NPWP.
   - ⛔ JANGAN mencampuradukkan nama paket IndiHome atau promo IndiHome saat melayani IndiBiz.

3. **PRODUK APLIKASI PREMIUM (YUYUN PREMIUM STORE):**
   - Hanya ditawarkan jika pelanggan menanyakan aplikasi premium / Netflix / Spotify / CapCut / Canva / ChatGPT / Viu / Disney / Prime / Drama.
   - Private: Netflix 1P1U (35rb), CapCut Pro (34rb), ChatGPT (23rb - Kosong), Spotify (31rb), Canva (5rb), Viu (5rb), Prime (19rb), Drama (24rb).
   - Sharing: Netflix 1P2U (23rb - Kosong), CapCut Pro (24rb), Disney+ (24rb). Jam operasional 08.00-20.00.
   - ⛔ JANGAN PERNAH meminta foto rumah, foto KTP, atau formulir registrasi internet untuk pesanan APK Premium!
   - ⚡ Untuk pesanan APK Premium: Langsung berikan nominal harga + kirim QRIS ("attachImage": "qris-yuyun.png") + arahkan ketik "#sudahbayar" setelah transfer.

4. **OBJECTION HANDLING & SALES PSYCHOLOGY:**
   - **Legalitas APK:** 100% legal, resmi, dan bergaransi penuh selama masa langganan (ganti akun jika kendala).
   - **Keamanan KTP:** KTP hanya untuk verifikasi data pelanggan resmi di sistem Telkomsel agar sah & aman dari penyalahgunaan.
   - **Biaya Pasang 99K:** Tidak ada bayar di muka ke teknisi; pembayaran melalui sistem/aplikasi setelah internet aktif terpasang.
   - **Konsultasi Paket:** Sangat rekomendasikan 75 Mbps (250rb) karena cuma selisih 20rb dari 50 Mbps (230rb) tapi kecepatan 50% lebih kencang & stabil untuk sekeluarga.

5. **TAHAPAN FUNNEL PENDAFTARAN:**
   - **Tahap 1 (Awal/Konsultasi):** Jawab pertanyaan pelanggan dengan cerdas & luwes, sebutkan promo pasang 99rb (untuk IndiHome), lalu minta Share Location GPS titik lokasi rumah/usaha untuk cek tiang ODP. (⛔ JANGAN minta form/KTP di tahap awal).
   - **Tahap 2 (Kirim Lokasi):** Konfirmasi tiang ODP tersedia & siap pasang, sebutkan paket favorit, dan tanyakan apakah berminat diamankan slot promonya.
   - **Tahap 3 (Pelanggan Siap Daftar / Memilih Kecepatan):** Kirim form formulir 4 data ringkas + minta foto berkas yang sesuai.
   - **Tahap 4 (Pelanggan Kirim Form/Foto):** Tanyakan kesiapan stand by verifikasi WhatsApp/SMS/Email.
   - **Tahap 5 (Pelanggan Balas "Siap"):** Berikan 2 Opsi pendaftaran:
     1. Dibantu Input oleh Admin Sales (Jam 10.00 - 22.00)
     2. Daftar Mandiri Langsung via Link Resmi (24 Jam Aktif Tanpa Antre).
   - **Tahap 6 (Pilihan Opsi):** Jika pelanggan pilih opsi 2 (mandiri), layani dengan ramah dan pandu pengisian link resminya.

6. **LAPOR GANGGUAN / KOMPLAIN:**
   - Edukasi dengan empati: Saluran perbaikan teknisi paling cepat adalah Call Center 188 (siapkan ID Pelanggan) atau aplikasi MyTelkomsel menu Bantuan > IndiHome.

FORMAT OUTPUT JSON WAJIB:
Kamu HARUS SELALU mengembalikan output dalam format JSON murni:
{
  "reply": "Pesan teks balasan WhatsApp untuk pelanggan",
  "attachImage": "brosur-indihome.jpg" | "brosur-indibiz.jpg" | "brosur-apk-premium.png" | null,
  "copyFormTemplate": "Nama Pelanggan: \\nEmail: \\nNo HP / WA: \\nPaket yang Dipilih: " | null,
  "leadData": {
    "name": "Nama jika terisi",
    "email": "Email jika terisi",
    "phone": "Nomor HP jika terisi",
    "package": "Nama paket jika terisi"
  } | null,
  "isConfirmedReady": true | false,
  "customerChoiceAdmin": true | false,
  "customerChoiceSelf": true | false,
  "productContext": "indihome" | "indibiz" | "apk_premium"
}
`;
}

// Fast regex helper to extract 4 fields from user message
export function parseFormDirectly(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  
  // Minimal harus ada kata kunci form
  if (!lower.includes('nama') && !lower.includes('paket') && !lower.includes('hp') && !lower.includes('wa') && !lower.includes('email')) {
    return null;
  }

  const nameMatch = text.match(/nama(?:\s*pelanggan)?\s*:\s*([^\n\r]+)/i);
  const emailMatch = text.match(/email\s*:\s*([^\n\r]+)/i);
  const phoneMatch = text.match(/(?:no\s*hp|nomor\s*hp|wa|whatsapp|no\s*wa)\s*:\s*([^\n\r]+)/i);
  const packageMatch = text.match(/(?:paket|pilihan\s*paket|paket\s*yang\s*dipilih)\s*:\s*([^\n\r]+)/i);

  let rawName = nameMatch ? nameMatch[1].trim() : '';
  if (rawName.toLowerCase().startsWith('email:')) rawName = '';

  const email = emailMatch ? emailMatch[1].trim() : '';
  const phone = phoneMatch ? phoneMatch[1].trim() : '';
  const pkg = packageMatch ? packageMatch[1].trim() : '';

  if (email || phone || pkg) {
    return {
      name: rawName,
      email: email,
      phone: phone,
      package: pkg
    };
  }
  return null;
}

export async function generateAIReply(remoteJid, userMessage, senderName = 'Kak', productContext = 'indihome') {
  const currentProd = (typeof productContext === 'object' ? productContext.product : productContext) || 'indihome';
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // 1. FAST-PATH RULE 1: DETEKSI FORMULIR PENDAFTARAN (0 TOKEN)
  const directLead = parseFormDirectly(userMessage);
  if (directLead) {
    console.log('⚡ Direct Form Parser Sukses Mengekstrak Data (0 Token):', directLead);
    const custName = directLead.name || senderName;
    return {
      replyText: `Terima kasih banyak, Kak ${custName}! Data pendaftaran Kakak sudah Sarah terima dengan lengkap 😊\n\nSebelum data diproses ke sistem resmi, **apakah Kak ${custName} saat ini sudah stand by di HP** untuk menerima verifikasi pendaftaran via WhatsApp, SMS, atau Email?\n\nJika sudah stand by, mohon balas **'Siap'** ya kak agar langsung kita proseskan sekarang juga 🙏📶`,
      attachImage: null,
      copyFormTemplate: null,
      leadData: directLead,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      unansweredQuestion: null,
      requestHuman: null,
      updatedProduct: currentProd
    };
  }

  // 2. FAST-PATH RULE 2: DETEKSI JAWABAN "SIAP / STANDBY" (0 TOKEN)
  const trimmed = (userMessage || '').trim().toLowerCase();
  const isIndibiz = currentProd === 'indibiz';
  const regLink = isIndibiz
    ? 'https://sobiz.indibiz.co.id/landingpage?rc=RBIZalmaj'
    : 'https://www.telkomsel.com/fmc-indihome/sobat-indihome?refcode=RT20941067';
  const brandName = isIndibiz ? 'IndiBiz by Telkom Indonesia' : 'IndiHome Telkomsel';

  if (trimmed === 'siap' || trimmed === 'stand by' || trimmed === 'standby' || trimmed === 'sudah siap' || trimmed === 'oke siap' || trimmed === 'siap kak' || trimmed === 'siap min') {
    console.log(`⚡ Fast-Path Respon Jawaban Siap [Konteks: ${currentProd}] (0 Token)`);
    return {
      replyText: `Siap, terima kasih banyak Kak ${senderName}! Mohon ditunggu sebentar yaa kak 😊\n\nUntuk proses pendaftaran ${brandName}, Kak ${senderName} bisa memilih 2 cara berikut:\n\n1️⃣ **Dibantu Input oleh Admin Sales Kami (Jam Operasional 10.00 - 22.00):**\nAdmin sales resmi kami akan langsung mengambil alih chat ini untuk memproseskan pendaftaran Kakak ke sistem (mohon tetap stand by di HP sebentar ya kak).\n\n2️⃣ **Daftar Mandiri Langsung via Link Resmi:**\nKakak bisa langsung input pendaftaran mandiri secara instan melalui link resmi berikut:\n👉 ${regLink}\n\nKak ${senderName} mau dibantu proses oleh Admin (ketik **1**) atau mau daftar mandiri via link (ketik **2**)? 😊`,
      attachImage: null,
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: true,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      unansweredQuestion: null,
      requestHuman: null,
      updatedProduct: currentProd
    };
  }

  // 3. FAST-PATH RULE 3: DETEKSI PILIHAN 1 (ADMIN SALES) (0 TOKEN)
  if (trimmed === '1' || trimmed === 'opsi 1' || trimmed === 'pilih 1' || trimmed === 'dibantu admin' || trimmed === 'admin') {
    console.log('⚡ Fast-Path Pilihan Opsi 1 (0 Token)');
    return {
      replyText: `Baik Kak ${senderName}! Tim admin sales kami segera mengambil alih chat ini untuk memproseskan pendaftaran ${brandName} Kakak ke sistem resmi yaa. Mohon tetap stand by sebentar di WhatsApp/HP untuk menerima kode/notifikasi verifikasi. Terima kasih banyak kak! 🙏✨`,
      attachImage: null,
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: true,
      customerChoiceSelf: false,
      unansweredQuestion: null,
      requestHuman: null,
      updatedProduct: currentProd
    };
  }

  // 4. FAST-PATH RULE 4: DETEKSI PILIHAN 2 (DAFTAR MANDIRI LINK) (0 TOKEN)
  if (trimmed === '2' || trimmed === 'opsi 2' || trimmed === 'pilih 2' || trimmed === 'daftar sendiri' || trimmed === 'link' || trimmed === 'mandiri') {
    console.log(`⚡ Fast-Path Pilihan Opsi 2 [Konteks: ${currentProd}] (0 Token)`);
    return {
      replyText: `Siap Kak ${senderName}! Silakan klik link pendaftaran resmi ${brandName} berikut yaa:\n👉 ${regLink}\n\nNanti tinggal ikuti petunjuk di website. Jika ada kendala saat pengisian form, jangan ragu kabari Sarah di sini yaa 😊🙏`,
      attachImage: null,
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: true,
      unansweredQuestion: null,
      requestHuman: null,
      updatedProduct: currentProd
    };
  }

  // 5. LOCAL INTENT ENGINE: Respon Cepat Lokal
  const sessionObj = typeof productContext === 'object' ? productContext : { product: currentProd };
  const localMatch = matchLocalIntent(userMessage, senderName, remoteJid, sessionObj);
  if (localMatch) {
    console.log(`💡 Local Intent Engine Menjawab: "${userMessage.substring(0, 30)}..." (Hemat 100% Token API)`);
    return {
      ...localMatch,
      unansweredQuestion: null,
      requestHuman: null
    };
  }

  // 6. GENERATIVE AI ENGINE (OPENAI GPT-4O-MINI OR GOOGLE GEMINI)
  console.log(`🤖 Mengaktifkan Full AI Intelligence untuk pesan kompleks: "${userMessage}"`);
  const systemInstruction = buildSystemInstruction(currentProd);

  // Maintain History
  let history = conversationHistory.get(remoteJid) || [];
  history.push({ role: 'user', content: userMessage });
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
  conversationHistory.set(remoteJid, history);

  // A. TRY OPENAI (GPT-4O-MINI) IF CONFIGURED
  if (openaiApiKey && openaiApiKey.startsWith('sk-')) {
    try {
      console.log('🌐 Memanggil OpenAI API (gpt-4o-mini)...');
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.content }))
        ],
        temperature: 0.7
      });

      const rawJson = response.choices[0]?.message?.content;
      const parsed = JSON.parse(rawJson);
      history.push({ role: 'model', content: parsed.reply });
      conversationHistory.set(remoteJid, history);

      return {
        replyText: parsed.reply,
        attachImage: parsed.attachImage || null,
        copyFormTemplate: parsed.copyFormTemplate || null,
        leadData: parsed.leadData || null,
        isConfirmedReady: !!parsed.isConfirmedReady,
        customerChoiceAdmin: !!parsed.customerChoiceAdmin,
        customerChoiceSelf: !!parsed.customerChoiceSelf,
        unansweredQuestion: null,
        requestHuman: null,
        updatedProduct: parsed.productContext || currentProd
      };
    } catch (err) {
      console.error('❌ Error memanggil OpenAI API:', err.message);
    }
  }

  // B. TRY GOOGLE GEMINI IF CONFIGURED
  if (geminiApiKey) {
    const rawApiKeys = geminiApiKey.split(',').map(k => k.trim()).filter(Boolean);
    for (const key of rawApiKeys) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
          systemInstruction: systemInstruction,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        });

        const formattedContents = history.map(h => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }));

        const result = await model.generateContent({ contents: formattedContents });
        const textResponse = result.response.text();
        const parsed = JSON.parse(textResponse);

        history.push({ role: 'model', content: parsed.reply });
        conversationHistory.set(remoteJid, history);

        return {
          replyText: parsed.reply,
          attachImage: parsed.attachImage || null,
          copyFormTemplate: parsed.copyFormTemplate || null,
          leadData: parsed.leadData || null,
          isConfirmedReady: !!parsed.isConfirmedReady,
          customerChoiceAdmin: !!parsed.customerChoiceAdmin,
          customerChoiceSelf: !!parsed.customerChoiceSelf,
          unansweredQuestion: null,
          requestHuman: null,
          updatedProduct: parsed.productContext || currentProd
        };
      } catch (err) {
        console.warn(`⚠️ Gagal memanggil Gemini Key: ${err.message}`);
      }
    }
  }

  // Fallback default
  return {
    replyText: `Halo Kak ${senderName}! Mau dibantu cek ketersediaan tiang jaringan ODP atau info promo paket terbaru? Boleh bantu kirimkan Share Location (GPS) titik lokasinya yaa 📍😊`,
    attachImage: null,
    copyFormTemplate: null,
    leadData: null,
    isConfirmedReady: false,
    customerChoiceAdmin: false,
    customerChoiceSelf: false,
    unansweredQuestion: null,
    requestHuman: null,
    updatedProduct: currentProd
  };
}
