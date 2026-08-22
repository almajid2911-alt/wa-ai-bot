import { getAppStockStatus, formatAppStockList } from './sheets.js';

// Track user selection stage for multi-tier apps (e.g. CapCut / Netflix Private vs Sharing)
const userPendingAppTier = new Map(); // remoteJid -> 'capcut' | 'netflix'

export function matchLocalIntent(userMessage, senderName = 'Kak', remoteJid = '', sessionState = { product: 'indihome', stage: 'initial' }) {
  const text = (userMessage || '').trim().toLowerCase();
  const name = senderName || 'Kak';
  const currentProduct = sessionState?.product || 'indihome';

  // 0. COMMAND KHUSUS KONFIRMASI PEMBAYARAN (#SUDAHBAYAR)
  if (text === '#sudahbayar' || text === '#sudah_bayar' || text === '#sudah-bayar' || text === '#lunas' || text === 'sudah bayar' || text === 'udah bayar') {
    userPendingAppTier.delete(remoteJid);
    return {
      replyText: `Terima kasih banyak atas konfirmasi pembayarannya, Kak ${name}! 🙏✨\n\nBukti pembayaran Kakak sedang dicek oleh tim admin kami dan pesanan akun premium Kakak segera diproseskan sekarang. Mohon ditunggu sebentar yaa! 😊`,
      attachImage: null,
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      isApkPaid: true,
      updatedProduct: 'apk_premium'
    };
  }

  // 1.5 INTENT: USER MEMILIH TIER (PRIVATE vs SHARING) DARI PERTANYAAN SEBELUMNYA
  const pendingApp = userPendingAppTier.get(remoteJid);
  const isChoosingPrivate = (
    text === 'private' || text === 'private ka' || text === 'private kak' || text === 'yang private' ||
    text === 'yg private' || text === '1' || text === 'opsi 1' || text === '34' || text === '34rb' ||
    text === '34.000' || text === '35' || text === '35rb' || text.includes('private') || text.includes('sendiri')
  );
  const isChoosingSharing = (
    text === 'sharing' || text === 'sharing ka' || text === 'sharing kak' || text === 'yang sharing' ||
    text === 'yg sharing' || text === '2' || text === 'opsi 2' || text === '24' || text === '24rb' ||
    text === '24.000' || text === '23' || text === '23rb' || text.includes('sharing') || text.includes('bareng')
  );

  if (pendingApp && (isChoosingPrivate || isChoosingSharing)) {
    userPendingAppTier.delete(remoteJid);
    if (pendingApp === 'capcut') {
      const tierName = isChoosingPrivate ? 'CapCut PRO Private' : 'CapCut PRO Sharing';
      const tierPrice = isChoosingPrivate ? 'Rp 34.000' : 'Rp 24.000';
      return {
        replyText: `Siap dengan senang hati, Kak ${name}! 🎉\n\nPesanan **${tierName}** seharga **${tierPrice}** status stok saat ini: **🟢 READY SIAP PAKAI** ✨\n\nSilakan lakukan pembayaran via scan QRIS resmi berikut:\n*(Foto QRIS terlampir di atas)*\n\nJika sudah melakukan pembayaran, mohon balas ketik: 👉 **#sudahbayar**\n\nSetelah itu tim admin kami akan langsung memproses dan mengirimkan akun premium Kakak yaa! 🙏😊`,
        attachImage: 'qris-yuyun.png',
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'apk_premium'
      };
    } else if (pendingApp === 'netflix') {
      if (isChoosingPrivate) {
        return {
          replyText: `Siap dengan senang hati, Kak ${name}! 🎉\n\nPesanan **Netflix 1P1U Private** seharga **Rp 35.000** status stok saat ini: **🟢 READY SIAP PAKAI** ✨\n\nSilakan lakukan pembayaran via scan QRIS resmi berikut:\n*(Foto QRIS terlampir di atas)*\n\nJika sudah melakukan pembayaran, mohon balas ketik: 👉 **#sudahbayar**\n\nSetelah itu tim admin kami akan langsung memproses dan mengirimkan akun premium Kakak yaa! 🙏😊`,
          attachImage: 'qris-yuyun.png',
          copyFormTemplate: null,
          leadData: null,
          isConfirmedReady: false,
          customerChoiceAdmin: false,
          customerChoiceSelf: false,
          updatedProduct: 'apk_premium'
        };
      } else {
        return {
          replyText: `Mohon maaf sekali Kak ${name}, untuk **Netflix 1P2U Sharing** saat ini sedang **🔴 KOSONG** 🙏\n\nYang saat ini ready adalah **Netflix 1P1U Private (Rp 35.000)**. Mau Sarah kirimkan QRIS untuk yang Private? 😊✨`,
          attachImage: null,
          copyFormTemplate: null,
          leadData: null,
          isConfirmedReady: false,
          customerChoiceAdmin: false,
          customerChoiceSelf: false,
          updatedProduct: 'apk_premium'
        };
      }
    }
  }

  // 1. INTENT: Tanya Kompatibilitas Perangkat / Smart TV / Nonton di TV (APK Premium)
  const isAskingDeviceSupport = (
    currentProduct === 'apk_premium' ||
    text.includes('netflix') || text.includes('capcut') || text.includes('apk') ||
    text.includes('disney') || text.includes('viu') || text.includes('prime')
  ) && (
    text.includes('tv') || text.includes('smart tv') || text.includes('smarttv') ||
    text.includes('laptop') || text.includes('hp') || text.includes('tonton') ||
    text.includes('nonton') || text.includes('layar') || text.includes('lg') ||
    text.includes('samsung') || text.includes('tab') || text.includes('pc')
  );

  if (isAskingDeviceSupport) {
    return {
      replyText: `Bisa banget yaa Kak ${name}! 📺✨\n\nAkun **Netflix 1P1U Private (Rp 35.000 / bln)** ini support 100% dan sangat lancar untuk langsung ditonton di **Smart TV (LG, Samsung, Android TV, Google TV, dll)**, Laptop, Tablet, maupun HP dengan kualitas **Ultra HD 4K jernih**!\n\n*(Bebas screen limit & bebas tabrakan user karena 1 Profile 1 User khusus milik Kakak)* 👍\n\nMau Sarah siapkan QRIS pembayarannya sekarang agar akunnya bisa langsung dipakai nonton di Smart TV? 😊`,
      attachImage: 'qris-yuyun.png',
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'apk_premium'
    };
  }

  // 1.1 INTENT: Lapor Gangguan / Komplain Kerusakan Internet & Kendala Modem/Router
  // 🔒 Guard Ketat: HANYA BOLEH AKTIF JIKA BUKAN KONTEKS APK PREMIUM
  const isDiscussingStreamingOrApp = currentProduct === 'apk_premium' ||
    text.includes('netflix') || text.includes('capcut') || text.includes('spotify') ||
    text.includes('canva') || text.includes('nonton') || text.includes('tonton');

  const troublePatterns = [
    /\bgangguan\b/i,
    /\blapor gangguan\b/i,
    /\binternet mati\b/i,
    /\bwifi mati\b/i,
    /\blos merah\b/i,
    /\blampu merah\b/i,
    /\blampu pon\b/i,
    /\blampu los\b/i,
    /\blos berkedip\b/i,
    /\bpon mati\b/i,
    /\bpon kedip\b/i,
    /\bpon merah\b/i,
    /\btidak ada internet\b/i,
    /\bga ada internet\b/i,
    /\bgak ada internet\b/i,
    /\bgak ada koneksi\b/i,
    /\bga ada koneksi\b/i,
    /\binternet lemot\b/i,
    /\bwifi lemot\b/i,
    /\bkendala jaringan\b/i,
    /\bkendala wifi\b/i,
    /\brusak\b/i,
    /\bkomplain\b/i,
    /\bpengaduan\b/i,
    /\btiket kendala\b/i,
    /\bperangkat ont\b/i,
    /\bont rusak\b/i,
    /\bkabel putus\b/i,
    /\bmati total\b/i,
    /\brestart modem\b/i,
    /\bsetting wifi\b/i,
    /\bkenapa merah\b/i,
    /\blampu router\b/i,
    /\blampu modem\b/i,
    /\binternet gangguan\b/i,
    /\bminta teknisi\b/i,
    /\bbutuh teknisi\b/i,
    /\bperbaikan jaringan\b/i
  ];

  if (!isDiscussingStreamingOrApp) {
    for (const pattern of troublePatterns) {
      if (pattern.test(text)) {
        return {
          replyText: `Halo Kak ${name}! Mohon maaf sekali atas ketidaknyamanan dan kendala jaringan/perangkat yang sedang dialami yaa 🙏\n\nNomor WhatsApp ini khusus melayani **Konsultasi & Pendaftaran Pasang Baru (PSB)**. Untuk penanganan perbaikan gangguan & pengecekan teknisi lapangan tercepat, silakan laporkan melalui jalur resmi:\n\n1️⃣ **Call Center 188 (Rekomendasi Utama & Paling Cepat):**\nHubungi nomor **188** langsung dari HP Kakak. Sebutkan **Nomor ID Pelanggan (12 Digit)** agar tiket perbaikan langsung otomatis diteruskan ke teknisi area rumah Kakak.\n\n2️⃣ **Aplikasi MyTelkomsel:**\nBuka aplikasi **MyTelkomsel** > masuk menu **Bantuan / IndiHome** > pilih **Lapor Gangguan / Cek Status Jaringan**.\n\n3️⃣ **GraPARI / Plasa Telkom Terdekat:**\nBisa langsung dibantu penanganan oleh Customer Service GraPARI terdekat.\n\nSemoga kendala internet Kak ${name} lekas normal dan lancar kembali yaa! 🙏📶`,
          attachImage: null,
          copyFormTemplate: null,
          leadData: null,
          isConfirmedReady: false,
          customerChoiceAdmin: false,
          customerChoiceSelf: false,
          isTroubleComplaint: true,
          updatedProduct: currentProduct
        };
      }
    }
  }

  // 1.8 OBJECTION HANDLING: Legalitas & Garansi Akun APK Premium
  const isAskingApkSafety = (
    text.includes('aman') || text.includes('legal') || text.includes('resmi') ||
    text.includes('garansi') || text.includes('banned') || text.includes('ke banned') || text.includes('kena ban')
  ) && (
    currentProduct === 'apk_premium' || text.includes('apk') || text.includes('akun') ||
    text.includes('netflix') || text.includes('capcut') || text.includes('spotify') || text.includes('canva')
  );
  if (isAskingApkSafety) {
    return {
      replyText: `Hai Kak ${name}! Jangan khawatir yaa, seluruh akun **APK Premium di Yuyun Premium Store 100% Legal, Resmi, dan Bergaransi Penuh** selama masa aktif langganan! 🛡️✨\n\nJika di tengah jalan ada kendala akun atau login, tim admin kami siap membantu reset atau langsung mengganti dengan akun baru seketika 🙏😊\n\nKak ${name} mau order akun aplikasi yang mana nih?`,
      attachImage: null,
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'apk_premium'
    };
  }

  // 1.9 OBJECTION HANDLING: Mengapa Harus Kirim Foto KTP
  const isAskingKtpSafety = (
    text.includes('kenapa ktp') || text.includes('kenapa harus ktp') || text.includes('foto ktp buat apa') ||
    text.includes('ktp buat apa') || text.includes('aman gak ktp') || text.includes('aman kah ktp') ||
    text.includes('wajib ktp') || text.includes('perlu ktp')
  );
  if (isAskingKtpSafety) {
    return {
      replyText: `Pertanyaan yang sangat bagus, Kak ${name}! 🙏\n\nFoto KTP diperlukan semata-mata untuk **Verifikasi Data Pelanggan Resmi di Sistem Telkomsel/IndiHome** agar jaringan internet terdaftar sah atas nama Kakak dan terhindar dari penyalahgunaan data 🔒🛡️\n\nData Kakak dijamin 100% aman dan hanya digunakan untuk keperluan aktivasi pasang baru IndiHome/IndiBiz saja yaa kak 😊👍`,
      attachImage: null,
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: currentProduct
    };
  }

  // 1.95 CONSULTATIVE UPSELLING: Tanya Rekomendasi Paket / Beda 50 vs 75 Mbps
  const isAskingRecommendation = (
    text.includes('rekomendasi') || text.includes('bagusan mana') || text.includes('bagus mana') ||
    text.includes('50 atau 75') || text.includes('beda 50 dan 75') || text.includes('saran') ||
    text.includes('pilih yang mana')
  ) && (currentProduct === 'indihome' || text.includes('indihome') || text.includes('wifi') || text.includes('mbps'));
  if (isAskingRecommendation) {
    return {
      replyText: `Untuk pemakaian di rumah (3–5 HP/Laptop + Smart TV), Sarah **sangat merekomendasikan Paket 75 Mbps (Rp 250.000 / bln)** ya Kak ${name}! ⭐🔥\n\nKenapa? Karena **hanya selisih Rp 20.000 saja dari paket 50 Mbps (Rp 230rb)**, tapi Kakak sudah dapat:\n• Kecepatan internet 50% jauh lebih kencang & anti-buffering saat dipakai rame-rame 🚀\n• Streaming video 4K & YouTube super lancar tanpa jeda 🎬\n• Promo biaya pasang cuma **Rp 99.000 saja**\n\nGimana Kak ${name}, berminat Sarah bantu amankan slot promo untuk Paket 75 Mbps? Boleh kirimkan Shareloc GPS titik rumahnya yaa 📍😊`,
      attachImage: 'brosur-indihome.jpg',
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'indihome'
    };
  }
  const hasSpecificApp = (
    text.includes('netflix') || text.includes('netflik') || text.includes('netplik') || text.includes('1p1u') || text.includes('1p2u') ||
    text.includes('capcut') || text.includes('cap cut') || text.includes('kapkut') ||
    text.includes('spotify') || text.includes('spotipy') || text.includes('spotifi') ||
    text.includes('chatgpt') || text.includes('chat gpt') ||
    text.includes('disney') || text.includes('disni') ||
    text.includes('canva') || text.includes('kanva') ||
    text.includes('prime') || text.includes('viu') || text.includes('viuu') ||
    text.includes('drama') || text.includes('netshort') || text.includes('dramabox')
  );

  const isGeneralListQuestion = (
    text.includes('apa saja') || text.includes('ada apa') || text.includes('list') ||
    text.includes('katalog') || text.includes('daftar harga') || text.includes('daftar aplikasi') ||
    text.includes('semua') || text.includes('menu') || text === 'apk premium' || text === 'aplikasi premium'
  );

  if (hasSpecificApp && !isGeneralListQuestion) {
    // A. JIKA MEMILIH CAPCUT TAPI BELUM MENENTUKAN PRIVATE / SHARING
    if (text.includes('capcut') && !text.includes('private') && !text.includes('sharing') && !text.includes('34') && !text.includes('24')) {
      userPendingAppTier.set(remoteJid, 'capcut');
      return {
        replyText: `Siap Kak ${name}! Untuk **CapCut PRO**, kami menyediakan 2 tipe pilihan: 🎉\n\n1️⃣ **Private : Rp 34.000 / bln** (🟢 *Ready* - 1 Akun Khusus Kakak Sendiri)\n2️⃣ **Sharing : Rp 24.000 / bln** (🟢 *Ready* - Akun Bersama Hemat)\n\nKak ${name} mau ambil yang **Private (34rb)** atau **Sharing (24rb)**? Boleh infokan agar langsung Sarah kirimkan QRIS pembayarannya yaa 😊✨`,
        attachImage: null,
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'apk_premium'
      };
    }

    // B. JIKA MEMILIH NETFLIX TAPI BELUM MENENTUKAN PRIVATE / SHARING
    if (text.includes('netflix') && !text.includes('private') && !text.includes('sharing') && !text.includes('1p1u') && !text.includes('1p2u') && !text.includes('35') && !text.includes('23')) {
      userPendingAppTier.set(remoteJid, 'netflix');
      return {
        replyText: `Siap Kak ${name}! Untuk **Netflix Premium**, kami menyediakan 2 tipe: 🎉\n\n1️⃣ **Netflix 1P1U Private : Rp 35.000 / bln** (🟢 *Ready* - 1 Profile 1 User Bebas Screen Limit)\n2️⃣ **Netflix 1P2U Sharing : Rp 23.000 / bln** (🔴 *Kosong*)\n\nUntuk saat ini yang ready tipe **1P1U Private (35rb)** ya kak. Mau Sarah siapkan QRIS untuk yang Private? 😊✨`,
        attachImage: null,
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'apk_premium'
      };
    }

    // C. CEK STOK PRODUK SPESIFIK DI GOOGLE SHEETS
    const stockInfo = getAppStockStatus(text);
    if (stockInfo.isReady) {
      const priceText = stockInfo.price ? `seharga **${stockInfo.price}**` : '';
      return {
        replyText: `Siap dengan senang hati, Kak ${name}! 🎉\n\nPesanan **${stockInfo.name}** ${priceText} status stok saat ini: **🟢 READY SIAP PAKAI** ✨\n\nSilakan lakukan pembayaran via scan QRIS resmi berikut:\n*(Foto QRIS terlampir di atas)*\n\nJika sudah melakukan pembayaran, mohon balas ketik: 👉 **#sudahbayar**\n\nSetelah itu tim admin kami akan langsung memproses dan mengirimkan akun premium Kakak yaa! 🙏😊`,
        attachImage: 'qris-yuyun.png',
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'apk_premium'
      };
    } else {
      return {
        replyText: `Mohon maaf sekali Kak ${name}, untuk stok akun **${stockInfo.name}** saat ini sedang **🔴 KOSONG / HABIS** di Google Sheets kami 🙏\n\nBerikut daftar akun yang saat ini **🟢 READY**:\n\n${formatAppStockList()}\n\nKak ${name} mau mencoba aplikasi premium yang ready di atas? 😊`,
        attachImage: null,
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'apk_premium'
      };
    }
  }

  // 3. SWITCH CONTEXT KHUSUS: Tanya Katalog / List Harga APK Premium Umum (Tanpa Gambar, Text + Status Stok)
  const isAskingPremiumGeneral = (
    text.includes('apk premium') || text.includes('aplikasi premium') || text.includes('akun premium') ||
    text.includes('jual akun') || text.includes('beli aplikasi') || text === 'apk' ||
    (isGeneralListQuestion && (currentProduct === 'apk_premium' || text.includes('apk') || text.includes('aplikasi') || text.includes('premium')))
  );

  if (isAskingPremiumGeneral) {
    const dynamicList = formatAppStockList();
    return {
      replyText: `Halo Kak ${name}! Kami menyediakan langganan **APK PREMIUM Resmi, Legal & Bergaransi** (Yuyun Premium Store) dengan harga hemat! 🎉✨\n\n${dynamicList}\n\n*(Jam Operasional Pemrosesan Akun: 08.00 – 20.00)*\n\nKak ${name} mau order akun aplikasi yang mana nih? Boleh infokan ke Sarah yaa agar langsung disiapkan QRIS pembayarannya 😊👍`,
      attachImage: null, // Tanpa gambar sesuai permintaan
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'apk_premium'
    };
  }

  // 4. SWITCH CONTEXT KHUSUS: IndiBiz (Tanya / Minta Info IndiBiz Bisnis)
  const isAskingIndibiz = (
    text.includes('indibiz') || text.includes('internet kantor') || text.includes('wifi kantor') ||
    text.includes('internet bisnis') || text.includes('internet kafe') || text.includes('internet ruko') ||
    text.includes('internet usaha') || text.includes('ip statis') || text.includes('simetris')
  );
  if (isAskingIndibiz && !text.includes('daftar') && !text.includes('mau') && !text.includes('pasang') && !text.includes('ambil') && !text.includes('basic') && !text.includes('bisnis')) {
    return {
      replyText: `Halo Kak ${name}! Kami melayani pendaftaran resmi **IndiBiz by Telkom Indonesia** khusus bisnis, kantor, kafe, ruko & tempat usaha 🏢🚀\n\n🔥 **Promo Spesial IndiBiz Awal Tahun:**\n\n📌 **PAKET INDIBIZ 1S BASIC:**\n• 50 Mbps : **Rp 320.000 / bln** (Diskon dari 360K)\n• 75 Mbps : **Rp 365.000 / bln**\n• 100 Mbps : **Rp 440.000 / bln**\n• 150 Mbps : **Rp 540.000 / bln**\n• 200 Mbps : **Rp 675.000 / bln**\n• 300 Mbps : **Rp 950.000 / bln**\n\n📌 **PAKET INDIBIZ 1S BISNIS (SLA Prioritas & Simetris):**\n• 50 Mbps : **Rp 355.000 / bln**\n• 75 Mbps : **Rp 415.000 / bln**\n• 100 Mbps : **Rp 535.000 / bln**\n• 150 Mbps : **Rp 620.000 / bln**\n• 200 Mbps : **Rp 790.000 / bln**\n• 300 Mbps : **Rp 1.130.000 / bln**\n\nBoleh bantu kirimkan Share Location / Alamat tempat usaha Kakak agar tim sales kami bantu cek jangkauan ODP & slot promonya? 📍😊`,
      attachImage: 'brosur-indibiz.jpg',
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'indibiz'
    };
  }

  // 5. CEK APAKAH USER MENYEBUTKAN KECEPATAN (50 / 75 / 100 / 150 / 200 / 300 Mbps)
  const isGeneralQuestion = text.includes('?') || text.includes('apa saja') || text.includes('berapa harganya') || text.includes('list harga') || text.includes('minta brosur');
  const speedMatch = text.match(/\b(50|75|100|150|200|300|500)\s*(?:mbps)?\b/i);

  if (speedMatch && !isGeneralQuestion) {
    const rawSpeed = speedMatch[1];
    
    // JIKA DALAM KONTEKS INDIBIZ:
    if (currentProduct === 'indibiz' || text.includes('indibiz') || text.includes('kantor') || text.includes('usaha')) {
      const chosenPackage = `IndiBiz ${rawSpeed} Mbps`;
      return {
        replyText: `Paket **${chosenPackage}** pilihan yang sangat tepat untuk tempat usaha Kakak! 😊 Untuk proses pendaftaran promo resmi IndiBiz, mohon bantu lengkapi format formulir di bawah ini ya Kak ${name}:\n\nSerta mohon kirimkan berkas foto:\n🏢 **Foto Bangunan / Tempat Usaha Tampak Depan**\n🪪 **Foto KTP Penanggung Jawab**\n📄 **Foto NPWP** (untuk data verifikasi bisnis resmi)\n\nDitunggu kelengkapan datanya yaa Kak ${name} agar langsung kita proseskan ke tim IndiBiz! 🙏🏢`,
        attachImage: null,
        copyFormTemplate: `Nama Pelanggan: \nEmail: \nNo HP / WA: \nPaket yang Dipilih: ${chosenPackage}`,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'indibiz'
      };
    }

    // JIKA DALAM KONTEKS INDIHOME (DEFAULT):
    const chosenPackage = `${rawSpeed} Mbps`;
    return {
      replyText: `Paket **${chosenPackage}** pilihan yang sangat tepat! 😊 Untuk proses pendaftaran promo pasang Rp 99.000, mohon bantu lengkapi format formulir di bawah ini ya Kak ${name}:\n\nSerta mohon kirimkan berkas foto:\n📸 **Foto Rumah Tampak Depan**\n📸 **Foto KTP** (untuk data verifikasi pendaftaran resmi)\n\nDitunggu kelengkapan datanya yaa Kak ${name} agar langsung kita proseskan! 🙏📶`,
      attachImage: null,
      copyFormTemplate: `Nama Pelanggan: \nEmail: \nNo HP / WA: \nPaket yang Dipilih: ${chosenPackage}`,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'indihome'
    };
  }

  // 6. INTENT: Pelanggan Mau Daftar / Cara Beli / Minta Form
  const isAskingToRegister = /^(mau|mau kak|mau daftar|mau ambil|saya mau|tertarik|minat|boleh|boleh kak|cara daftar|cara daftarnya gimana|gimana daftarnya|minta form|form pendaftaran|format form|form|belum tau cara daftar ny|belum tau cara daftarnya|belum tau caranya|gimana caranya|cara pesannya gimana|cara beli|cara belinya)$/i.test(text) ||
    (text.includes('cara daftar') || text.includes('gimana daftar') || text.includes('cara pesan') || text.includes('cara beli') || text.includes('cara order'));

  if (isAskingToRegister) {
    if (currentProduct === 'apk_premium' || text.includes('netflix') || text.includes('capcut') || text.includes('spotify') || text.includes('canva') || text.includes('apk')) {
      return {
        replyText: `Caranya sangat mudah & instan yaa Kak ${name}! 🎉\n\n1️⃣ **Lakukan Pembayaran:** Scan QRIS resmi kami (Foto QRIS terlampir di atas).\n*(Contoh: Rp 35.000 untuk Netflix 1P1U Private)*\n2️⃣ **Konfirmasi:** Balas ketik **#sudahbayar** di sini setelah transfer.\n3️⃣ **Terima Akun:** Tim kami akan langsung mengirimkan email & password akun resmi yang siap Kakak login dan langsung tonton di Smart TV / HP! 📺✨\n\nMau Sarah kirimkan QRIS pembayarannya sekarang? 😊`,
        attachImage: 'qris-yuyun.png',
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'apk_premium'
      };
    }

    if (currentProduct === 'indibiz') {
      return {
        replyText: `Siap dengan senang hati, Kak ${name}! 😊 Untuk proses pendaftaran promo resmi IndiBiz tempat usaha/kantor, mohon bantu lengkapi format formulir di bawah ini ya kak:\n\nSerta mohon kirimkan berkas foto:\n🏢 **Foto Bangunan / Tempat Usaha Tampak Depan**\n🪪 **Foto KTP Penanggung Jawab**\n📄 **Foto NPWP** (untuk data verifikasi bisnis resmi)\n\nDitunggu kelengkapan datanya yaa Kak ${name} agar langsung kita proseskan ke tim IndiBiz! 🙏🏢`,
        attachImage: null,
        copyFormTemplate: 'Nama Pelanggan: \nEmail: \nNo HP / WA: \nPaket yang Dipilih: ',
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'indibiz'
      };
    }

    return {
      replyText: `Siap dengan senang hati, Kak ${name}! 😊 Untuk proses pendaftaran promo pasang Rp 99.000, mohon bantu lengkapi format formulir di bawah ini ya kak:\n\nSerta mohon kirimkan berkas foto:\n📸 **Foto Rumah Tampak Depan**\n📸 **Foto KTP** (untuk data verifikasi pendaftaran resmi)\n\nDitunggu kelengkapan datanya yaa Kak ${name} agar langsung kita proseskan! 🙏📶`,
      attachImage: null,
      copyFormTemplate: 'Nama Pelanggan: \nEmail: \nNo HP / WA: \nPaket yang Dipilih: ',
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'indihome'
    };
  }

  // 7. INTENT: Kirim Shareloc GPS / Alamat Lokasi (Konfirmasi Sesuai Konteks)
  if (text.includes('titik share location gps') || text.includes('maps.google.com') || text.includes('maps.app.goo.gl') || (text.includes('lat') && text.includes('long'))) {
    if (currentProduct === 'indibiz') {
      return {
        replyText: `Kabar baik Kak ${name}! 🎉 Setelah Sarah cek titik lokasinya, jaringan fiber optik IndiBiz di area tempat usaha Kakak **sudah TERSEDIA dan siap pasang** 🏢📶\n\nUntuk paketnya ada IndiBiz 1S Basic (mulai 50 Mbps Rp 320rb & 75 Mbps Rp 365rb) dan 1S Bisnis (Simetris & Prioritas SLA).\n\nGimana Kak ${name}, berminat Sarah bantu amankan slot pendaftaran IndiBiz untuk tempat usahanya? 😊`,
        attachImage: null,
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'indibiz'
      };
    }

    return {
      replyText: `Kabar baik Kak ${name}! 🎉 Setelah Sarah cek titik lokasinya, jaringan fiber optik dan tiang ODP di area rumah Kakak **sudah TERSEDIA dan siap pasang** 📶\n\nUntuk paketnya ada 50 Mbps (Rp 230rb) dan 75 Mbps (Rp 250rb) yang paling laris dengan promo biaya pasang cuma Rp 99.000.\n\nGimana Kak ${name}, berminat Sarah bantu amankan slot promo pasang Rp 99.000 untuk paketnya? 😊`,
      attachImage: null,
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'indihome'
    };
  }

  // 8. INTENT: Tanya Paket / Daftar Harga / Brosur IndiHome / IndiBiz
  const hasPriceKeyword = (
    /\bpaket\b/i.test(text) || /\bharga\b/i.test(text) || /\btarif\b/i.test(text) ||
    /\bbrosur\b/i.test(text) || /\bdaftar harga\b/i.test(text) || /\blist harga\b/i.test(text) ||
    /\bmbps\b/i.test(text)
  );
  const hasInquiryContext = (
    /\bapa\b/i.test(text) || /\bberapa\b/i.test(text) || /\bnanya\b/i.test(text) ||
    /\btanya\b/i.test(text) || /\bada\b/i.test(text) || /\binfo\b/i.test(text) ||
    /\bpilihan\b/i.test(text) || /\bbrosur\b/i.test(text)
  );
  const isAskingPrice = hasPriceKeyword && hasInquiryContext && !text.includes('pln') && !text.includes('listrik');

  if (isAskingPrice) {
    if (currentProduct === 'indibiz' || text.includes('indibiz') || text.includes('kantor') || text.includes('usaha')) {
      return {
        replyText: `Berikut daftar paket promo resmi **IndiBiz by Telkom Indonesia** untuk bisnis & usaha ya Kak ${name} 🏢:\n\n📌 **PAKET INDIBIZ 1S BASIC:**\n• 50 Mbps : **Rp 320.000 / bln**\n• 75 Mbps : **Rp 365.000 / bln**\n• 100 Mbps : **Rp 440.000 / bln**\n• 150 Mbps : **Rp 540.000 / bln**\n• 200 Mbps : **Rp 675.000 / bln**\n• 300 Mbps : **Rp 950.000 / bln**\n\n📌 **PAKET INDIBIZ 1S BISNIS (Simetris 1:1):**\n• 50 Mbps : **Rp 355.000 / bln**\n• 75 Mbps : **Rp 415.000 / bln**\n• 100 Mbps : **Rp 535.000 / bln**\n• 150 Mbps : **Rp 620.000 / bln**\n• 200 Mbps : **Rp 790.000 / bln**\n• 300 Mbps : **Rp 1.130.000 / bln**\n\nBoleh bantu kirimkan Share Location / Alamat tempat usaha Kakak agar tim sales kami bantu cek jangkauan ODP & slot promonya? 📍😊`,
        attachImage: 'brosur-indibiz.jpg',
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'indibiz'
      };
    }

    return {
      replyText: `Berikut daftar paket promo terbaru IndiHome Telkomsel ya Kak ${name} 📶:\n\n1️⃣ **50 Mbps : Rp 230.000 / bln** (Hemat 1-4 HP)\n2️⃣ **75 Mbps : Rp 250.000 / bln** ⭐ *(Paling Laris, Cuma beda 20rb!)*\n3️⃣ **150 Mbps : Rp 325.000 / bln** (Super Kencang & 4K Streaming)\n4️⃣ **200 Mbps : Rp 490.000 / bln** (Power User & Usaha)\n\nSemua paket mendapatkan promo biaya pasang **cuma Rp 99.000 saja** (tanpa bayar di awal ke teknisi).\n\nBoleh bantu kirimkan Share Location rumah Kakak untuk Sarah bantu cek tiang jaringan ODP terdekat? 📍😊`,
      attachImage: 'brosur-indihome.jpg',
      copyFormTemplate: null,
      leadData: null,
      isConfirmedReady: false,
      customerChoiceAdmin: false,
      customerChoiceSelf: false,
      updatedProduct: 'indihome'
    };
  }

  // 9. INTENT: Tanya Biaya Pasang / Biaya Instalasi / PSB
  const psbPatterns = [
    /biaya pasang/i,
    /biaya pasangnya/i,
    /ongkos pasang/i,
    /biaya instalasi/i,
    /pasang berapa/i,
    /bayar berapa/i,
    /bayar di awal/i,
    /biaya awal/i,
    /psb/i
  ];
  for (const pattern of psbPatterns) {
    if (pattern.test(text)) {
      if (currentProduct === 'indibiz') {
        return {
          replyText: `Untuk biaya pasang baru IndiBiz tempat usaha, pembayarannya resmi melalui sistem/tagihan setelah layanan aktif terpasang ya Kak ${name} 😊\n\nBoleh bantu kirimkan Share Location WhatsApp titik tempat usaha Kakak dulu agar tim kami bantu cek ketersediaan tiang jaringannya? 📍`,
          attachImage: null,
          copyFormTemplate: null,
          leadData: null,
          isConfirmedReady: false,
          customerChoiceAdmin: false,
          customerChoiceSelf: false,
          updatedProduct: 'indibiz'
        };
      }

      return {
        replyText: `Untuk biaya pasang baru (PSB) saat ini sedang ada **Promo Spesial, Kak ${name}!** 🎉\n\n🔥 **Cuma Rp 99.000 saja** (dari harga normal Rp 500.000).\n\nDan yang paling penting, **TIDAK ADA PEMBAYARAN DI MUKA KEPADA TEKNISI** yaa kak! Pembayaran resmi dilakukan melalui sistem/aplikasi setelah internet aktif terpasang di rumah 😊👍\n\nBoleh bantu kirimkan Share Location WhatsApp titik rumah Kakak dulu agar Sarah bantu cek ketersediaan tiang jaringannya? 📍`,
        attachImage: null,
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'indihome'
      };
    }
  }

  // 10. INTENT: Sapaan / Greeting Awal
  const greetingPatterns = [
    /halo/i,
    /hai/i,
    /assalamualaikum/i,
    /selamat pagi/i,
    /selamat siang/i,
    /selamat sore/i,
    /selamat malam/i,
    /^p$/i,
    /mau pasang/i,
    /pasang wifi/i,
    /pasang indihome/i,
    /daftar indihome/i,
    /daftar wifi/i,
    /info/i
  ];
  for (const pattern of greetingPatterns) {
    if (pattern.test(text)) {
      if (currentProduct === 'indibiz') {
        return {
          replyText: `Halo Kak ${name}! Mau dibantu cek paket atau pendaftaran **IndiBiz by Telkom Indonesia** untuk tempat usahanya? Boleh bantu kirimkan **Share Location (GPS)** titik lokasi usahanya yaa 📍🏢`,
          attachImage: null,
          copyFormTemplate: null,
          leadData: null,
          isConfirmedReady: false,
          customerChoiceAdmin: false,
          customerChoiceSelf: false,
          updatedProduct: 'indibiz'
        };
      }

      return {
        replyText: `Halo Kak ${name}! Selamat datang di layanan resmi IndiHome by Telkomsel 😊\n\nSaat ini lagi ada **Promo Spesial Biaya Pasang Cuma Rp 99.000** (Normal Rp 500rb) dan paket internet fiber mulai 50 Mbps (Rp 230rb) & 75 Mbps (Rp 250rb) yang paling laris! 🔥\n\nBiar Sarah bantu cek ketersediaan tiang jaringan ODP di sekitar rumah Kakak dulu yaa, boleh bantu kirimkan **Share Location (GPS) WhatsApp** titik rumah Kakak? 📍`,
        attachImage: null,
        copyFormTemplate: null,
        leadData: null,
        isConfirmedReady: false,
        customerChoiceAdmin: false,
        customerChoiceSelf: false,
        updatedProduct: 'indihome'
      };
    }
  }

  return null;
}
