/* BCA email parser.
   Turns one BCA notification email into a transaction:
   { amount, type: 'expense'|'income', merchant, ref }  or null when it is not a transaction.
   Kept free of app state so the Settings "Test parser" screen runs the exact same code. */
(function (global) {
  'use strict';

  // Labels BCA uses in front of the amount (Indonesian + English variants).
  var AMOUNT_LABELS = [
    'total\\s*(?:amount|bayar|pembayaran|transaksi|transfer)?',
    'nominal(?:\\s*transaksi|\\s*transfer)?',
    'jumlah(?:\\s*transfer|\\s*pembayaran|\\s*transaksi|\\s*dana)?',
    'amount', 'transfer\\s*amount', 'nilai\\s*transaksi'
  ];
  var CUR = '(?:rp\\.?|idr)';

  var INCOME_RE = /(transfer\s*masuk|dana\s*masuk|uang\s*masuk|menerima\s*(?:dana|transfer)|diterima\s*dari|telah\s*menerima|received\s*from|incoming\s*(?:transfer|fund)|you\s*have\s*received|refund|pengembalian\s*dana|cashback\s*masuk|kredit\s*ke\s*rekening)/i;
  var FAILED_RE = /(gagal|failed|ditolak|rejected|dibatalkan|cancelled|canceled|tidak\s*berhasil)/i;
  var NOISE_RE = /(kode\s*otp|one\s*time\s*password|\botp\b|aktivasi|registrasi|login\s*baru|perangkat\s*baru|ganti\s*(?:pin|password)|promo|penawaran|undian|newsletter|e-?statement|rekening\s*koran)/i;
  var TXN_HINT_RE = /(transaksi|transaction|transfer|pembayaran|payment|qris|purchase|pembelian|top\s*up|tarik\s*tunai|withdraw|debit|berhasil|successful|journal)/i;

  var MERCHANT_LABELS_OUT = [
    'nama\\s*merchant', 'merchant\\s*name', 'merchant', 'nama\\s*toko',
    'nama\\s*penerima', 'penerima', 'beneficiary\\s*name', 'beneficiary', 'receiver\\s*name', 'receiver',
    'rekening\\s*tujuan', 'tujuan', 'pembayaran\\s*ke', 'payment\\s*to', 'transfer\\s*ke', 'transfer\\s*to',
    'nama\\s*pelanggan', 'company\\s*name', 'nama\\s*perusahaan', 'biller', 'keterangan', 'description', 'berita'
  ];
  var MERCHANT_LABELS_IN = [
    'nama\\s*pengirim', 'pengirim', 'sender\\s*name', 'sender', 'dari', 'from\\s*account\\s*name', 'remitter'
  ];
  var REF_LABELS = [
    'no\\.?\\s*referensi', 'nomor\\s*referensi', 'reference\\s*(?:no\\.?|number)?', 'no\\.?\\s*ref\\.?',
    'ref\\.?\\s*no\\.?', 'no\\.?\\s*transaksi', 'transaction\\s*(?:id|no\\.?)'
  ];

  function stripHtml(s) {
    return String(s || '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
      .replace(/<\/t[dh]>/gi, ' : ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); });
  }

  function normalize(s) {
    return stripHtml(s)
      .replace(/\r/g, '')
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/ *: *(: *)+/g, ': ')       // collapse "Label : : value" from table cells
      .replace(/\n\s*\n+/g, '\n')
      .trim();
  }

  // "1.250.000,00" / "1,250,000.00" / "1250000" / "50.000" -> 1250000 / 50000
  function parseAmount(raw) {
    var s = String(raw || '').replace(/[^\d.,]/g, '');
    if (!s) return 0;
    s = s.replace(/[.,]\d{1,2}$/, '');        // IDR thousands groups are always 3 digits, so 1-2 trailing = cents
    s = s.replace(/[.,]/g, '');
    var n = parseInt(s, 10);
    return isFinite(n) ? n : 0;
  }

  function firstMatch(text, labels, valueRe) {
    for (var i = 0; i < labels.length; i++) {
      var re = new RegExp('(?:^|[\\n|;])\\s*' + labels[i] + '\\s*[:=]\\s*' + valueRe, 'i');
      var m = text.match(re);
      if (m && m[1] && m[1].trim()) return m[1].trim();
    }
    // Looser pass: label anywhere on a line (e.g. "Penerima: X" mid-sentence).
    for (var j = 0; j < labels.length; j++) {
      var re2 = new RegExp('\\b' + labels[j] + '\\s*[:=]\\s*' + valueRe, 'i');
      var m2 = text.match(re2);
      if (m2 && m2[1] && m2[1].trim()) return m2[1].trim();
    }
    return '';
  }

  function findAmount(text) {
    var num = '((?:\\d{1,3}(?:[.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?)';
    for (var i = 0; i < AMOUNT_LABELS.length; i++) {
      var re = new RegExp(AMOUNT_LABELS[i] + '\\s*[:=]?\\s*' + CUR + '?\\s*' + num, 'i');
      var m = text.match(re);
      if (m) { var a = parseAmount(m[1]); if (a > 0) return a; }
    }
    var any = text.match(new RegExp(CUR + '\\s*' + num, 'i'));
    return any ? parseAmount(any[1]) : 0;
  }

  function cleanName(s) {
    return String(s || '')
      .replace(/\s{2,}.*$/, '')
      .replace(/\b(?:rp\.?|idr)\b.*$/i, '')
      .replace(/^[\s:\-]+|[\s:\-.,]+$/g, '')
      .slice(0, 60);
  }

  function parseBcaEmail(email) {
    email = email || {};
    var subject = normalize(email.subject || '');
    var body = normalize(email.body || '');
    var all = subject + '\n' + body;

    if (FAILED_RE.test(subject) || (FAILED_RE.test(body) && !/berhasil|successful/i.test(body))) return null;
    if (NOISE_RE.test(subject) && !TXN_HINT_RE.test(subject)) return null;
    if (!TXN_HINT_RE.test(all)) return null;

    var amount = findAmount(body) || findAmount(subject);
    if (!amount) return null;

    var type = INCOME_RE.test(all) ? 'income' : 'expense';
    var line = '([^\\n|;]{2,80})';
    var merchant = cleanName(firstMatch(body, type === 'income' ? MERCHANT_LABELS_IN : MERCHANT_LABELS_OUT, line));
    if (!merchant && type === 'income') merchant = cleanName(firstMatch(body, MERCHANT_LABELS_OUT, line));
    if (!merchant) merchant = subject.replace(/^(re|fw|fwd):\s*/i, '').slice(0, 60) || 'BCA';

    var ref = firstMatch(body, REF_LABELS, '([A-Za-z0-9\\-/]{4,40})');

    return { amount: amount, type: type, merchant: merchant, ref: ref };
  }

  var api = { parseBcaEmail: parseBcaEmail, parseAmount: parseAmount, normalize: normalize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BcaParser = api;
})(this);
