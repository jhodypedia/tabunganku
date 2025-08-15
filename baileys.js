import baileys from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import dayjs from 'dayjs';
import { pool } from './db.js';
import dotenv from 'dotenv';
import { Boom } from '@hapi/boom';
dotenv.config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = baileys;

const ALLOWED = (process.env.ALLOWED_NUMBER || '').replace(/\D/g, '');
let sock;

/** Parse ".add 10k" -> 10000 */
function parseAmount(text) {
  const m = text.trim().match(/^\.add\s+(.+)$/i);
  if (!m) return 0;
  let s = m[1].toLowerCase().replace(/[\s.]/g, '');

  const unit =
    s.endsWith('k') || s.endsWith('rb') ? 'k' :
    s.endsWith('jt') || s.endsWith('m') ? 'm' : '';

  s = s.replace(/(k|rb|jt|m)$/i, '');
  s = s.replace(',', '.');

  let val = Number(s);
  if (Number.isNaN(val)) return 0;
  if (unit === 'k') val *= 1_000;
  if (unit === 'm') val *= 1_000_000;

  return Math.round(val);
}

/** Simpan transaksi (timestamp WIB) */
async function saveTopup(amount, from, raw) {
  const now = dayjs().utcOffset(7); // WIB
  await pool.query(
    `INSERT INTO savings (saved_at, amount, src, raw_text) VALUES (?,?,?,?)`,
    [now.format('YYYY-MM-DD HH:mm:ss'), amount, from, raw]
  );
}

export async function startBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // render sendiri agar stabil
    markOnlineOnConnect: false,
    syncFullHistory: false,
    browser: ['WhatsSavings', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.clear();
      console.log('📌 Scan QR berikut untuk login WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected.');
    }

    if (connection === 'close') {
      const statusCode =
        (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode;

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ WA closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => startBaileys().catch(console.error), 3000);
      } else {
        console.log('❌ Logged out. Hapus folder "auth/" lalu jalankan ulang untuk login.');
      }
    }
  });

  // Pesan masuk
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages?.[0];
      if (!msg?.message) return;
      if (msg.key?.remoteJid?.endsWith('@g.us')) return; // abaikan grup

      // siapkan pengirim
      const senderJid = msg.key.fromMe ? sock.user.id : msg.key.remoteJid;
      const msisdn = (senderJid || '').split('@')[0].replace(/\D/g, '');

      if (msisdn !== ALLOWED) return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        '';

      const amount = parseAmount(text || '');
      if (amount > 0) {
        await saveTopup(amount, msisdn, text);
        const rupiah = amount.toLocaleString('id-ID');
        await sock.sendMessage(senderJid, { text: `✅ Tercatat: Rp ${rupiah} (WIB)` });
      }
    } catch (err) {
      console.error('❌ Handler error:', err);
    }
  });

  return sock;
}
