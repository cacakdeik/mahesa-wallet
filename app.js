// ═══════════════════════════════════
// LOGIN (Supabase Auth)
// ═══════════════════════════════════

// Username → email mapping (Supabase Auth pakai email)
// Format email: username@dompetmahesa.app
function usernameToEmail(u) {
  return u.trim().toLowerCase() + '@dompetmahesa.app';
}

async function doLogin() {
  const u = (document.getElementById('loginUser').value||'').trim().toLowerCase();
  const p = (document.getElementById('loginPass').value||'').trim();
  const errEl = document.getElementById('loginError');
  const card = document.querySelector('.login-card');
  const btn = document.querySelector('.login-btn');

  if (!u || !p) {
    errEl.classList.add('show');
    setTimeout(()=>errEl.classList.remove('show'), 3000);
    return;
  }

  btn.textContent = 'Masuk...';
  btn.disabled = true;

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: usernameToEmail(u),
      password: p
    });

    if (error || !data.session) {
      errEl.classList.add('show');
      card.classList.remove('login-shake');
      void card.offsetWidth;
      card.classList.add('login-shake');
      document.getElementById('loginPass').value = '';
      setTimeout(()=>errEl.classList.remove('show'), 3000);
    } else {
      // Login berhasil
      document.getElementById('loginScreen').classList.remove('visible');
      document.getElementById('loginScreen').classList.add('hidden');
      await initApp();
    }
  } catch(err) {
    errEl.classList.add('show');
    setTimeout(()=>errEl.classList.remove('show'), 3000);
  } finally {
    btn.textContent = 'Masuk →';
    btn.disabled = false;
  }
}

async function doLogout() {
  await sb.auth.signOut();
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginScreen').classList.add('visible');
  // Reset data
  transaksi = [];
}

function toggleEye() {
  const inp = document.getElementById('loginPass');
  const btn = document.getElementById('eyeBtn');
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' width='18' height='18'><path d='M9.88 9.88a3 3 0 1 0 4.24 4.24'/><path d='M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68'/><path d='M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61'/><line x1='2' x2='22' y1='2' y2='22'/></svg>`;
  } else {
    inp.type = 'password';
    btn.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' width='18' height='18'><path d='M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z'/><circle cx='12' cy='12' r='3'/></svg>`;
  }
}

// ═══════════════════════════════════
// SUPABASE
// ═══════════════════════════════════
const sbUrl = "https://jhaubwkvvqyzogmwhxmo.supabase.co";
const sbKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoYXVid2t2dnF5em9nbXdoeG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzc5NjYsImV4cCI6MjA5NTgxMzk2Nn0.7PRY0wxN5ZQzXkLgVdnLGdVJyiiad5LIs3WGDbuzieM";
const sb = supabase.createClient(sbUrl, sbKey);

let transaksi = [];
let chartIns = null;
let isDark = false;
let currentRiwayatFilter = 'semua';
let selectedStatMonth = null; // null = all
let activePengeluaranType = null;

// ═══════════════════════════════════
// UTILS
// ═══════════════════════════════════
const rupiah = n => "Rp " + Number(n).toLocaleString('id-ID');
const setText = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };

