import fs from 'fs';
import path from 'path';

const authDir = process.env.AUTH_DIR || 'auth_session';
const learnedDataPath = path.resolve(authDir, 'learned_qa.json');

// Memory Cache
let learnedQAList = [];

function loadLearnedData() {
  try {
    if (fs.existsSync(learnedDataPath)) {
      const raw = fs.readFileSync(learnedDataPath, 'utf-8');
      learnedQAList = JSON.parse(raw);
    } else {
      // Seed awal auto-learning dengan percakapan sukses yang sudah teruji
      learnedQAList = [
        {
          question: "Apakah akun aplikasi premium ini aman dan ada garansi?",
          answer: "Seluruh akun APK Premium di Yuyun Premium Store 100% legal, resmi, dan bergaransi penuh selama masa aktif langganan. Jika ada kendala, admin langsung bantu ganti akun baru.",
          category: "apk_premium",
          successCount: 5
        },
        {
          question: "Kenapa pendaftaran IndiHome harus kirim foto KTP?",
          answer: "Foto KTP diperlukan untuk verifikasi data pelanggan resmi di sistem Telkomsel agar jaringan terdaftar sah atas nama pelanggan dan terlindungi dari penyalahgunaan pihak lain.",
          category: "indihome",
          successCount: 4
        },
        {
          question: "Bagusan paket 50 Mbps atau 75 Mbps untuk rumah?",
          answer: "Sangat direkomendasikan Paket 75 Mbps (Rp 250rb) karena hanya selisih Rp 20.000 dari 50 Mbps tapi kecepatan bertambah 50% lebih kencang dan anti-buffering untuk sekeluarga.",
          category: "indihome",
          successCount: 6
        },
        {
          question: "Biaya pasang 99rb bayar ke siapa dan kapan?",
          answer: "Tidak ada pembayaran di muka kepada teknisi di lapangan saat penarikan kabel. Pembayaran Rp 99.000 dilakukan resmi melalui sistem/aplikasi setelah internet aktif terpasang.",
          category: "indihome",
          successCount: 5
        },
        {
          question: "Apa beda IndiBiz 1S Basic dengan 1S Bisnis?",
          answer: "1S Basic memiliki rasio kecepatan 1:2 (download lebih besar), sedangkan 1S Bisnis memiliki kecepatan simetris 1:1 (upload & download seimbang) dengan prioritas SLA untuk kelancaran bisnis.",
          category: "indibiz",
          successCount: 4
        }
      ];
      saveLearnedData();
    }
  } catch (err) {
    console.warn('⚠️ Gagal membaca learned_qa.json, menginisialisasi baru:', err.message);
    learnedQAList = [];
  }
}

function saveLearnedData() {
  try {
    const dir = path.dirname(learnedDataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(learnedDataPath, JSON.stringify(learnedQAList, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Gagal menyimpan data learned_qa.json:', err.message);
  }
}

// Inisialisasi awal saat bot start
loadLearnedData();

/**
 * Merekam pembelajaran baru dari pertanyaan customer dan jawaban admin/sukses
 */
export function learnNewQA(question, answer, category = 'general') {
  if (!question || !answer || question.length < 5 || answer.length < 5) return;

  const qClean = question.trim();
  const aClean = answer.trim();

  // Cek apakah pertanyaan serupa sudah ada
  const existing = learnedQAList.find(item => 
    item.question.toLowerCase() === qClean.toLowerCase() ||
    (item.question.toLowerCase().includes(qClean.toLowerCase()) && qClean.length > 15)
  );

  if (existing) {
    existing.successCount = (existing.successCount || 1) + 1;
    existing.answer = aClean; // Update dengan jawaban terbaru yang lebih tepat
    console.log(`🧠 [Auto-Learning]: Memperbarui bobot pengetahuan lama ("${qClean.substring(0, 30)}...") ➔ Sukses: ${existing.successCount}x`);
  } else {
    learnedQAList.push({
      question: qClean,
      answer: aClean,
      category,
      successCount: 1,
      createdAt: new Date().toISOString()
    });
    console.log(`🧠 [Auto-Learning]: Berhasil mempelajari pengetahuan baru dari chat! ("${qClean.substring(0, 30)}...")`);
  }

  saveLearnedData();
}

/**
 * Mengambil konteks pembelajaran relevan (Few-Shot Injection) untuk memperkaya prompt AI
 */
export function getRelevantLearnedContext(userMessage, category = 'indihome') {
  if (!learnedQAList || learnedQAList.length === 0) return '';

  const text = (userMessage || '').toLowerCase();

  // Filter Q&A yang relevan dengan kata kunci di pertanyaan pengguna
  const matched = learnedQAList.filter(item => {
    const q = item.question.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 3);
    const matchesCategory = item.category === category || item.category === 'general';
    const matchesKeywords = words.some(w => q.includes(w));
    return matchesCategory || matchesKeywords;
  });

  // Ambil maksimal 4 contoh paling relevan dan terbukti sukses
  const topLearned = (matched.length > 0 ? matched : learnedQAList)
    .sort((a, b) => (b.successCount || 1) - (a.successCount || 1))
    .slice(0, 4);

  if (topLearned.length === 0) return '';

  return `
PENGALAMAN & PEMBELAJARAN CHAT SEBELUMNYA (AUTO-LEARNED EXAMPLES):
Gunakan referensi gaya menjawab dan informasi dari percakapan sukses sebelumnya berikut ini:
${topLearned.map((item, idx) => `Contoh ${idx + 1}:
T: "${item.question}"
J: "${item.answer}"`).join('\n\n')}
`;
}
