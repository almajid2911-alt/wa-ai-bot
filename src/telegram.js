export async function sendTelegramNotification(messageText) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.warn('⚠️ Telegram API error:', data.description);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ Gagal mengirim notifikasi ke Telegram:', err.message);
    return false;
  }
}

export async function sendTelegramPhoto(imageBuffer, caption = '') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (caption) formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('photo', blob, 'pelanggan_upload.jpg');

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (!data.ok) {
      console.warn('⚠️ Telegram sendPhoto error:', data.description);
      return false;
    }
    console.log('📤 Berhasil forward foto ke grup Telegram!');
    return true;
  } catch (err) {
    console.error('❌ Gagal forward foto ke Telegram:', err.message);
    return false;
  }
}
