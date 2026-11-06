/* BCA email parser.
   Turns one BCA notification email into a transaction:
   { amount, type: 'expense'|'income', merchant, ref }  or null when it is not a transaction.
   Kept free of app state so the Settings "Test parser" screen runs the exact same code. */
(function (global) {
  'use strict';

  // Labels BCA uses in front of the amount (Indonesian + English variants).
  var AMOUNT_LABELS = [
    'total\\s*transaction', 'total\\s*transaksi',
    'total\\s*(?:amount|bayar|pembayaran|transaksi|transfer)?',
    'nominal(?:\\s*transaksi|\\s*transfer)?',
    'jumlah(?:\\s*transfer|\\s*pembayaran|\\s*transaksi|\\s*dana)?',
    'top\\s*up\\s*amount', 'payment\\s*amount', 'amount', 'transfer\\s*amount', 'nilai\\s*transaksi'
  ];
  var CUR = '(?:rp\\.?|idr)';

  var INCOME_RE = /(transfer\s*masuk|dana\s*masuk|uang\s*masuk|menerima\s*(?:dana|transfer)|diterima\s*dari|telah\s*menerima|received\s*from|incoming\s*(?:transfer|fund)|you\s*have\s*received|refund|pengembalian\s*dana|cashback\s*masuk|kredit\s*ke\s*rekening)/i;
  var FAILED_RE = /(gagal|failed|ditolak|rejected|dibatalkan|cancelled|canceled|tidak\s*berhasil)/i;
  var NOISE_RE = /(kode\s*otp|one\s*time\s*password|\botp\b|aktivasi|registrasi|login\s*baru|perangkat\s*baru|ganti\s*(?:pin|password)|promo|penawaran|undian|newsletter|e-?statement|rekening\s*koran)/i;
  var TXN_HINT_RE = /(transaksi|transaction|transfer|pembayaran|payment|qris|purchase|pembelian|top\s*up|tarik\s*tunai|withdraw|debit|berhasil|successful|journal)/i;

  var MERCHANT_LABELS_OUT = [
    'nama\\s*merchant', 'merchant\\s*name', 'merchant', 'nama\\s*toko',
    'nama\\s*penerima', 'penerima', 'recipient\\s*name', 'recipient', 'destination\\s*name', 'beneficiary\\s*name', 'beneficiary', 'receiver\\s*name', 'receiver',
    'rekening\\s*tujuan', 'tujuan', 'pembayaran\\s*ke', 'payment\\s*to', 'transfer\\s*ke', 'transfer\\s*to',
    'nama\\s*pelanggan', 'company\\s*name', 'nama\\s*perusahaan', 'biller', 'keterangan', 'description', 'berita'
  ];
  var MERCHANT_LABELS_IN = [
    'nama\\s*pengirim', 'pengirim', 'sender\\s*name', 'sender', 'dari', 'from\\s*account\\s*name', 'remitter'
  ];
  // Which of my accounts the money left (or entered). BCA masks it, e.g. 6275****46.
  var SRC_LABELS = ['source\\s*of\\s*funds?', 'sumber\\s*dana', 'rekening\\s*sumber', 'from\\s*account', 'dari\\s*rekening', 'no\\.?\\s*rekening', 'account\\s*number'];
  var REF_LABELS = [
    'bi\\s*fast\\s*ref\\.?\\s*no\\.?', 
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
    return stripHtml(s).replace(/\*([A-Za-z][^*\n]{0,40})\*/g, '$1') // *Bold label* from plain-text emails
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
    // Mandiri style: label on one line, value on the next.
    for (var k = 0; k < labels.length; k++) {
      var re3 = new RegExp('(?:^|\\n)\\s*' + labels[k] + '\\s*\\n\\s*' + valueRe, 'i');
      var m3 = text.match(re3);
      if (m3 && m3[1] && m3[1].trim()) return m3[1].trim();
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

  var WHY = '';
  function parseBcaEmail(email) {
    WHY = '';
    email = email || {};
    var subject = normalize(email.subject || '');
    var body = normalize(email.body || '');
    var all = subject + '\n' + body;

    var card = /kartu\s*paspor|paspor\s*bca|terima\s*kasih\s*telah\s*bertransaksi/i.test(all); // card payment notices are always payments
    if (FAILED_RE.test(subject) || (!card && FAILED_RE.test(body) && !/berhasil|successful/i.test(body))) { WHY = 'looks like a failed payment'; return null; }
    if (NOISE_RE.test(subject) && !TXN_HINT_RE.test(subject)) { WHY = 'promo or security email'; return null; }
    if (!TXN_HINT_RE.test(all)) { WHY = 'no payment words'; return null; }

    // Foreign currency (card used abroad, e.g. Paspor BCA "Nominal : JPY 1.300"): the app converts to rupiah.
    var fx = body.match(/(?:nominal|amount|jumlah|total(?:\s*transaksi)?)\s*[:=]?\s*\n?\s*(JPY|USD|SGD|MYR|THB|KRW|CNY|HKD|TWD|AUD|EUR|GBP|CHF|SAR|AED)\s*((?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?)/i);
    var CODES = '(JPY|USD|SGD|MYR|THB|KRW|CNY|HKD|TWD|AUD|EUR|GBP|CHF|SAR|AED)', NUM = '((?:\\d{1,3}(?:[.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?)';
    if (!fx) fx = all.match(new RegExp(CODES + '\\s*' + NUM)); // currency code anywhere, e.g. "JPY 1.300"
    if (!fx) { var rev = all.match(new RegExp(NUM + '\\s*' + CODES)); if (rev) fx = [rev[0], rev[2], rev[1]]; } // "1.300 JPY"
    var cur = '', famt = 0;
    if (fx && !/^(idr|rp\.?)$/i.test(fx[1])) { cur = fx[1].toUpperCase(); var raw = fx[2], dm = raw.match(/[.,](\d{1,2})$/); famt = parseFloat(raw.replace(/[.,]\d{1,2}$/, '').replace(/[.,]/g, '') + (dm ? '.' + dm[1] : '')); }
    var amount = cur ? 0 : (findAmount(body) || findAmount(subject));
    if (!amount && !famt) { WHY = 'no amount found'; return null; }

    var type = INCOME_RE.test(all) ? 'income' : 'expense';
    var line = '([^\\n|;]{2,80})';
    var merchant = cleanName(firstMatch(body, type === 'income' ? MERCHANT_LABELS_IN : MERCHANT_LABELS_OUT, line));
    if (!merchant && type === 'income') merchant = cleanName(firstMatch(body, MERCHANT_LABELS_OUT, line));
    if (!merchant) merchant = cleanName(firstMatch(body, ['transaction\\s*type', 'jenis\\s*transaksi'], line));
    if (!merchant) merchant = subject.replace(/^(re|fw|fwd):\s*/i, '').slice(0, 60) || 'BCA';

    var ref = firstMatch(body, REF_LABELS, '([A-Za-z0-9\\-/]{4,40})');

    var src = firstMatch(body, SRC_LABELS, '([0-9][0-9*xX•\\-\\s]{5,24}[0-9])').replace(/[\s-]/g, '');
    var card = body.match(/(?:nomor|no\.?)\s*kartu\s*[:=]?\s*[xX*•]{2,}\s*(\d{4})/i); if (!src && card) src = '****' + card[1];
    var out = { amount: amount, type: type, merchant: merchant, ref: ref, src: src };
    if (cur) { out.cur = cur; out.famt = famt; }
    return out;
  }

  var api = { why: function () { return WHY; }, parseBcaEmail: parseBcaEmail, parseAmount: parseAmount, normalize: normalize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BcaParser = api;
})(this);