function fmtNominal(el) {
  let raw = el.value.replace(/\./g,'').replace(/\D/g,'');
  if (!raw) { el.value=''; return; }
  el.value = Number(raw).toLocaleString('id-ID');
}
function getNominalFrom(id) {
  return Number((document.getElementById(id).value||'').replace(/\./g,'').replace(/\D/g,''));
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function currentMonthStr() {
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}

// ═══════════════════════════════════
// AUTO SALDO: Maybank +200rb tgl 27, BPJS +285rb tgl 15
// ═══════════════════════════════════
async function checkAutoSaldo() {
  const now = new Date();
  const today = now.getDate();
  const ym = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');

  // Cek apakah sudah ada auto entry bulan ini
  const autoKey = 'auto_'+ym;
  const done = JSON.parse(localStorage.getItem(autoKey)||'{}');

  if (today >= 27 && !done.maybank) {
    const tgl = ym+'-27';
    // cek duplikat
    const exists = transaksi.find(x=>x.jenis==='mahesa'&&x.tanggal===tgl&&x.kategori==='Auto Maybank');
    if (!exists) {
      await sb.from('transaksi').insert([{
        jenis:'mahesa', nominal:200000, tanggal:tgl,
        kategori:'Auto Maybank', catatan:'Setoran otomatis bulanan'
      }]);
      done.maybank = true;
      localStorage.setItem(autoKey, JSON.stringify(done));
    }
  }
  if (today >= 15 && !done.bpjs) {
    const tgl = ym+'-15';
    const exists = transaksi.find(x=>x.jenis==='bpjs'&&x.tanggal===tgl&&x.kategori==='Auto BPJS');
    if (!exists) {
      await sb.from('transaksi').insert([{
        jenis:'bpjs', nominal:285000, tanggal:tgl,
        kategori:'Auto BPJS', catatan:'Iuran otomatis bulanan'
      }]);
      done.bpjs = true;
      localStorage.setItem(autoKey, JSON.stringify(done));
    }
  }
}

// ═══════════════════════════════════
// LOAD DATA
// ═══════════════════════════════════
async function loadData() {
  const { data, error } = await sb.from('transaksi').select('*').order('tanggal',{ascending:true}).order('id',{ascending:true});
  if (error) { console.error(error); return; }
  transaksi = data || [];
  renderAll();
}

// ═══════════════════════════════════
// SIMPAN GAJI
// ═══════════════════════════════════
async function simpanGaji() {
  const nominal = getNominalFrom('nominal');
  if (!nominal || nominal <= 0) { alert('Masukkan nominal yang valid!'); return; }
  const tanggal = document.getElementById('tanggalGaji').value || todayStr();
  const periode = document.getElementById('periodeGaji').value || currentMonthStr();
  const catatan = document.getElementById('catatan').value.trim() || null;

  const payload = { jenis:'masuk', nominal, tanggal, kategori:'Gaji '+periode, catatan };
  const { error } = await sb.from('transaksi').insert([payload]);
  if (error) { alert('Gagal simpan: '+error.message); return; }

  document.getElementById('nominal').value='';
  document.getElementById('catatan').value='';
  closeAllSheets();
  await loadData();
  alert('Gaji berhasil disimpan!');
}

// ═══════════════════════════════════
// SIMPAN PENGELUARAN
// ═══════════════════════════════════
async function simpanPengeluaran() {
  const nominal = getNominalFrom('nominalPeng');
  if (!nominal || nominal <= 0) { alert('Masukkan nominal yang valid!'); return; }
  const tanggal = document.getElementById('tanggalPeng').value || todayStr();
  const catatan = document.getElementById('catatanPeng').value.trim() || null;
  let kategori = document.getElementById('kategoriPeng').value.trim();
  if (!kategori) kategori = activePengeluaranType||'Pengeluaran';

  let finalKategori = kategori;
  if (activePengeluaranType === 'transfer') {
    const tujuan = document.getElementById('tujuanTransfer').value.trim();
    finalKategori = 'Transfer'+(tujuan?' ke '+tujuan:'');
  }

  const payload = { jenis:'keluar', nominal, tanggal, kategori:finalKategori, catatan };
  const { error } = await sb.from('transaksi').insert([payload]);
  if (error) { alert('Gagal simpan: '+error.message); return; }

  document.getElementById('nominalPeng').value='';
  document.getElementById('catatanPeng').value='';
  document.getElementById('kategoriPeng').value='';
  document.getElementById('tujuanTransfer').value='';
  closeAllSheets();
  await loadData();
  alert('Pengeluaran berhasil disimpan!');
}

// ═══════════════════════════════════
// SIMPAN TABUNGAN
// ═══════════════════════════════════
async function simpanTabungan() {
  const nominal = getNominalFrom('nominalTab');
  if (!nominal || nominal <= 0) { alert('Masukkan nominal yang valid!'); return; }
  const tanggal = document.getElementById('tanggalTab').value || todayStr();
  const catatan = document.getElementById('catatanTab').value.trim() || null;

  const payload = { jenis:'tabungan', nominal, tanggal, kategori:'Tabungan', catatan };
  const { error } = await sb.from('transaksi').insert([payload]);
  if (error) { alert('Gagal simpan: '+error.message); return; }

  document.getElementById('nominalTab').value='';
  document.getElementById('catatanTab').value='';
  closeAllSheets();
  await loadData();
  alert('Tabungan berhasil disimpan!');
}

// ═══════════════════════════════════
// SIMPAN TRANSFER
// ═══════════════════════════════════
async function simpanTransfer() {
  const nominal = getNominalFrom('nominalTransfer');
  if (!nominal || nominal <= 0) { alert('Masukkan nominal yang valid!'); return; }
  const kategori = document.getElementById('kategoriTransfer').value.trim() || 'Transfer';
  const tanggal = document.getElementById('tanggalTransfer').value || todayStr();
  const catatan = document.getElementById('catatanTransfer').value.trim() || null;

  // jenis='keluar' agar saldo otomatis berkurang
  const payload = { jenis:'keluar', nominal, tanggal, kategori, catatan };
  const { error } = await sb.from('transaksi').insert([payload]);
  if (error) { alert('Gagal simpan: '+error.message); return; }

  document.getElementById('nominalTransfer').value='';
  document.getElementById('kategoriTransfer').value='';
  document.getElementById('catatanTransfer').value='';
  closeAllSheets();
  await loadData();
  alert('Transfer berhasil disimpan!');
}

// ═══════════════════════════════════
// RENDER
// ═══════════════════════════════════
const EMOJI = { masuk:'banknote', keluar:'trending-down', tabungan:'piggy-bank', bpjs:'shield', mahesa:'bank', transfer:'send-money' };
const JENIS_LABEL = { masuk:'Gaji', keluar:'Pengeluaran', tabungan:'Tabungan', bpjs:'BPJS', mahesa:'Maybank', transfer:'Transfer' };

function txHTML(x, showActions=false) {
  const ICON_SVG = {
    'banknote': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>`,
    'trending-down': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`,
    'piggy-bank': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2z"/><path d="M2 9v1a2 2 0 0 0 2 2h1"/><path d="M16 11h.01"/></svg>`,
    'shield': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
    'bank': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
    'send-money': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,
    'file-text': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`,
  };
  const iconSvg = ICON_SVG[EMOJI[x.jenis]] || ICON_SVG['file-text'];
  const isOut = ['keluar','tabungan','bpjs','mahesa','transfer'].includes(x.jenis);
  const cls = isOut ? 'red-text' : 'green-text';
  if (x.jenis==='bpjs'||x.jenis==='mahesa') { /* keep red for these */ }
  const sign = isOut ? '- ' : '+ ';
  const tgl = x.tanggal ? new Date(x.tanggal+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '-';
  const actionsHTML = showActions ? `
    <div class="tx-actions">
      <button class="tx-btn edit" onclick="openEdit(${x.id})" title="Edit"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' width='14' height='14'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg></button>
      <button class="tx-btn del" onclick="openDelete(${x.id})" title="Hapus"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' width='14' height='14'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg></button>
    </div>` : '';
  return `
    <div class="transaction">
      <div class="transaction-left">
        <div class="tx-icon" style="color:var(--text2);">${iconSvg}</div>
        <div style="min-width:0">
          <div class="tx-title">${x.kategori||JENIS_LABEL[x.jenis]||x.jenis}</div>
          <div class="tx-sub">${tgl}${x.catatan?' · '+x.catatan:''}</div>
        </div>
      </div>
      <div class="tx-amount ${cls}">${sign}${rupiah(x.nominal)}</div>
      ${actionsHTML}
    </div>`;
}

function setList(id, items, emptyIcon, emptyMsg, showActions=false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">${emptyIcon}</div><p>${emptyMsg}</p></div>`;
    return;
  }
  el.innerHTML = items.map(x=>txHTML(x, showActions)).join('');
}

function renderAll() {
  let masuk=0, keluar=0, tab=0, bpjs=0, bank=0, transfer=0;
  transaksi.forEach(x => {
    const n = Number(x.nominal);
    if (x.jenis==='masuk')    masuk += n;
    if (x.jenis==='keluar')   keluar+= n;
    if (x.jenis==='tabungan') tab   += n;
    if (x.jenis==='bpjs')     bpjs  += n;
    if (x.jenis==='mahesa')   bank  += n;
    if (x.jenis==='transfer') transfer += n;
  });
  const saldo = masuk - keluar - tab - transfer;

  setText('saldoAktif', rupiah(saldo));
  setText('totalMasuk', rupiah(masuk));
  setText('totalKeluar', rupiah(keluar));
  setText('totalTabunganHome', rupiah(tab));
  setText('saldoBpjsHome', rupiah(bpjs));
  setText('saldoMaybankHome', rupiah(bank));
  setText('saldoTabunganPage', rupiah(tab));
  setText('saldoBpjsPage', rupiah(bpjs));
  setText('saldoMaybankPage', rupiah(bank));
  setText('totalGajiPage', rupiah(masuk));

  // Home: 5 terbaru
  setList('homeHistory', [...transaksi].reverse().slice(0,5), '🌱','Belum ada transaksi', false);

  // Riwayat dengan filter + edit/hapus
  renderRiwayat();

  // Sub pages
  setList('listTabungan', transaksi.filter(x=>x.jenis==='tabungan').reverse(), '💰','Belum ada tabungan', true);
  setList('listBpjs', transaksi.filter(x=>x.jenis==='bpjs').reverse(), '🛡️','Belum ada riwayat BPJS', true);
  setList('listMaybank', transaksi.filter(x=>x.jenis==='mahesa').reverse(), '🏦','Belum ada riwayat Maybank', true);

  // Gaji page
  const gajiTx = transaksi.filter(x=>x.jenis==='masuk').reverse();
  const gajiEl = document.getElementById('gajiList');
  if (gajiEl) {
    if (!gajiTx.length) {
      gajiEl.innerHTML = '<div class="empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="36" height="36"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg></div><p>Belum ada riwayat gaji</p></div>';
    } else {
      gajiEl.innerHTML = gajiTx.map(x => {
        const tgl = x.tanggal ? new Date(x.tanggal+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-';
        return `<div class="gaji-item">
          <div><div class="gaji-period">${x.kategori||'Gaji'}</div><div class="gaji-date">${tgl}</div></div>
          <div style="text-align:right">
            <div class="gaji-amount">${rupiah(x.nominal)}</div>
            <div style="display:flex;gap:6px;margin-top:4px;justify-content:flex-end;">
              <button class="tx-btn edit" onclick="openEdit(${x.id})" title="Edit"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' width='14' height='14'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg></button>
              <button class="tx-btn del" onclick="openDelete(${x.id})" title="Hapus"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' width='14' height='14'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg></button>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Statistik
  renderStatistik();
}

function renderRiwayat() {
  let filtered = [...transaksi].reverse();
  if (currentRiwayatFilter !== 'semua') {
    filtered = filtered.filter(x => x.jenis === currentRiwayatFilter);
  }
  setList('riwayatList', filtered, '📄','Riwayat kosong', true);
}

function filterRiwayat(type) {
  currentRiwayatFilter = type;
  document.querySelectorAll('.tab-pill').forEach(t=>t.classList.remove('active'));
  const el = document.getElementById('tab-'+type);
  if (el) el.classList.add('active');
  renderRiwayat();
}
// ═══════════════════════════════════
function getMonthsFromData() {
  const months = new Set();
  transaksi.forEach(x => {
    if (x.tanggal) months.add(x.tanggal.substring(0,7));
  });
  return [...months].sort();
}

function renderStatistik() {
  const months = getMonthsFromData();
  // Build month filter buttons
  const mf = document.getElementById('monthFilter');
  if (mf) {
    const allBtn = `<button class="month-btn ${selectedStatMonth===null?'active':''}" onclick="setStatMonth(null)">Semua</button>`;
    const monthBtns = months.map(m => {
      const [y,mo] = m.split('-');
      const label = new Date(y,mo-1,1).toLocaleDateString('id-ID',{month:'short',year:'numeric'});
      return `<button class="month-btn ${selectedStatMonth===m?'active':''}" onclick="setStatMonth('${m}')">${label}</button>`;
    }).join('');
    mf.innerHTML = allBtn + monthBtns;
  }

  // Filter by selected month
  let data = transaksi;
  if (selectedStatMonth) {
    data = transaksi.filter(x => x.tanggal && x.tanggal.startsWith(selectedStatMonth));
  }

  let masuk=0,keluar=0,tab=0;
  data.forEach(x=>{
    const n=Number(x.nominal);
    if(x.jenis==='masuk') masuk+=n;
    if(x.jenis==='keluar') keluar+=n;
    if(x.jenis==='transfer') keluar+=n;
    if(x.jenis==='tabungan') tab+=n;
  });
  const saldo=masuk-keluar-tab;
  setText('statMasuk',rupiah(masuk));
  setText('statKeluar',rupiah(keluar));
  setText('statTabungan',rupiah(tab));
  setText('statSaldo',rupiah(saldo));

  // Build chart from real monthly data
  const allMonths = months.length ? months : [currentMonthStr()];
  const displayMonths = allMonths.slice(-6);
  const labels = displayMonths.map(m=>{
    const [y,mo]=m.split('-');
    return new Date(y,mo-1,1).toLocaleDateString('id-ID',{month:'short'});
  });
  const dataMasuk = displayMonths.map(m=>transaksi.filter(x=>x.jenis==='masuk'&&x.tanggal&&x.tanggal.startsWith(m)).reduce((a,x)=>a+Number(x.nominal),0));
  const dataKeluar = displayMonths.map(m=>transaksi.filter(x=>x.jenis==='keluar'&&x.tanggal&&x.tanggal.startsWith(m)).reduce((a,x)=>a+Number(x.nominal),0));
  const dataTab = displayMonths.map(m=>transaksi.filter(x=>x.jenis==='tabungan'&&x.tanggal&&x.tanggal.startsWith(m)).reduce((a,x)=>a+Number(x.nominal),0));

  renderChart(labels, dataMasuk, dataKeluar, dataTab);
}

function setStatMonth(m) {
  selectedStatMonth = m;
  renderStatistik();
}

// ═══════════════════════════════════
// CHART
// ═══════════════════════════════════
function renderChart(labels, dataMasuk, dataKeluar, dataTab) {
  const ctx = document.getElementById('financeChart');
  if (!ctx) return;
  if (chartIns) chartIns.destroy();
  const textColor = isDark ? '#71717a' : '#64748b';
  const gridColor = isDark ? '#27272a' : '#f1f5f9';
  chartIns = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        {label:'Gaji',data:dataMasuk,backgroundColor:'#22c55e',borderRadius:7},
        {label:'Pengeluaran',data:dataKeluar,backgroundColor:'#f87171',borderRadius:7},
        {label:'Tabungan',data:dataTab,backgroundColor:'#60a5fa',borderRadius:7}
      ]
    },
    options:{
      plugins:{legend:{display:true,position:'bottom',labels:{color:textColor,boxRadius:5,font:{size:11}}}},
      responsive:true,
      scales:{
        x:{ticks:{color:textColor,font:{size:11}},grid:{color:gridColor}},
        y:{ticks:{color:textColor,font:{size:10},callback:v=>'Rp '+Number(v/1000).toLocaleString('id-ID')+'rb'},grid:{color:gridColor}}
      }
    }
  });
}

// ═══════════════════════════════════
// EDIT & HAPUS
// ═══════════════════════════════════
function openEdit(id) {
  const x = transaksi.find(t=>t.id===id);
  if (!x) return;
  document.getElementById('editId').value = id;
  document.getElementById('editNominal').value = Number(x.nominal).toLocaleString('id-ID');
  document.getElementById('editKategori').value = x.kategori||'';
  document.getElementById('editTanggal').value = x.tanggal||'';
  document.getElementById('editCatatan').value = x.catatan||'';
  document.getElementById('editModal').classList.add('show');
}
function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
}
async function simpanEdit() {
  const id = Number(document.getElementById('editId').value);
  const nominal = getNominalFrom('editNominal');
  if (!nominal || nominal<=0) { alert('⚠️ Nominal tidak valid!'); return; }
  const kategori = document.getElementById('editKategori').value.trim();
  const tanggal = document.getElementById('editTanggal').value || todayStr();
  const catatan = document.getElementById('editCatatan').value.trim()||null;

  const {error} = await sb.from('transaksi').update({nominal,kategori,tanggal,catatan}).eq('id',id);
  if (error) { alert('Gagal update: '+error.message); return; }
  closeEditModal();
  await loadData();
  alert('Transaksi berhasil diupdate!');
}

function openDelete(id) {
  document.getElementById('deleteId').value = id;
  document.getElementById('deleteModal').classList.add('show');
}
function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('show');
}
async function konfirmasiHapusTx() {
  const id = Number(document.getElementById('deleteId').value);
  const {error} = await sb.from('transaksi').delete().eq('id',id);
  if (error) { alert('Gagal hapus: '+error.message); return; }
  closeDeleteModal();
  await loadData();
}

// ═══════════════════════════════════
// NAVIGASI
// ═══════════════════════════════════
const mainNavPages = ['home','statistik','riwayat','setting'];

function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById(id);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const navEl = document.getElementById('nav-'+id);
  if (navEl) navEl.classList.add('active');
  window.scrollTo(0,0);
  if (id === 'strategiPage') initStrategi();
  if (id === 'kencanPage') loadKencan();
  if (id === 'catatanAnakPage') { loadAnakData().then(() => renderAnakPage()); }
}

// ═══════════════════════════════════
// SHEET CONTROL
// ═══════════════════════════════════
let fabMenuOpen = false;

function toggleFabMenu() {
  fabMenuOpen = !fabMenuOpen;
  document.getElementById('fabMenu').classList.toggle('show', fabMenuOpen);
  document.getElementById('fabBackdrop').classList.toggle('show', fabMenuOpen);
  // Rotate FAB icon
  document.getElementById('fabBtn').style.transform = fabMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)';
  document.getElementById('fabBtn').style.transition = 'transform .2s ease';
}

function closeFabMenu() {
  fabMenuOpen = false;
  document.getElementById('fabMenu').classList.remove('show');
  document.getElementById('fabBackdrop').classList.remove('show');
  document.getElementById('fabBtn').style.transform = 'rotate(0deg)';
}

function openGajiFromFab() {
  closeFabMenu();
  document.getElementById('tanggalGaji').value = todayStr();
  document.getElementById('periodeGaji').value = currentMonthStr();
  document.getElementById('addSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function openLainnyaFromFab() {
  closeFabMenu();
  document.getElementById('tanggalLainnya').value = todayStr();
  document.getElementById('kategoriLainnya').value = '';
  document.getElementById('nominalLainnya').value = '';
  document.getElementById('catatanLainnya').value = '';
  document.getElementById('lainnyaSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

async function simpanLainnya() {
  const nominal = getNominalFrom('nominalLainnya');
  if (!nominal || nominal <= 0) { alert('Masukkan nominal yang valid!'); return; }
  const kategori = document.getElementById('kategoriLainnya').value.trim() || 'Pemasukan Lainnya';
  const tanggal = document.getElementById('tanggalLainnya').value || todayStr();
  const catatan = document.getElementById('catatanLainnya').value.trim() || null;

  const payload = { jenis:'masuk', nominal, tanggal, kategori, catatan };
  const { error } = await sb.from('transaksi').insert([payload]);
  if (error) { alert('Gagal simpan: '+error.message); return; }

  document.getElementById('nominalLainnya').value = '';
  document.getElementById('kategoriLainnya').value = '';
  document.getElementById('catatanLainnya').value = '';
  closeAllSheets();
  await loadData();
  showPage('home');
  alert('Pemasukan berhasil disimpan!');
}

function openTabunganFromFab() {
  closeFabMenu();
  document.getElementById('tanggalTab').value = todayStr();
  document.getElementById('tabunganSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

// kept for backward compat
function openSheet() { toggleFabMenu(); }

function openPengeluaranSheet() {
  hidePengeluaranMenu();
  activePengeluaranType = null;
  document.querySelectorAll('.peng-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('formPengeluaran').style.display='none';
  document.getElementById('tanggalPeng').value = todayStr();
  document.getElementById('pengeluaranSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function openTransferSheet() {
  hidePengeluaranMenu();
  document.getElementById('tanggalTransfer').value = todayStr();
  document.getElementById('transferSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function openTabunganSheet() {
  hidePengeluaranMenu();
  document.getElementById('tanggalTab').value = todayStr();
  document.getElementById('tabunganSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function closeAllSheets() {
  ['addSheet','lainnyaSheet','pengeluaranSheet','tabunganSheet','transferSheet','hutangSheet','anakProfilSheet','anakCatatSheet'].forEach(id=>{
    document.getElementById(id).classList.remove('show');
  });
  document.getElementById('overlay').classList.remove('show');
  hidePengeluaranMenu();
  closeFabMenu();
}

// ═══════════════════════════════════
// PENGELUARAN MENU
// ═══════════════════════════════════
let pengeluaranMenuOpen = false;
function togglePengeluaranMenu() {
  pengeluaranMenuOpen = !pengeluaranMenuOpen;
  document.getElementById('pengeluaranMenu').style.display = pengeluaranMenuOpen ? 'block' : 'none';
}
function hidePengeluaranMenu() {
  pengeluaranMenuOpen = false;
  document.getElementById('pengeluaranMenu').style.display = 'none';
}

function pilihPengeluaran(type) {
  activePengeluaranType = type;
  document.querySelectorAll('.peng-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('pc-'+type).classList.add('selected');
  const form = document.getElementById('formPengeluaran');
  form.style.display='block';

  const isTransfer = type==='transfer';
  document.getElementById('fieldTujuanTransfer').style.display = isTransfer?'block':'none';
  document.getElementById('labelKategoriPeng').innerText = isTransfer?'Nama Transfer':'Kategori';
  document.getElementById('kategoriPeng').placeholder = isTransfer?'Opsional':'misal: Bensin, Listrik...';
}

// ═══════════════════════════════════
// STRATEGI KEUANGAN
// ═══════════════════════════════════
function initStrategi() {
  hitungStrategi();
}

function hitungStrategi() {
  // Get data otomatis
  let masuk=0, keluar=0, tab=0;
  const bulanIni = currentMonthStr();
  transaksi.forEach(x => {
    const n = Number(x.nominal);
    const bln = (x.tanggal||'').slice(0,7);
    if (x.jenis==='masuk') masuk += n;
    if (x.jenis==='keluar') keluar += n;
    if (x.jenis==='tabungan') tab += n;
    if (x.jenis==='transfer') keluar += n; // treat as outgoing
  });
  const saldoAktif = masuk - keluar - tab;

  // Keluar & tabungan bulan ini
  let keluarBulanIni=0, tabBulanIni=0;
  transaksi.forEach(x=>{
    const n=Number(x.nominal);
    const bln=(x.tanggal||'').slice(0,7);
    if(bln===bulanIni && (x.jenis==='keluar'||x.jenis==='transfer')) keluarBulanIni+=n;
    if(bln===bulanIni && x.jenis==='tabungan') tabBulanIni+=n;
  });

  // Update info box
  setText('skInfoSaldo', rupiah(saldoAktif));
  setText('skInfoKeluar', rupiah(keluarBulanIni));
  setText('skInfoTabungan', rupiah(tabBulanIni));

  // Tanggal target
  const today = new Date(); today.setHours(0,0,0,0);
  const lastDay = new Date(today.getFullYear(), today.getMonth()+1, 0);
  const sisaHari = Math.max(1, Math.ceil((lastDay - today) / 86400000));
  const targetLabel = lastDay.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});

  // Dana cadangan
  const cadangan = 0;

  // Total wajib

  // Dana siap pakai
  const danaSiap = Math.max(0, saldoAktif - cadangan);
  const budgetHarian = sisaHari > 0 ? Math.floor(danaSiap / sisaHari) : 0;

  // Slider value
  const sliderVal = parseInt(document.getElementById('skSlider')?.value || '30000');
  const prediksiSisa = danaSiap - (sliderVal * sisaHari);

  // Update kartu analisa
  setText('skDanaSiap', rupiah(danaSiap));
  setText('skSisaHari', sisaHari + ' Hari');
  setText('skBudgetHarian', rupiah(budgetHarian) + ' / hari');
  setText('skPrediksiSisa', rupiah(danaSiap - (sliderVal * sisaHari)));

  // Update warna dana siap
  const danaSiapEl = document.getElementById('skDanaSiap');
  if (danaSiapEl) {
    danaSiapEl.className = 'sk-card-val ' + (danaSiap>0?'aman':'bahaya');
  }

  // Update hero
  setText('skBolehPakai', rupiah(budgetHarian));
  setText('skKeteranganHero', `Agar saldo tetap cukup hingga ${targetLabel}`);

  // Status
  const ratio = danaSiap > 0 ? sliderVal / budgetHarian : 999;
  let statusClass, statusIcon, statusText, statusSub;
  if (danaSiap <= 0 || ratio >= 1.2) {
    statusClass='bahaya'; statusIcon='Bahaya';
    statusText='Saldo diperkirakan habis sebelum tanggal target.';
  } else if (ratio >= 0.85) {
    statusClass='waspada'; statusIcon='Waspada';
    statusText='Pengeluaran harus lebih terkontrol.';
  } else {
    statusClass='aman'; statusIcon='Aman';
    statusText='Budget harian masih longgar.';
  }

  const statusBar = document.getElementById('skStatusBar');
  if (statusBar) {
    statusBar.className = 'sk-status-bar ' + statusClass;
    setText('skStatusText', statusIcon);
    setText('skStatusSub', statusText);
  }
  const badge = document.getElementById('skStatusBadge');
  if (badge) badge.textContent = statusIcon;

  // Update prediksi sisa warna
  const predEl = document.getElementById('skPrediksiSisa');
  if (predEl) {
    const sisa = danaSiap - (sliderVal * sisaHari);
    predEl.className = 'sk-card-val ' + (sisa>=0?'aman':'bahaya');
  }

  // Simulasi grid (4 scenarios around slider value)
  renderSimulasi(danaSiap, sisaHari, sliderVal, budgetHarian);
}

function updateSlider() {
  const val = parseInt(document.getElementById('skSlider').value);
  const el = document.getElementById('skSliderVal');
  if (el) el.textContent = rupiah(val);
  hitungStrategi();
}

function renderSimulasi(danaSiap, sisaHari, sliderVal, budgetHarian) {
  const el = document.getElementById('skSimGrid');
  if (!el) return;

  // Generate 4 representative values
  const vals = [
    Math.max(5000, Math.floor(budgetHarian * 0.5 / 5000)*5000),
    Math.max(5000, Math.floor(budgetHarian * 0.8 / 5000)*5000),
    Math.max(5000, Math.floor(budgetHarian / 5000)*5000),
    Math.max(5000, Math.floor(budgetHarian * 1.3 / 5000)*5000),
  ];
  // Remove duplicates
  const uniq = [...new Set(vals)];

  el.innerHTML = uniq.map(daily => {
    const sisa = danaSiap - (daily * sisaHari);
    let cls = sisa >= 0 ? (sisa > danaSiap*0.3 ? 'aman' : 'waspada') : 'bahaya';
    const isActive = Math.abs(daily - sliderVal) < 5001;
    const label = sisa >= 0 ? rupiah(sisa) : '− '+rupiah(Math.abs(sisa))+' (defisit)';
    return `<div class="sk-sim-row${isActive?' active-sim':''}">
      <div class="sk-sim-indicator ${cls}"></div>
      <div class="sk-sim-daily">${rupiah(daily)}/hari</div>
      <div class="sk-sim-sisa ${cls}">${label}</div>
    </div>`;
  }).join('');
}


// ═══════════════════════════════════
// KENCAN
// ═══════════════════════════════════
let kencanNotes = []; // [{id, tanggal, catatan, emoji}]
let kencanYear = new Date().getFullYear();
let kencanMonth = new Date().getMonth(); // 0-indexed
let kencanSelectedDate = null;

const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

async function loadKencan() {
  const { data, error } = await sb.from('kencan').select('*').order('tanggal', {ascending:false});
  if (error) { console.error('Kencan load error:', error); return; }
  kencanNotes = data || [];
  renderKencanKalender();
  renderKencanHistory();
}

function renderKencanKalender() {
  const label = `${BULAN_ID[kencanMonth]} ${kencanYear}`;
  document.getElementById('kencanMonthTitle').textContent = label;
  document.getElementById('kencanMonthLabel').textContent = label;

  const firstDay = new Date(kencanYear, kencanMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(kencanYear, kencanMonth+1, 0).getDate();
  const daysInPrev = new Date(kencanYear, kencanMonth, 0).getDate();
  const today = new Date();
  const todayStr2 = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Set bulan mana punya note
  const noteSet = new Set(kencanNotes.map(n => n.tanggal));

  let html = '';
  // Prev month empty cells
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrev - firstDay + 1 + i;
    html += `<div class="kc-day empty other-month"><span class="kc-num">${d}</span></div>`;
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${kencanYear}-${String(kencanMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = new Date(kencanYear, kencanMonth, d).getDay();
    const isSun = dow === 0, isSat = dow === 6;
    const isToday = dateStr === todayStr2;
    const isSelected = dateStr === kencanSelectedDate;
    const hasNote = noteSet.has(dateStr);
    const cls = [
      'kc-day',
      isSun ? 'sunday' : '',
      isSat ? 'saturday' : '',
      isToday ? 'today' : '',
      isSelected ? 'selected' : '',
      hasNote ? 'has-note' : ''
    ].filter(Boolean).join(' ');
    html += `<div class="${cls}" onclick="kencanSelectDate('${dateStr}')"><span class="kc-num">${d}</span></div>`;
  }
  // Next month empty
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="kc-day empty other-month"><span class="kc-num">${i}</span></div>`;
  }

  document.getElementById('kencanGrid').innerHTML = html;
}

function kencanSelectDate(dateStr) {
  kencanSelectedDate = dateStr;
  renderKencanKalender();

  // Tampilkan panel catatan
  const panel = document.getElementById('kencanNotePanel');
  panel.style.display = 'block';

  const [y, m, d] = dateStr.split('-');
  const tglFormatted = `${parseInt(d)} ${BULAN_ID[parseInt(m)-1]} ${y}`;
  document.getElementById('kencanSelectedLabel').textContent = tglFormatted;

  // Cek catatan di tanggal ini
  const notesOnDate = kencanNotes.filter(n => n.tanggal === dateStr);
  const sub = notesOnDate.length ? `${notesOnDate.length} catatan` : 'Belum ada catatan';
  document.getElementById('kencanSelectedSub').textContent = sub;

  // Render catatan yg sudah ada
  const content = document.getElementById('kencanNoteContent');
  if (notesOnDate.length) {
    content.innerHTML = notesOnDate.map(n => `
      <div class="kc-note-item" id="kni-${n.id}">
        <div class="kc-note-emoji">${n.emoji || '💑'}</div>
        <div style="flex:1;min-width:0">
          <div class="kc-note-txt">${n.catatan}</div>
        </div>
        <div class="kc-note-actions">
          <button class="kc-note-del" onclick="kencanHapusNote(${n.id})"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' width='14' height='14'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg></button>
        </div>
      </div>`).join('');
  } else {
    content.innerHTML = '';
  }

  // Reset form
  document.getElementById('kencanNotaInput').value = '';
  document.getElementById('kencanEmoji').value = '💑';

  // Scroll ke panel
  setTimeout(() => panel.scrollIntoView({behavior:'smooth', block:'nearest'}), 100);
}

function kencanTutupNote() {
  kencanSelectedDate = null;
  document.getElementById('kencanNotePanel').style.display = 'none';
  renderKencanKalender();
}

async function kencanSimpan() {
  if (!kencanSelectedDate) return;
  const catatan = document.getElementById('kencanNotaInput').value.trim();
  if (!catatan) { alert('Tulis dulu catatannya!'); return; }
  const emoji = document.getElementById('kencanEmoji').value;

  const { data, error } = await sb.from('kencan').insert([{tanggal: kencanSelectedDate, catatan, emoji}]).select();
  if (error) { alert('Gagal simpan: ' + error.message); return; }

  await loadKencan();
  // Re-select date to refresh panel
  kencanSelectDate(kencanSelectedDate);
}

async function kencanHapusNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  const { error } = await sb.from('kencan').delete().eq('id', id);
  if (error) { alert('❌ Gagal hapus: ' + error.message); return; }
  await loadKencan();
  if (kencanSelectedDate) kencanSelectDate(kencanSelectedDate);
}

function renderKencanHistory() {
  const el = document.getElementById('kencanHistoryList');
  if (!kencanNotes.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">💑</div><p>Belum ada catatan kencan</p></div>';
    return;
  }
  const recent = kencanNotes.slice(0, 8);
  el.innerHTML = recent.map(n => {
    const [y, m, d] = n.tanggal.split('-');
    const tgl = `${parseInt(d)} ${BULAN_ID[parseInt(m)-1]} ${y}`;
    return `
      <div class="kc-note-item">
        <div class="kc-note-emoji">${n.emoji || '💑'}</div>
        <div style="flex:1;min-width:0">
          <div class="kc-note-tgl">${tgl}</div>
          <div class="kc-note-txt">${n.catatan}</div>
        </div>
        <div class="kc-note-actions">
          <button class="kc-note-del" onclick="kencanHapusNote(${n.id})"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' width='14' height='14'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg></button>
        </div>
      </div>`;
  }).join('');
}

function kencanPrevMonth() {
  kencanMonth--;
  if (kencanMonth < 0) { kencanMonth = 11; kencanYear--; }
  kencanSelectedDate = null;
  document.getElementById('kencanNotePanel').style.display = 'none';
  renderKencanKalender();
}

function kencanNextMonth() {
  kencanMonth++;
  if (kencanMonth > 11) { kencanMonth = 0; kencanYear++; }
  kencanSelectedDate = null;
  document.getElementById('kencanNotePanel').style.display = 'none';
  renderKencanKalender();
}

// ═══════════════════════════════════
// DARK MODE
// ═══════════════════════════════════
function toggleDark() {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  document.getElementById('darkToggle').classList.toggle('on', isDark);
  localStorage.setItem('dm', isDark?'1':'0');
  renderStatistik();
}

// ═══════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════
function exportCSV() {
  if (!transaksi.length) { alert('Tidak ada data untuk diekspor.'); return; }
  let csv = 'Tanggal,Jenis,Kategori,Nominal,Catatan\n';
  transaksi.forEach(x => {
    csv += `"${x.tanggal||''}","${JENIS_LABEL[x.jenis]||x.jenis}","${x.kategori||''}","${x.nominal}","${x.catatan||''}"\n`;
  });
  const blob = new Blob(["\uFEFF"+csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='dompet_mahesa.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════
// EXPORT PDF — simpan langsung (download)
// ═══════════════════════════════════
function exportPDF() {
  if (!transaksi.length) { alert('Tidak ada data untuk diekspor.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });

  const now = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  let masuk=0,keluar=0,tab=0,bpjs=0,bank=0;
  transaksi.forEach(x=>{
    const n=Number(x.nominal);
    if(x.jenis==='masuk')masuk+=n;
    if(x.jenis==='keluar')keluar+=n;
    if(x.jenis==='tabungan')tab+=n;
    if(x.jenis==='bpjs')bpjs+=n;
    if(x.jenis==='mahesa')bank+=n;
  });
  const saldo=masuk-keluar-tab;

  // Header
  doc.setFillColor(22,163,74);
  doc.rect(0,0,210,28,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16); doc.setFont(undefined,'bold');
  doc.text('Laporan Dompet Mahesa',14,12);
  doc.setFontSize(9); doc.setFont(undefined,'normal');
  doc.text('Dicetak: '+now+' · '+transaksi.length+' transaksi',14,20);

  // Summary
  doc.setTextColor(30,41,59);
  doc.setFontSize(10); doc.setFont(undefined,'bold');
  doc.text('Ringkasan',14,36);
  const sumData = [
    ['Gaji/Pemasukan', rupiah(masuk)],
    ['Pengeluaran', rupiah(keluar)],
    ['Tabungan', rupiah(tab)],
    ['Saldo BPJS', rupiah(bpjs)],
    ['Saldo Maybank', rupiah(bank)],
    ['Saldo Bersih', rupiah(saldo)]
  ];
  doc.autoTable({
    startY:40, body:sumData, theme:'plain',
    styles:{fontSize:9,cellPadding:2},
    columnStyles:{0:{fontStyle:'bold',cellWidth:55},1:{halign:'right'}},
    margin:{left:14,right:14}
  });

  // Transaksi table
  const yAfterSum = doc.lastAutoTable.finalY+6;
  doc.setFontSize(10); doc.setFont(undefined,'bold');
  doc.text('Detail Transaksi',14,yAfterSum);
  const rows = transaksi.map(x=>{
    const tgl = x.tanggal ? new Date(x.tanggal+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '-';
    const isOut = ['keluar','tabungan','bpjs','mahesa'].includes(x.jenis);
    return [tgl, JENIS_LABEL[x.jenis]||x.jenis, x.kategori||'-', (isOut?'-':'+')+''+rupiah(x.nominal), x.catatan||'-'];
  });
  doc.autoTable({
    startY:yAfterSum+4,
    head:[['Tanggal','Jenis','Kategori','Nominal','Catatan']],
    body:rows,
    theme:'striped',
    headStyles:{fillColor:[22,163,74],textColor:255,fontSize:8,fontStyle:'bold'},
    bodyStyles:{fontSize:8,cellPadding:2},
    columnStyles:{3:{halign:'right'},0:{cellWidth:28},1:{cellWidth:24},2:{cellWidth:32},4:{cellWidth:38}},
    margin:{left:14,right:14}
  });

  doc.save('laporan_dompet_mahesa.pdf');
}

// ═══════════════════════════════════
// BACKUP
// ═══════════════════════════════════
async function backupData() {
  await loadData();
  alert('Data berhasil disinkronisasi!');
}

// ═══════════════════════════════════
// HAPUS SEMUA
// ═══════════════════════════════════
async function confirmHapus() {
  if (!confirm('Yakin ingin menghapus SEMUA transaksi? Tindakan ini tidak bisa dibatalkan!')) return;
  const { error } = await sb.from('transaksi').delete().neq('id',0);
  if (error) { alert('Gagal hapus: '+error.message); return; }
  transaksi = [];
  renderAll();
  alert('Semua data berhasil dihapus.');
}

// ═══════════════════════════════════
// SIMULASI HUTANG
// Supabase table: simulasi_hutang
// Kolom: id (int8 PK), nama (text), cicilan (int8), total_hutang (int8), catatan (text), created_at (timestamptz)
// SQL:
// create table simulasi_hutang (
//   id bigint generated by default as identity primary key,
//   nama text not null,
//   cicilan bigint not null,
//   total_hutang bigint default 0,
//   catatan text default '',
//   created_at timestamptz default now()
// );
// ═══════════════════════════════════

let hutangList = [];

async function loadHutang() {
  const { data, error } = await sb.from('simulasi_hutang').select('*').order('created_at', { ascending: true });
  if (error) { console.error('Hutang load error:', error.message); return; }
  hutangList = data || [];
  renderHutang();
}

function openHutangSheet() {
  document.getElementById('hutangNama').value = '';
  document.getElementById('hutangCicilan').value = '';
  document.getElementById('hutangTotal').value = '';
  document.getElementById('hutangCatatan').value = '';
  document.getElementById('hutangSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function closeHutangSheet() {
  document.getElementById('hutangSheet').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
}

async function simpanHutang() {
  const nama = (document.getElementById('hutangNama').value || '').trim();
  const cicilan = getNominalFrom('hutangCicilan');
  const totalHutang = getNominalFrom('hutangTotal');
  const catatan = (document.getElementById('hutangCatatan').value || '').trim();

  if (!nama) { alert('Nama hutang wajib diisi!'); return; }
  if (!cicilan) { alert('Cicilan per bulan wajib diisi!'); return; }

  const { error } = await sb.from('simulasi_hutang').insert([{
    nama, cicilan, total_hutang: totalHutang, catatan
  }]);
  if (error) { alert('Gagal simpan: ' + error.message); return; }

  closeHutangSheet();
  await loadHutang();
}

async function hapusHutang(id) {
  if (!confirm('Hapus hutang ini?')) return;
  const { error } = await sb.from('simulasi_hutang').delete().eq('id', id);
  if (error) { alert('Gagal hapus: ' + error.message); return; }
  await loadHutang();
}

function hitungSimulasi() {
  const gajiRaw = (document.getElementById('simGaji').value || '').replace(/\./g, '').replace(/\D/g, '');
  const gaji = Number(gajiRaw) || 0;
  const totalCicilan = hutangList.reduce((s, h) => s + Number(h.cicilan), 0);
  const sisa = gaji - totalCicilan;
  const rasio = gaji > 0 ? Math.round((totalCicilan / gaji) * 100) : 0;

  // Hero
  document.getElementById('hutangSisaGaji').innerText = rupiah(sisa);
  document.getElementById('hutangSisaSub').innerText = gaji > 0
    ? `Dari gaji ${rupiah(gaji)}, dipotong ${rupiah(totalCicilan)} cicilan`
    : 'Masukkan gaji dan daftar hutang untuk simulasi';

  // Kartu ringkasan
  setText('hutangTotalGaji', rupiah(gaji));
  setText('hutangTotalCicilan', rupiah(totalCicilan));
  setText('hutangSisaBersih', rupiah(sisa));

  const rasioEl = document.getElementById('hutangRasio');
  rasioEl.innerText = rasio + '%';
  rasioEl.className = 'hutang-card-val ' + (rasio <= 30 ? 'aman' : rasio <= 50 ? 'waspada' : 'bahaya');

  // Progress bar
  const pct = Math.min(rasio, 100);
  const bar = document.getElementById('hutangProgressBar');
  const barClass = rasio <= 30 ? 'aman' : rasio <= 50 ? 'waspada' : 'bahaya';
  bar.style.width = pct + '%';
  bar.className = 'progress-bar-fill ' + barClass;
  document.getElementById('hutangProgressLabel').innerText = rasio + '% dari gaji';

  // Status bar
  const sb_el = document.getElementById('hutangStatusBar');
  const stText = document.getElementById('hutangStatusText');
  const stSub = document.getElementById('hutangStatusSub');
  const badge = document.getElementById('hutangBadge');
  sb_el.className = 'hutang-status-bar ' + (rasio <= 30 ? 'aman' : rasio <= 50 ? 'waspada' : 'bahaya');

  if (gaji === 0) {
    stText.innerText = '⏳ Belum dihitung';
    stSub.innerText = 'Masukkan nominal gaji terlebih dahulu.';
    badge.innerText = '⏳ Belum dihitung';
  } else if (rasio <= 30) {
    stText.innerText = '🟢 Keuangan Aman';
    stSub.innerText = `Cicilan ${rasio}% dari gaji. Di bawah batas ideal 30%.`;
    badge.innerText = `✅ Rasio ${rasio}% — Aman`;
  } else if (rasio <= 50) {
    stText.innerText = '🟡 Perlu Waspada';
    stSub.innerText = `Cicilan ${rasio}% dari gaji. Cukup berat, kurangi pengeluaran lain.`;
    badge.innerText = `⚠️ Rasio ${rasio}% — Waspada`;
  } else {
    stText.innerText = '🔴 Beban Berat';
    stSub.innerText = `Cicilan ${rasio}% dari gaji! Pertimbangkan restrukturisasi hutang.`;
    badge.innerText = `❗ Rasio ${rasio}% — Bahaya`;
  }

  // Sisacard color
  const sisaBersihEl = document.getElementById('hutangSisaBersih');
  sisaBersihEl.className = 'hutang-card-val ' + (sisa >= 0 ? 'aman' : 'bahaya');

  // Akumulasi 1 bulan
  renderAkumulasi(gaji, totalCicilan, sisa);
}

function renderAkumulasi(gaji, totalCicilan, sisa) {
  const el = document.getElementById('hutangAkumulasi');
  if (gaji === 0 && hutangList.length === 0) {
    el.innerHTML = '<div class="empty"><p style="font-size:12px;">Masukkan gaji dan hutang untuk melihat akumulasi.</p></div>';
    return;
  }
  const rows = [
    { label: 'Gaji Masuk', val: rupiah(gaji), color: '#16a34a' },
    { label: 'Total Cicilan Keluar', val: '−' + rupiah(totalCicilan), color: '#dc2626' },
    { label: 'Sisa untuk Kebutuhan Hidup', val: rupiah(Math.max(sisa, 0)), color: sisa >= 0 ? '#16a34a' : '#dc2626' },
    { label: 'Dana Darurat Ideal (10%)', val: rupiah(Math.round(gaji * 0.1)), color: '#2563eb' },
    { label: 'Tabungan Ideal (20%)', val: rupiah(Math.round(gaji * 0.2)), color: '#8b5cf6' },
    { label: 'Kebutuhan Hidup Tersisa', val: rupiah(Math.max(sisa - Math.round(gaji * 0.1) - Math.round(gaji * 0.2), 0)), color: sisa > 0 ? '#d97706' : '#dc2626' },
  ];
  el.innerHTML = rows.map(r => `
    <div class="hutang-akumulasi-row">
      <span class="hutang-akumulasi-label">${r.label}</span>
      <span class="hutang-akumulasi-val" style="color:${r.color}">${r.val}</span>
    </div>
  `).join('');
}

function renderHutang() {
  const el = document.getElementById('hutangList');
  if (!hutangList.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon"><svg style="width:36px;height:36px;stroke:#64748b;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/><path d="m12 12 4 10 1.7-4.3L22 16Z"/></svg></div><p>Belum ada hutang tercatat</p></div>';
  } else {
    el.innerHTML = hutangList.map(h => {
      const totalHutang = Number(h.total_hutang) || 0;
      const subLabel = totalHutang > 0
        ? `Total: ${rupiah(totalHutang)}${h.catatan ? ' · ' + h.catatan : ''}`
        : (h.catatan || 'Cicilan tetap');
      return `
        <div class="hutang-list-item">
          <div class="hutang-list-left">
            <div class="hutang-list-icon">💳</div>
            <div style="min-width:0;">
              <div class="hutang-list-nama">${h.nama}</div>
              <div class="hutang-list-sub">${subLabel}</div>
            </div>
          </div>
          <div class="hutang-list-right">
            <div class="hutang-list-nominal">${rupiah(h.cicilan)}/bln</div>
            ${totalHutang > 0 ? `<div class="hutang-list-sisa">Sisa: ${rupiah(totalHutang)}</div>` : ''}
          </div>
          <button class="hutang-del-btn" onclick="hapusHutang(${h.id})">
            <svg style="width:14px;height:14px;stroke:currentColor;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      `;
    }).join('');
  }

  // Tambah tombol selalu ada di bawah list
  el.innerHTML += `<button class="btn-primary" style="margin-top:14px;" onclick="openHutangSheet()"><svg style="width:16px;height:16px;stroke:#fff;vertical-align:middle;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Tambah Hutang</button>`;

  hitungSimulasi();
}

// ═══════════════════════════════════
// CATATAN ANAK — Supabase
// ═══════════════════════════════════
let anakProfil = null;
let anakCatatan = [];
let currentAnakTab = 'semua';

async function loadAnakData() {
  try {
    // Load profil anak (ambil baris pertama)
    const { data: profilRows, error: e1 } = await sb
      .from('anak_profil')
      .select('*')
      .order('id', { ascending: true })
      .limit(1);
    if (e1) throw e1;
    if (profilRows && profilRows.length > 0) {
      const r = profilRows[0];
      anakProfil = { id: r.id, nama: r.nama, tglLahir: r.tgl_lahir, jk: r.jenis_kelamin };
    } else {
      anakProfil = null;
    }

    // Load catatan anak
    if (anakProfil) {
      const { data: catatRows, error: e2 } = await sb
        .from('anak_catatan')
        .select('*')
        .eq('anak_id', anakProfil.id)
        .order('tgl', { ascending: false });
      if (e2) throw e2;
      anakCatatan = (catatRows || []).map(r => ({
        id: r.id,
        jenis: r.jenis,
        tgl: r.tgl,
        // tumbuh
        bb: r.bb, tb: r.tb, lk: r.lingkar_kepala, status: r.status_tumbuh,
        // keluhan
        keluhan: r.keluhan, tingkat: r.tingkat_keluhan, suhu: r.suhu, tindakan: r.tindakan,
        // vaksin
        vaksinNama: r.vaksin_nama, dosis: r.vaksin_dosis, tempat: r.vaksin_tempat,
        // milestone
        milestone: r.milestone, kategori: r.milestone_kategori,
        // umum
        catatan: r.catatan
      }));
    } else {
      anakCatatan = [];
    }
  } catch (err) {
    console.error('loadAnakData error:', err);
  }
}

function hitungUmur(tglLahir) {
  const lahir = new Date(tglLahir);
  const now = new Date();
  let tahun = now.getFullYear() - lahir.getFullYear();
  let bulan = now.getMonth() - lahir.getMonth();
  let hari = now.getDate() - lahir.getDate();

  // Koreksi jika hari negatif
  if (hari < 0) {
    bulan--;
    const bulanLalu = new Date(now.getFullYear(), now.getMonth(), 0);
    hari += bulanLalu.getDate();
  }
  // Koreksi jika bulan negatif
  if (bulan < 0) { tahun--; bulan += 12; }

  if (tahun === 0 && bulan === 0) return hari + ' hari';
  if (tahun === 0) return bulan + ' bulan ' + hari + ' hari';
  if (bulan === 0) return tahun + ' tahun';
  return tahun + ' tahun ' + bulan + ' bulan';
}

function renderAnakPage() {
  const setup = document.getElementById('anakSetupWrap');
  const profil = document.getElementById('anakProfilWrap');
  if (!anakProfil) {
    setup.classList.remove('hide');
    profil.classList.remove('show');
    return;
  }
  setup.classList.add('hide');
  profil.classList.add('show');

  document.getElementById('anakHeroNama').innerText = anakProfil.nama;
  document.getElementById('anakHeroUmur').innerText = 'Umur: ' + hitungUmur(anakProfil.tglLahir);
  const jkLabel = anakProfil.jk === 'laki' ? '👦 Laki-laki' : '👧 Perempuan';
  document.getElementById('anakHeroJK').innerText = jkLabel;

  // Last growth record
  const tumbuhList = anakCatatan.filter(c => c.jenis === 'tumbuh').sort((a,b) => new Date(b.tgl) - new Date(a.tgl));
  if (tumbuhList.length) {
    const last = tumbuhList[0];
    document.getElementById('anakHeroBB').innerText = last.bb || '-';
    document.getElementById('anakHeroTB').innerText = last.tb || '-';
    document.getElementById('anakLastGrowth').style.display = 'grid';
    document.getElementById('lgBB').innerText = (last.bb || '-') + ' kg';
    document.getElementById('lgTB').innerText = (last.tb || '-') + ' cm';
    document.getElementById('lgLK').innerText = last.lk ? last.lk + ' cm' : '-';
    const statusColors = {'sangat-baik':'#16a34a','baik':'#2563eb','normal':'#0369a1','perhatian':'#d97706','kurang':'#dc2626'};
    const statusLabels = {'sangat-baik':'Sangat Baik','baik':'Baik','normal':'Normal','perhatian':'Perhatian','kurang':'Kurang'};
    const col = statusColors[last.status] || '#64748b';
    document.getElementById('lgBBStatus').innerText = statusLabels[last.status] || '-';
    document.getElementById('lgBBStatus').style.color = col;
    document.getElementById('lgTBStatus').innerText = statusLabels[last.status] || '-';
    document.getElementById('lgTBStatus').style.color = col;
    document.getElementById('lgLKStatus').innerText = last.lk ? 'Tercatat' : 'Belum diisi';
    document.getElementById('lgLKStatus').style.color = last.lk ? '#16a34a' : '#64748b';
  } else {
    document.getElementById('anakHeroBB').innerText = '-';
    document.getElementById('anakHeroTB').innerText = '-';
    document.getElementById('anakLastGrowth').style.display = 'none';
  }

  document.getElementById('anakHeroCatat').innerText = anakCatatan.length;
  renderAnakHistory();
}

function renderAnakHistory() {
  const el = document.getElementById('anakHistoryList');
  let list = [...anakCatatan].sort((a, b) => new Date(b.tgl) - new Date(a.tgl));
  if (currentAnakTab !== 'semua') list = list.filter(c => c.jenis === currentAnakTab);

  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>Belum ada catatan</p></div>';
    return;
  }

  el.innerHTML = list.map(c => {
    const tgl = new Date(c.tgl).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'});
    let iconClass = c.jenis;
    let iconEmoji = c.jenis === 'tumbuh' ? '📏' : c.jenis === 'keluhan' ? '🤒' : c.jenis === 'vaksin' ? '💉' : '🌟';
    let title = '', sub = '', val = '', badge = '';

    if (c.jenis === 'tumbuh') {
      title = 'Timbang & Ukur';
      sub = (c.bb ? 'BB: ' + c.bb + ' kg' : '') + (c.tb ? ' · TB: ' + c.tb + ' cm' : '') + (c.lk ? ' · LK: ' + c.lk + ' cm' : '');
      const statusLabels = {'sangat-baik':'Sangat Baik','baik':'Baik','normal':'Normal','perhatian':'Perlu Perhatian','kurang':'Kurang'};
      badge = `<span class="status-badge ${c.status}">${statusLabels[c.status] || c.status}</span>`;
      val = c.catatan || '';
    } else if (c.jenis === 'keluhan') {
      title = c.keluhan;
      const tk = {'ringan':'🟢 Ringan','sedang':'🟡 Sedang','berat':'🔴 Berat'};
      sub = (tk[c.tingkat] || c.tingkat) + (c.suhu ? ' · ' + c.suhu + '°C' : '');
      val = c.tindakan || '';
    } else if (c.jenis === 'vaksin') {
      title = c.vaksinNama + ' (Dosis ' + c.dosis + ')';
      sub = c.tempat || '';
      val = c.catatan || '';
    } else if (c.jenis === 'milestone') {
      const katLabels = {motorik:'🏃 Motorik',halus:'✋ Motorik Halus',bahasa:'💬 Bahasa',sosial:'👥 Sosial',kognitif:'🧠 Kognitif'};
      title = c.milestone;
      sub = katLabels[c.kategori] || c.kategori;
      val = c.catatan || '';
    }

    return `
      <div class="anak-record">
        <div class="anak-record-left">
          <div class="anak-record-icon ${iconClass}">${iconEmoji}</div>
          <div style="min-width:0;">
            <div class="anak-record-title">${title}</div>
            <div class="anak-record-sub">${sub}</div>
            ${badge ? '<div style="margin-top:5px;">' + badge + '</div>' : ''}
            ${val ? '<div style="font-size:11px;color:var(--text2);margin-top:4px;">' + val + '</div>' : ''}
          </div>
        </div>
        <div class="anak-record-right">
          <div class="anak-record-date">${tgl}</div>
          <button class="tx-btn del" style="margin-top:6px;margin-left:auto;" onclick="hapusCatatAnak(${c.id})">
            <svg style="width:13px;height:13px;stroke:currentColor;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterAnakTab(tab) {
  currentAnakTab = tab;
  document.querySelectorAll('.anak-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('atab-' + tab).classList.add('active');
  renderAnakHistory();
}

function openAnakProfilSheet(isEdit = false) {
  if (isEdit && anakProfil) {
    document.getElementById('anakNamaInput').value = anakProfil.nama;
    document.getElementById('anakTglLahir').value = anakProfil.tglLahir;
    document.getElementById('anakJK').value = anakProfil.jk;
    document.getElementById('anakProfilSheetTitle').innerText = 'Edit Profil Anak';
  } else {
    document.getElementById('anakNamaInput').value = '';
    document.getElementById('anakTglLahir').value = '';
    document.getElementById('anakJK').value = 'laki';
    document.getElementById('anakProfilSheetTitle').innerText = 'Profil Anak';
  }
  document.getElementById('anakProfilSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

async function simpanProfilAnak() {
  const nama = document.getElementById('anakNamaInput').value.trim();
  const tglLahir = document.getElementById('anakTglLahir').value;
  const jk = document.getElementById('anakJK').value;
  if (!nama || !tglLahir) { alert('Nama dan tanggal lahir harus diisi!'); return; }

  try {
    if (anakProfil && anakProfil.id) {
      // Update existing
      const { error } = await sb.from('anak_profil').update({
        nama, tgl_lahir: tglLahir, jenis_kelamin: jk
      }).eq('id', anakProfil.id);
      if (error) throw error;
    } else {
      // Insert new
      const { data, error } = await sb.from('anak_profil').insert({
        nama, tgl_lahir: tglLahir, jenis_kelamin: jk
      }).select().single();
      if (error) throw error;
      anakProfil = { id: data.id, nama, tglLahir, jk };
    }
    anakProfil = { ...anakProfil, nama, tglLahir, jk };
    closeSheet('anakProfilSheet');
    renderAnakPage();
  } catch (err) {
    alert('Gagal menyimpan profil: ' + err.message);
  }
}

function openAnakCatatSheet() {
  document.querySelectorAll('.peng-card[id^="ajenis-"]').forEach(el => el.classList.remove('selected'));
  ['tumbuh','keluhan','vaksin','milestone'].forEach(j => {
    document.getElementById('form' + j.charAt(0).toUpperCase() + j.slice(1)).style.display = 'none';
  });
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('anakTglTumbuh').value = today;
  document.getElementById('anakTglKeluhan').value = today;
  document.getElementById('anakTglVaksin').value = today;
  document.getElementById('anakTglMilestone').value = today;
  document.getElementById('anakCatatSheet').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}

function pilihJenisCatat(jenis) {
  document.querySelectorAll('.peng-card[id^="ajenis-"]').forEach(el => el.classList.remove('selected'));
  document.getElementById('ajenis-' + jenis).classList.add('selected');
  ['tumbuh','keluhan','vaksin','milestone'].forEach(j => {
    const id = 'form' + j.charAt(0).toUpperCase() + j.slice(1);
    document.getElementById(id).style.display = j === jenis ? 'block' : 'none';
  });
}

async function simpanCatatAnak(jenis) {
  const tglMap = {tumbuh:'anakTglTumbuh',keluhan:'anakTglKeluhan',vaksin:'anakTglVaksin',milestone:'anakTglMilestone'};
  const tgl = document.getElementById(tglMap[jenis]).value;
  if (!tgl) { alert('Tanggal harus diisi!'); return; }

  let row = { anak_id: anakProfil.id, jenis, tgl };

  if (jenis === 'tumbuh') {
    const bb = document.getElementById('anakBB').value;
    const tb = document.getElementById('anakTB').value;
    if (!bb && !tb) { alert('Minimal isi berat atau tinggi badan!'); return; }
    row.bb = bb || null; row.tb = tb || null;
    row.lingkar_kepala = document.getElementById('anakLK').value || null;
    row.status_tumbuh = document.getElementById('anakStatusTumbuh').value;
    row.catatan = document.getElementById('anakCatatTumbuh').value || null;
    document.getElementById('anakBB').value = '';
    document.getElementById('anakTB').value = '';
    document.getElementById('anakLK').value = '';
    document.getElementById('anakCatatTumbuh').value = '';
  } else if (jenis === 'keluhan') {
    const keluhan = document.getElementById('anakKeluhan').value.trim();
    if (!keluhan) { alert('Keluhan harus diisi!'); return; }
    row.keluhan = keluhan;
    row.tingkat_keluhan = document.getElementById('anakTingkatKeluhan').value;
    row.suhu = document.getElementById('anakSuhu').value || null;
    row.tindakan = document.getElementById('anakTindakan').value || null;
    document.getElementById('anakKeluhan').value = '';
    document.getElementById('anakSuhu').value = '';
    document.getElementById('anakTindakan').value = '';
  } else if (jenis === 'vaksin') {
    const nm = document.getElementById('anakVaksinNama').value.trim();
    if (!nm) { alert('Nama vaksin harus diisi!'); return; }
    row.vaksin_nama = nm;
    row.vaksin_dosis = document.getElementById('anakVaksinDosis').value;
    row.vaksin_tempat = document.getElementById('anakVaksinTempat').value || null;
    row.catatan = document.getElementById('anakCatatVaksin').value || null;
    document.getElementById('anakVaksinNama').value = '';
    document.getElementById('anakVaksinTempat').value = '';
    document.getElementById('anakCatatVaksin').value = '';
  } else if (jenis === 'milestone') {
    const ms = document.getElementById('anakMilestone').value.trim();
    if (!ms) { alert('Pencapaian harus diisi!'); return; }
    row.milestone = ms;
    row.milestone_kategori = document.getElementById('anakMilestoneKat').value;
    row.catatan = document.getElementById('anakCatatMilestone').value || null;
    document.getElementById('anakMilestone').value = '';
    document.getElementById('anakCatatMilestone').value = '';
  }

  try {
    const { data, error } = await sb.from('anak_catatan').insert(row).select().single();
    if (error) throw error;
    // Map kembali ke format lokal
    const mapped = {
      id: data.id, jenis: data.jenis, tgl: data.tgl,
      bb: data.bb, tb: data.tb, lk: data.lingkar_kepala, status: data.status_tumbuh,
      keluhan: data.keluhan, tingkat: data.tingkat_keluhan, suhu: data.suhu, tindakan: data.tindakan,
      vaksinNama: data.vaksin_nama, dosis: data.vaksin_dosis, tempat: data.vaksin_tempat,
      milestone: data.milestone, kategori: data.milestone_kategori,
      catatan: data.catatan
    };
    anakCatatan.unshift(mapped);
    closeSheet('anakCatatSheet');
    renderAnakPage();
  } catch (err) {
    alert('Gagal menyimpan catatan: ' + err.message);
  }
}

async function hapusCatatAnak(id) {
  if (!confirm('Hapus catatan ini?')) return;
  try {
    const { error } = await sb.from('anak_catatan').delete().eq('id', id);
    if (error) throw error;
    anakCatatan = anakCatatan.filter(c => c.id !== id);
    renderAnakPage();
  } catch (err) {
    alert('Gagal menghapus catatan: ' + err.message);
  }
}

function closeSheet(id) {
  document.getElementById(id).classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
}

// ═══════════════════════════════════
// INIT
// ═══════════════════════════════════
async function initApp() {
  const el = document.getElementById('hariIni');
  if (el) el.innerText = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  if (localStorage.getItem('dm')==='1') {
    isDark = true;
    document.body.classList.add('dark');
    document.getElementById('darkToggle').classList.add('on');
  }

  await loadData();
  await checkAutoSaldo();
  await loadData();
  await loadHutang();
  await loadAnakData();
  renderAnakPage();
}

window.onload = async () => {
  const loginEl = document.getElementById('loginScreen');

  // Cek session aktif dari Supabase Auth
  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    loginEl.classList.add('hidden');
    await initApp();
  } else {
    loginEl.classList.add('visible');
  }

  // Otomatis logout jika session habis
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      loginEl.classList.remove('hidden');
      loginEl.classList.add('visible');
    }
  });
};
