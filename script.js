/* ==================== Firebase SDK ==================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  serverTimestamp, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ==================== Firebase Config ==================== */
const firebaseConfig = {
  apiKey: "AIzaSyCrb6EKsuaZunD5aIakwho07Sh_UXAceXc",
  authDomain: "ustaogluaptyonetim.firebaseapp.com",
  projectId: "ustaogluaptyonetim",
  storageBucket: "ustaogluaptyonetim.firebasestorage.app",
  messagingSenderId: "829433786147",
  appId: "1:829433786147:web:05dd0c2d866767b2d52696",
  measurementId: "G-TX1BERLB12"
};

/* ==================== Init ==================== */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ==================== Helpers ==================== */
const qs  = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));
const show = (el)=> el && el.classList.remove('hidden');
const hide = (el)=> el && el.classList.add('hidden');
const fmtTRY = new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY' });
const fmtDate = (v)=> { if(!v) return "-"; const d=v instanceof Date?v:new Date(v); return d.toLocaleDateString('tr-TR',{year:'numeric',month:'short',day:'numeric'}); };

function setInputValue(form, selector, value){
  if(!form) return;
  const el = form.querySelector(selector);
  if (el) el.value = value ?? '';
}
function toISODateInput(v){
  if(!v) return '';
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function modalSel(...cands){ for(const s of cands){ if(qs(s)) return s; } return cands[0]; }

function statusToTR(s){
  if(!s) return '';
  const k = String(s).toLowerCase();
  if(k === 'owner' || k === 'ev sahibi' || k === 'evsahibi') return 'Ev Sahibi';
  if(k === 'tenant' || k === 'kiracı' || k === 'kiraci') return 'Kiracı';
  return s;
}
function statusToEN(s){
  if(!s) return '';
  const k = String(s).toLowerCase();
  if(k === 'owner' || k === 'ev sahibi' || k === 'evsahibi') return 'Owner';
  if(k === 'tenant' || k === 'kiracı' || k === 'kiraci') return 'Tenant';
  return s;
}
function setSelectSmart(selectEl, enVal){
  if(!selectEl) return;
  const trVal = statusToTR(enVal);
  const opts = Array.from(selectEl.options).map(o=>o.value);
  if(opts.includes(enVal)) selectEl.value = enVal;
  else if(opts.includes(trVal)) selectEl.value = trVal;
  else selectEl.value = '';
}
const typeToTR = (t)=> (t === 'Extra' ? 'Ek Ödeme' : 'Aidat');

/* ==================== State ==================== */
let currentUser = null;
let currentRole = "user";
let announcementsCache = [];
let editingAnnouncementId = null;
let editingRole = null;
let editingResidentId = null;
let editingPaymentId = null;
let editingExpenseId = null;

let _residentsCache = null;
async function getResidentsCached(){
  if(_residentsCache) return _residentsCache;
  _residentsCache = await listResidents();
  return _residentsCache;
}
function invalidateResidentsCache(){ _residentsCache = null; }

function isResidentActive(r){
  if (r.isActive === false) return false;
  if (r.moveOutDate) {
    try{
      const d = new Date(r.moveOutDate);
      if (!isNaN(d)) return d.getTime() > Date.now();
    }catch{}
    return false;
  }
  return true;
}

/* ======= Aidat (fees) state ======= */
let feesState = { ym: "", defaultAmount: 0, items: {} };
let assignFlatOnSave = null; // fees'den yeni sakin atarken

/* ==================== Role Fetch ==================== */
async function fetchRole(uid){
  try{
    const snap = await getDoc(doc(db,'roles',uid));
    return snap.exists() && snap.data().role === 'admin';
  }catch(e){ console.error(e); return false; }
}

/* ==================== Auth UI ==================== */
const loginForm  = qs('#loginForm');
const loginError = qs('#loginError');

loginForm?.addEventListener('submit', async (e)=>{
  e.preventDefault(); loginError.textContent="";
  try{
    const email = qs('#loginEmail').value.trim();
    const pass  = qs('#loginPassword').value;
    await signInWithEmailAndPassword(auth,email,pass);
  }catch(err){
    console.error(err); loginError.textContent = err?.message || "Giriş başarısız.";
  }
});
qs('#btnLogout')?.addEventListener('click', async ()=>{ try{ await signOut(auth); }catch(e){ console.error(e); }});

/* ==================== Navigation ==================== */
const pages = ['dashboard','residents','payments','expenses','fees','reports'];
function showPage(id){
  pages.forEach(p=>{ const el=qs('#'+p); if(!el) return; p===id?show(el):hide(el); });
  qsa('.nav .nav-btn').forEach(b=>b.classList.remove('active'));
  const map={dashboard:'#btnDashboard',residents:'#btnResidents',payments:'#btnPayments',expenses:'#btnExpenses',fees:'#btnFees',reports:'#btnReports'};
  qs(map[id])?.classList.add('active');
}
qs('#btnDashboard')?.addEventListener('click',()=>showPage('dashboard'));
qs('#btnResidents')?.addEventListener('click',async ()=>{ showPage('residents'); await renderResidentsTable(); });
qs('#btnPayments')?.addEventListener('click',async ()=>{ showPage('payments'); await ensurePaymentsUI(); await renderPaymentsTable(); });
qs('#btnExpenses')?.addEventListener('click',async ()=>{ showPage('expenses'); await ensureExpensesUI(); await renderExpensesTable(); });
qs('#btnFees')?.addEventListener('click',async ()=>{ showPage('fees'); await ensureFeesUI(); await renderFeesTable(); });
qs('#btnReports')?.addEventListener('click',async ()=>{ showPage('reports'); await ensureReportsUI(); await renderReports(); });

/* ==================== Firestore wrappers ==================== */
async function listResidents(){ const s=await getDocs(collection(db,'residents')); return s.docs.map(d=>({id:d.id,...d.data()})); }
async function addResident(data){ if(currentRole!=='admin') throw new Error('Yetki yok'); const res = await addDoc(collection(db,'residents'),{...data,createdAt:serverTimestamp(),createdBy:currentUser?.uid||null}); invalidateResidentsCache(); return res; }
async function updateResident(id, data){ if(currentRole!=='admin') throw new Error('Yetki yok'); const r = await updateDoc(doc(db,'residents',id), data); invalidateResidentsCache(); return r; }
async function deleteResident(id){ if(currentRole!=='admin') throw new Error('Yetki yok'); const r = await deleteDoc(doc(db,'residents',id)); invalidateResidentsCache(); return r; }

async function listPayments(){ const s=await getDocs(collection(db,'payments')); return s.docs.map(d=>({id:d.id,...d.data()})); }
async function addPayment(data){ if(currentRole!=='admin') throw new Error('Yetki yok'); return addDoc(collection(db,'payments'),{...data,createdAt:serverTimestamp(),createdBy:currentUser?.uid||null}); }
async function updatePayment(id, data){ if(currentRole!=='admin') throw new Error('Yetki yok'); return updateDoc(doc(db,'payments',id), data); }
async function deletePayment(id){ if(currentRole!=='admin') throw new Error('Yetki yok'); return deleteDoc(doc(db,'payments',id)); }

async function listExpenses(){ const s=await getDocs(collection(db,'expenses')); return s.docs.map(d=>({id:d.id,...d.data()})); }
async function addExpense(data){ if(currentRole!=='admin') throw new Error('Yetki yok'); return addDoc(collection(db,'expenses'),{...data,createdAt:serverTimestamp(),createdBy:currentUser?.uid||null}); }
async function updateExpense(id, data){ if(currentRole!=='admin') throw new Error('Yetki yok'); return updateDoc(doc(db,'expenses',id), data); }
async function deleteExpense(id){ if(currentRole!=='admin') throw new Error('Yetki yok'); return deleteDoc(doc(db,'expenses',id)); }

async function listAnnouncements(){ const s=await getDocs(collection(db,'announcements')); return s.docs.map(d=>({id:d.id,...d.data()})); }
async function addAnnouncement(data){ if(currentRole!=='admin') throw new Error('Yetki yok'); return addDoc(collection(db,'announcements'),{...data,createdAt:serverTimestamp(),createdBy:currentUser?.uid||null}); }
async function updateAnnouncement(id,data){ if(currentRole!=='admin') throw new Error('Yetki yok'); return updateDoc(doc(db,'announcements',id),data); }
async function deleteAnnouncement(id){ if(currentRole!=='admin') throw new Error('Yetki yok'); return deleteDoc(doc(db,'announcements',id)); }

/* ===== Fees (Aidat) ===== */
async function getFeesDoc(ym){ const r=doc(db,'fees',ym); const s=await getDoc(r); return s.exists()?{id:ym,...s.data()}:null; }
async function setFeesDoc(ym,data){ if(currentRole!=='admin') throw new Error('Yetki yok'); const r=doc(db,'fees',ym); return setDoc(r,{ym, ...data, updatedAt:serverTimestamp(),updatedBy:currentUser?.uid||null},{merge:true}); }

/* ===== Admin Info ===== */
async function getAdminInfoDoc(){ const r=doc(db,'settings','adminInfo'); const s=await getDoc(r); return s.exists()?s.data():{}; }
async function setAdminInfoDoc(data){ if(currentRole!=='admin') throw new Error('Yetki yok'); const r=doc(db,'settings','adminInfo'); return setDoc(r,{...data,updatedAt:serverTimestamp(),updatedBy:currentUser?.uid||null},{merge:true}); }

/* ==================== İlk Kurulum: adminInfo yoksa oluştur ==================== */
async function ensureAdminInfoDoc(){
  try{
    const ref = doc(db,'settings','adminInfo');
    const snap = await getDoc(ref);
    if(snap.exists()) return;
    if(currentRole!=='admin') return;
    const defaultInfo = {
      adminName: "", adminPhone: "",
      assistantName: "", assistantPhone: "",
      supervisorName: "", supervisorPhone: "",
      createdAt: new Date().toISOString()
    };
    await setDoc(ref, defaultInfo, { merge:true });
  }catch(e){ console.error("ensureAdminInfoDoc:", e); }
}

/* ==================== Export helpers ==================== */
async function exportCollection(name){
  const s=await getDocs(collection(db,name));
  const data=s.docs.map(d=>({id:d.id,...d.data()}));
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${name}-${new Date().toISOString().slice(0,10)}.json`; a.click();
}
qs('#exportPayments')?.addEventListener('click',()=>exportCollection('payments'));
qs('#exportExpenses')?.addEventListener('click',()=>exportCollection('expenses'));

/* ==================== Dashboard summary ==================== */
async function renderDashboard(){
  const box=qs('#dashboardSummary'); if(!box) return; box.innerHTML="";
  const [res,pays,exps]=await Promise.all([listResidents(),listPayments(),listExpenses()]);
  const totalP=pays.reduce((s,p)=>s+(+p.amount||0),0);
  const totalE=exps.reduce((s,p)=>s+(+p.amount||0),0);
  const items=[
    {title:'Toplam Sakin', val: res.length},
    {title:'Toplam Ödeme', val: fmtTRY.format(totalP)},
    {title:'Toplam Gider',  val: fmtTRY.format(totalE)},
    {title:'Bakiye',       val: fmtTRY.format(totalP-totalE)}
  ];
  items.forEach(c=>{ const d=document.createElement('div'); d.className='card'; d.innerHTML=`<h3>${c.title}</h3><p style="font-size:24px;margin:8px 0 0">${c.val}</p>`; box.appendChild(d); });
}

/* ==================== Announcements ==================== */
async function renderAnnouncements(){
  const box=qs('#announcementList'); if(!box) return;
  const rows=await listAnnouncements(); announcementsCache = rows;
  box.innerHTML = rows.map(r=>{
    const t=r.type||'info';
    const created=r.createdAt?.toDate?r.createdAt.toDate():(r.createdAt||r.date);
    const when=created?fmtDate(created):'';
    const actions = currentRole==='admin'
      ? `<div class="ann-actions">
           <button type="button" class="btn small edit" data-id="${r.id}">✏️ Düzenle</button>
           <button type="button" class="btn small danger delete" data-id="${r.id}">🗑️ Sil</button>
         </div>` : '';
    return `<div class="ann-card ${t}" data-id="${r.id}">
      <div class="ann-top"><div class="ann-title">${r.title||'-'}</div><div class="ann-date meta">${when}</div></div>
      <div class="ann-body">${r.content||'-'}</div>${actions}</div>`;
  }).join('') || '<div class="neutral"><div><strong>Henüz duyuru yok</strong></div></div>';

  box.onclick = async (e)=>{
    const edit=e.target.closest('.edit'); const del=e.target.closest('.delete');
    if(edit){
      const id=edit.dataset.id; const s=announcementsCache.find(a=>a.id===id); if(!s) return;
      const f=qs('#formAnnouncement'); f.title.value=s.title||''; f.type.value=s.type||'info'; f.content.value=s.content||'';
      editingAnnouncementId=id; openModal(modalSel('#modalAnnouncement','#announcementModal')); return;
    }
    if(del){
      const id=del.dataset.id; if(!confirm('Bu duyuruyu silmek istiyor musunuz?')) return;
      await deleteAnnouncement(id); await renderAnnouncements(); return;
    }
  };
}

/* --- Admin Info (view) --- */
async function renderAdminInfo(){
  const data = await getAdminInfoDoc();
  const set=(id,val)=>{ const el=qs('#'+id); if(el) el.textContent=(val&&String(val).trim())||'Not Set'; };
  set('adminNameText', data.adminName);
  set('adminPhoneText', data.adminPhone);
  set('assistantNameText', data.assistantName);
  set('assistantPhoneText', data.assistantPhone);
  set('supervisorNameText', data.supervisorName);
  set('supervisorPhoneText', data.supervisorPhone);
}

/* Saat/Tarih */
function tickClockTR(){
  const d=qs('#currentDateTR'), t=qs('#currentTimeTR'); if(!d||!t) return;
  const now=new Date();
  d.textContent = now.toLocaleDateString('tr-TR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  t.textContent = now.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
setInterval(tickClockTR, 1000); tickClockTR();

/* Role-bazlı admin info modal açıcı */
function openAdminInfoForRole(role){
  editingRole = role || 'all';
  const titleMap={admin:'Yönetici Bilgilerini Düzenle',assistant:'Yönetici Yardımcısı Bilgilerini Düzenle',supervisor:'Denetmen Bilgilerini Düzenle',all:'Yönetici Bilgilerini Düzenle'};
  const setRow=(id,on)=>{ const el=qs(id); if(el) on?show(el):hide(el); };
  if(role==='admin'){ setRow('#rowAdmin',true); setRow('#rowAssistant',false); setRow('#rowSupervisor',false); }
  else if(role==='assistant'){ setRow('#rowAdmin',false); setRow('#rowAssistant',true); setRow('#rowSupervisor',false); }
  else if(role==='supervisor'){ setRow('#rowAdmin',false); setRow('#rowAssistant',false); setRow('#rowSupervisor',true); }
  else { setRow('#rowAdmin',true); setRow('#rowAssistant',true); setRow('#rowSupervisor',true); }
  qs('#adminInfoModalTitle') && (qs('#adminInfoModalTitle').textContent = titleMap[editingRole] || titleMap.all);

  getAdminInfoDoc().then(data=>{
    const setVal=(name,val)=>{ const el=qs(`[name="${name}"]`); if(el) el.value=val||''; };
    setVal('adminName', data.adminName); setVal('adminPhone', data.adminPhone);
    setVal('assistantName', data.assistantName); setVal('assistantPhone', data.assistantPhone);
    setVal('supervisorName', data.supervisorName); setVal('supervisorPhone', data.supervisorPhone);
  });

  openModal(modalSel('#adminInfoModal','#modalAdminInfo'));
}
qsa('.role-edit').forEach(btn=>{
  btn.addEventListener('click',(e)=>{
    e.preventDefault(); if(currentRole!=='admin') return;
    openAdminInfoForRole(btn.dataset.role);
  });
});

/* ==================== Residents ==================== */
async function renderResidentsTable(){
  const tbody = qs('#resTbody'); if(!tbody) return;
  const rows = await listResidents();
  rows.sort((a,b)=> (''+(a.flatNo||'')).localeCompare((''+(b.flatNo||'')), 'tr', {numeric:true}));

  const isAdminUI = currentRole==='admin';
  tbody.innerHTML = rows.map(r=>{
    const activeBadge = isResidentActive(r) ? '' : ' <span class="pill" title="Pasif / Taşınmış">Pasif</span>';
    return `
    <tr data-id="${r.id}">
      <td>${r.flatNo||''}</td>
      <td>${r.name||''}${activeBadge}</td>
      <td>${r.phone||''}</td>
      <td>${r.email||''}</td>
      <td>${statusToTR(r.status)}</td>
      <td>${r.licensePlate||''}</td>
      <td>
        ${isAdminUI ? `
          <button type="button" class="btn small" data-edit="${r.id}">✏️ Düzenle</button>
          <button type="button" class="btn small" data-moveout="${r.id}">🚚 Taşındı</button>
          <button type="button" class="btn small danger" data-del="${r.id}">🗑️ Sil</button>
        ` : ''}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;color:#777;padding:16px">Henüz kayıt yok</td></tr>`;

  if (!tbody.dataset.bound) {
    tbody.addEventListener('click', onResidentsTableClick);
    tbody.dataset.bound = '1';
  }
}

async function onResidentsTableClick(e){
  const editBtn = e.target.closest('button[data-edit]');
  const delBtn  = e.target.closest('button[data-del]');
  const mvBtn   = e.target.closest('button[data-moveout]');
  if (!editBtn && !delBtn && !mvBtn) return;
  e.preventDefault(); e.stopPropagation();
  if(currentRole!=='admin'){ alert('Sadece yönetici işlem yapabilir.'); return; }

  if(editBtn){
    try{
      const id = editBtn.getAttribute('data-edit');
      const list = await listResidents();
      const rec = list.find(x=>x.id===id); if(!rec) return;
      editingResidentId = id;

      qs('#residentModalTitle') && (qs('#residentModalTitle').textContent = 'Sakini Düzenle');
      const f = qs('#formResident'); if(!f){ alert('Sakin formu bulunamadı'); return; }

      setInputValue(f, 'input[name="flatNo"]', rec.flatNo || '');
      setInputValue(f, 'input[name="name"]',   rec.name || '');
      setInputValue(f, 'input[name="phone"]',  rec.phone || '');
      setInputValue(f, 'input[name="email"]',  rec.email || '');
      const statusSel = f.querySelector('select[name="status"]');
      if(statusSel) setSelectSmart(statusSel, statusToEN(rec.status));
      setInputValue(f, 'input[name="licensePlate"]', rec.licensePlate || '');

      openModal(modalSel('#modalResident','#residentModal'));
    }catch(err){
      console.error(err);
      alert('Düzenleme açılamadı: ' + (err?.message || 'Bilinmeyen hata'));
    }
  }

  if(mvBtn){
    const id = mvBtn.getAttribute('data-moveout');
    if(!confirm('Bu sakini pasif yapıp taşındı olarak işaretlemek istiyor musunuz?')) return;
    try{
      const moveOutDate = new Date().toISOString();
      await updateResident(id, { isActive:false, moveOutDate });
      await renderResidentsTable();
    }catch(err){ console.error(err); alert('Güncellenemedi: '+(err?.message||'Bilinmeyen hata')); }
  }

  if(delBtn){
    const id = delBtn.getAttribute('data-del');
    if(confirm('Bu sakini silmek istiyor musunuz? (Geçmişi kaybetmek istemiyorsanız "Taşındı"yı kullanın)')){
      await deleteResident(id);
      await renderResidentsTable();
      await renderDashboard();
    }
  }
}

// yeni sakin ekle
qs('#btnResidentAdd')?.addEventListener('click',(e)=>{
  e.preventDefault();
  if(currentRole!=='admin') return;
  assignFlatOnSave = null;
  editingResidentId = null;
  qs('#residentModalTitle') && (qs('#residentModalTitle').textContent = 'Sakin Ekle');
  qs('#formResident')?.reset();
  openModal(modalSel('#modalResident','#residentModal'));
});
qs('#addResident')?.addEventListener('click',(e)=>{
  e.preventDefault();
  if(currentRole!=='admin') return;
  assignFlatOnSave = null;
  editingResidentId = null;
  qs('#residentModalTitle') && (qs('#residentModalTitle').textContent = 'Sakin Ekle');
  qs('#formResident')?.reset();
  openModal(modalSel('#modalResident','#residentModal'));
});
qs('#formResident')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(currentRole!=='admin'){ alert('Sadece yönetici işlem yapabilir.'); return; }
  const formObj = Object.fromEntries(new FormData(e.target).entries());
  const payload = {
    ...formObj,
    status: statusToEN(formObj.status),
    isActive: true,
    moveInDate: new Date().toISOString()
  };
  try{
    if(editingResidentId){
      await updateResident(editingResidentId, payload);
    }else{
      const res = await addResident(payload);
      if(assignFlatOnSave){
        await deactivateActiveResidentsForFlat(assignFlatOnSave, res.id, payload.moveInDate);
        assignFlatOnSave = null;
      }
    }
    closeModals(); e.target.reset(); editingResidentId = null;
    await renderResidentsTable(); await renderDashboard();
  }catch(err){ console.error(err); alert('Kaydedilemedi: ' + (err?.message||'Bilinmeyen hata')); }
});

async function deactivateActiveResidentsForFlat(flatNo, newId, moveInISO){
  const list = await listResidents();
  const toClose = list.filter(r=> (r.flatNo||'')===flatNo && isResidentActive(r) && r.id!==newId);
  await Promise.all(toClose.map(r=> updateResident(r.id, { isActive:false, moveOutDate: moveInISO })));
}

/* ==================== PAYMENTS (Açıklama + Ay yönetimi) ==================== */
function paymentsToolbarHTML(){
  const years = Array.from({length: 8}, (_,i)=> new Date().getFullYear() - 4 + i);
  const yearOpts = ['<option value="">Yıl</option>', ...years.map(y=>`<option value="${y}">${y}</option>`)].join('');
  const monthOpts = `
    <option value="">Ay</option>
    <option value="01">Ocak</option><option value="02">Şubat</option><option value="03">Mart</option>
    <option value="04">Nisan</option><option value="05">Mayıs</option><option value="06">Haziran</option>
    <option value="07">Temmuz</option><option value="08">Ağustos</option><option value="09">Eylül</option>
    <option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
  `;
  return `
    <div class="row-gap" style="flex-wrap:wrap; margin:8px 0 12px;">
      <input id="paySearch" placeholder="Ara: isim / daire / ay / tarih / tür / açıklama" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;max-width:320px;">
      <select id="payResident" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;min-width:220px;">
        <option value="">Sakin (ID ile)</option>
      </select>
      <select id="payType" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;">
        <option value="">Tür: Tümü</option>
        <option value="Due">Aidat</option>
        <option value="Extra">Ek Ödeme</option>
      </select>
      <select id="payYear" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;">${yearOpts}</select>
      <select id="payMonth" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;">${monthOpts}</select>
      <button type="button" id="payReset" class="btn outline">Sıfırla</button>
      <span style="flex:1"></span>
      <button type="button" id="payExportCSV" class="btn outline">CSV</button>
    </div>
    <div class="table-container">
      <table class="tbl">
        <thead>
          <tr>
            <th>Ödeyen</th>
            <th>Daire</th>
            <th>Tür</th>
            <th>Ay</th>
            <th>Açıklama</th>
            <th>Tutar</th>
            <th>Tarih</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody id="payTbody"></tbody>
        <tfoot>
          <tr>
            <td style="font-weight:700">Toplam</td>
            <td></td><td></td><td></td><td></td>
            <td id="payTotal" style="font-weight:700"></td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

async function ensurePaymentsUI(){
  const box = qs('#paymentList'); if(!box) return;
  let created = false;
  if(!qs('#payTbody')){ box.innerHTML = paymentsToolbarHTML(); created = true; }

  if(created){
    const resSel = qs('#payResident');
    if(resSel){
      const residents = await getResidentsCached();
      resSel.innerHTML = `<option value="">Sakin (ID ile)</option>` + residents
        .sort((a,b)=> (''+(a.flatNo||'')).localeCompare((''+(b.flatNo||'')),'tr',{numeric:true}) || (a.name||'').localeCompare(b.name||'', 'tr'))
        .map(r=>`<option value="${r.id}">${r.flatNo?`Daire ${r.flatNo} — `:''}${r.name||'-'}</option>`)
        .join('');
    }

    const onFilter = ()=> renderPaymentsTable();
    qs('#paySearch')?.addEventListener('input', onFilter);
    qs('#payResident')?.addEventListener('change', onFilter);
    qs('#payType')?.addEventListener('change', onFilter);
    qs('#payYear')?.addEventListener('change', onFilter);
    qs('#payMonth')?.addEventListener('change', onFilter);
    qs('#payReset')?.addEventListener('click', ()=>{
      qs('#paySearch').value='';
      qs('#payResident').value='';
      qs('#payType').value='';
      qs('#payYear').value='';
      qs('#payMonth').value='';
      renderPaymentsTable();
    });
    qs('#payExportCSV')?.addEventListener('click', exportPaymentsCSV);

    const payTbody = qs('#payTbody');
    if (payTbody && !payTbody.dataset.bound) {
      payTbody.addEventListener('click', onPaymentsTableClick);
      payTbody.dataset.bound = '1';
    }
  }
}

async function onPaymentsTableClick(e){
  const editBtn = e.target.closest('button[data-edit]');
  const delBtn  = e.target.closest('button[data-del]');
  if (!editBtn && !delBtn) return;
  e.preventDefault(); e.stopPropagation();
  if (currentRole !== 'admin') { alert('Sadece yönetici işlem yapabilir.'); return; }

  if (editBtn) {
    try {
      const id = editBtn.getAttribute('data-edit');
      const list = await listPayments();
      const rec = list.find(x=>x.id===id);
      if (!rec) return;

      editingPaymentId = id;

      await enhancePaymentForm();
      const f = qs('#formPayment');
      if (!f) { alert('Ödeme formu bulunamadı.'); return; }

      const residents = await getResidentsCached();
      const sel = qs('#residentSelect');
      let selectedId = rec.residentId || '';
      if (!selectedId && rec.residentName) {
        const match = residents.find(r => (r.name||'').trim().toLowerCase() === rec.residentName.trim().toLowerCase());
        selectedId = match?.id || '';
      }
      if (sel) sel.value = selectedId || '';
      const chosen = residents.find(r=>r.id===selectedId);

      setInputValue(f, 'input[name="residentName"]', rec.residentName || chosen?.name || '');
      setInputValue(f, 'input[name="flatNo"]',       rec.flatNo || chosen?.flatNo || '');
      setInputValue(f, 'input[name="residentId"]',   selectedId || '');

      const typSel = qs('#paymentType');
      const typeVal = (rec.type || rec.paymentType || 'Due');
      if (typSel) typSel.value = typeVal;

      const monthField = f.querySelector('[name="month"]');
      if(monthField) monthField.value = typeVal === 'Extra' ? '' : (rec.month || '');

      setInputValue(f, 'input[name="amount"]',      rec.amount ?? '');
      setInputValue(f, 'input[name="date"]',        rec.date ? toISODateInput(rec.date) : '');
      setInputValue(f, 'input[name="description"]', rec.description || '');

      toggleMonthVisibility();
      openModal(modalSel('#modalPayment','#paymentModal'));
    } catch (err) {
      console.error(err);
      alert('Düzenleme açılamadı: ' + (err?.message || 'Bilinmeyen hata'));
    }
  }

  if (delBtn) {
    try {
      const id = delBtn.getAttribute('data-del');
      if (!confirm('Bu ödemeyi silmek istiyor musunuz?')) return;
      await deletePayment(id);
      await renderPaymentsTable();
      await renderDashboard();
    } catch (err) {
      console.error(err);
      alert('Silinemedi: ' + (err?.message || 'Bilinmeyen hata'));
    }
  }
}

// Ödeme formunu zenginleştir
async function enhancePaymentForm(){
  const f = qs('#formPayment'); if(!f) return;

  // Tür
  if(!qs('#paymentType')){
    const lab = document.createElement('label');
    lab.innerHTML = `Ödeme Türü
      <select id="paymentType" name="type" style="margin-top:6px">
        <option value="Due">Aidat</option>
        <option value="Extra">Ek Ödeme</option>
      </select>`;
    f.prepend(lab);
    qs('#paymentType').addEventListener('change', toggleMonthVisibility);
  }

  // Sakin seçimi
  if(!qs('#residentSelect')){
    const residents = await getResidentsCached();
    const lab = document.createElement('label');
    lab.textContent = 'Sakin Seç';
    const sel = document.createElement('select');
    sel.id = 'residentSelect';
    sel.name = 'residentSelect';
    sel.style.marginTop = '6px';
    sel.innerHTML = `<option value="">— Seçiniz —</option>` +
      residents
        .sort((a,b)=> (''+(a.flatNo||'')).localeCompare((''+(b.flatNo||'')),'tr',{numeric:true}) || (a.name||'').localeCompare(b.name||'', 'tr'))
        .map(r=>`<option value="${r.id}">${r.flatNo?`Daire ${r.flatNo} — `:''}${r.name||'-'}</option>`)
        .join('');
    lab.appendChild(sel);

    const rnLabel = f.querySelector('input[name="residentName"]')?.closest('label');
    if(rnLabel && rnLabel.parentNode){
      rnLabel.parentNode.insertBefore(lab, rnLabel);
    } else {
      f.prepend(lab);
    }

    if(!qs('input[name="residentId"]')){
      const hid = document.createElement('input');
      hid.type = 'hidden'; hid.name = 'residentId';
      f.appendChild(hid);
    }

    if(!qs('input[name="flatNo"]')){
      const labFlat = document.createElement('label');
      labFlat.innerHTML = `Daire No
        <input name="flatNo" placeholder="örn. 12" />`;
      if(rnLabel && rnLabel.nextSibling){
        rnLabel.parentNode.insertBefore(labFlat, rnLabel.nextSibling);
      } else {
        f.appendChild(labFlat);
      }
    }

    sel.addEventListener('change', ()=>{
      const v = sel.value;
      const res = (_residentsCache||[]).find(r=>r.id===v);
      const nameInp = f.querySelector('input[name="residentName"]');
      const idInp   = f.querySelector('input[name="residentId"]');
      const flatInp = f.querySelector('input[name="flatNo"]');
      if(res){
        nameInp && (nameInp.value = res.name || '');
        idInp && (idInp.value = res.id);
        flatInp && (flatInp.value = res.flatNo || '');
      }else{
        idInp && (idInp.value = '');
      }
    });
  }

  // Açıklama alanı
  if(!qs('#paymentDescription')){
    const monthWrapRef = f.querySelector('[name="month"]')?.closest('label');
    const descWrap = document.createElement('label');
    descWrap.id = 'paymentDescWrap';
    descWrap.style.display = 'none';
    descWrap.innerHTML = `Açıklama
      <input id="paymentDescription" name="description" placeholder="Örn. asansör tamiri / bağış / gecikme cezası" />`;
    if(monthWrapRef && monthWrapRef.parentNode){
      monthWrapRef.parentNode.insertBefore(descWrap, monthWrapRef.nextSibling);
    } else {
      f.appendChild(descWrap);
    }
  }

  toggleMonthVisibility();
}

// Ay/ Açıklama zorunluluğunu yönet
function toggleMonthVisibility(){
  const f = qs('#formPayment'); if(!f) return;
  const typ = qs('#paymentType')?.value || 'Due';

  const monthField = f.querySelector('[name="month"]');
  const monthLabel = monthField?.closest('label') || monthField?.closest('.form-group') || monthField?.parentElement;

  const descInp  = qs('#paymentDescription');
  const descWrap = qs('#paymentDescWrap');

  if(typ === 'Extra'){
    if(monthLabel) monthLabel.style.display = 'none';
    if(monthField){
      monthField.required = false;
      monthField.removeAttribute('required');
      monthField.value = '';
      monthField.disabled = true;
    }
    if(descWrap) descWrap.style.display = '';
    if(descInp){ descInp.required = true; descInp.setAttribute('required',''); }
  }else{
    if(monthLabel) monthLabel.style.display = '';
    if(monthField){
      monthField.disabled = false;
      monthField.required = true;
      monthField.setAttribute('required','');
    }
    if(descWrap) descWrap.style.display = 'none';
    if(descInp){ descInp.required = false; descInp.removeAttribute('required'); descInp.value=''; }
  }
}

function matchPaymentFilters(rec, q, y, m, t, rid){
  let ok = true;
  if(q){
    const hay = `${rec.residentName||''} ${rec.flatNo||''} ${(rec.month||'')}
                 ${rec.description||''} ${typeToTR(rec.type||'Due')} ${fmtDate(rec.date)}`.toLowerCase();
    ok = hay.includes(q.toLowerCase());
  }
  if(ok && rid){ ok = (rec.residentId||'') === rid; }
  if(ok && t){ ok = (rec.type||'Due') === t; }
  if(ok && y){ ok = (rec.month||'').slice(0,4) === y; }
  if(ok && m){ ok = (rec.month||'').slice(5,7) === m; }
  return ok;
}

async function renderPaymentsTable(){
  await ensurePaymentsUI();
  const tbody = qs('#payTbody'); const totalCell = qs('#payTotal');
  if(!tbody) return;

  const [rows, residents] = await Promise.all([listPayments(), getResidentsCached()]);
  const nameToFlat = new Map(residents.map(r=>[(r.name||'').trim().toLowerCase(), r.flatNo || '']));
  rows.forEach(r=>{
    if(!r.flatNo && r.residentName){
      const f = nameToFlat.get(r.residentName.trim().toLowerCase());
      if(f) r._derivedFlatNo = f;
    }
  });

  rows.sort((a,b)=>{
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const q  = qs('#paySearch')?.value?.trim() || '';
  const y  = qs('#payYear')?.value || '';
  const m  = qs('#payMonth')?.value || '';
  const t  = qs('#payType')?.value || '';
  const rid= qs('#payResident')?.value || '';

  const normalized = rows.map(r=>({ ...r, type: (r.type || r.paymentType || 'Due') }));
  const filtered = normalized.filter(r=>matchPaymentFilters(
    { ...r, flatNo: r.flatNo || r._derivedFlatNo }, q, y, m, t, rid
  ));
  const isAdminUI = currentRole==='admin';

  let total = 0;
  tbody.innerHTML = filtered.map(r=>{
    const amount = +r.amount || 0; total += amount;
    const flat = r.flatNo || r._derivedFlatNo || '';
    const typTR = typeToTR(r.type);
    const monthText = r.type === 'Extra' ? '—' : (r.month || '');
    const descText  = r.description || '—';
    return `
      <tr data-id="${r.id}">
        <td>${r.residentName||''}</td>
        <td>${flat||''}</td>
        <td>${typTR}</td>
        <td>${monthText}</td>
        <td>${descText}</td>
        <td>${fmtTRY.format(amount)}</td>
        <td>${fmtDate(r.date)}</td>
        <td>
          ${isAdminUI ? `
            <button type="button" class="btn small" data-edit="${r.id}">✏️ Düzenle</button>
            <button type="button" class="btn small danger" data-del="${r.id}">🗑️ Sil</button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="8" style="text-align:center;color:#777;padding:16px">Henüz ödeme yok</td></tr>`;

  totalCell.textContent = fmtTRY.format(total);
}

function exportPaymentsCSV(){
  const rows = Array.from(document.querySelectorAll('#payTbody tr'));
  if(!rows.length){ alert('Dışa aktaracak veri yok.'); return; }
  const headers = ['Ödeyen','Daire','Tür','Ay','Açıklama','Tutar','Tarih'];
  const data = rows.map(tr=>{
    const tds = tr.querySelectorAll('td');
    return [
      tds[0]?.innerText||'', tds[1]?.innerText||'', tds[2]?.innerText||'',
      tds[3]?.innerText||'', tds[4]?.innerText||'', tds[5]?.innerText||'',
      tds[6]?.innerText||''
    ];
  });
  const csv = [headers, ...data].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `payments-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

/* ==================== EXPENSES ==================== */
const EXP_CATEGORIES = [
  'Temizlik','Genel','Elektrik','Su','Doğalgaz','Bakım',
  'Güvenlik','Sigorta','Asansör Bakım','Diğer'
];
function expensesToolbarHTML(){
  const years = Array.from({length: 8}, (_,i)=> new Date().getFullYear() - 4 + i);
  const yearOpts = ['<option value="">Yıl</option>', ...years.map(y=>`<option value="${y}">${y}</option>`)].join('');
  const monthOpts = `
    <option value="">Ay</option>
    <option value="01">Ocak</option><option value="02">Şubat</option><option value="03">Mart</option>
    <option value="04">Nisan</option><option value="05">Mayıs</option><option value="06">Haziran</option>
    <option value="07">Temmuz</option><option value="08">Ağustos</option><option value="09">Eylül</option>
    <option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
  `;
  const catOpts = ['<option value="">Kategori</option>', ...EXP_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`)].join('');
  return `
    <div class="row-gap" style="flex-wrap:wrap; margin:8px 0 12px;">
      <input id="expSearch" placeholder="Ara: kategori / not / tarih" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;max-width:320px;">
      <select id="expCategory" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;">${catOpts}</select>
      <select id="expYear" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;">${yearOpts}</select>
      <select id="expMonth" style="padding:8px 10px;border:1px solid var(--border);border-radius:10px;">${monthOpts}</select>
      <button type="button" id="expReset" class="btn outline">Sıfırla</button>
      <span style="flex:1"></span>
      <button type="button" id="expExportCSV" class="btn outline">CSV</button>
    </div>
    <div class="table-container">
      <table class="tbl">
        <thead>
          <tr>
            <th>Kategori</th>
            <th>Not</th>
            <th>Tutar</th>
            <th>Tarih</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody id="expTbody"></tbody>
        <tfoot>
          <tr>
            <td style="font-weight:700">Toplam</td>
            <td></td>
            <td id="expTotal" style="font-weight:700"></td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
async function ensureExpensesUI(){
  const box = qs('#expenseList'); if(!box) return;
  let created=false;
  if(!qs('#expTbody')){ box.innerHTML = expensesToolbarHTML(); created = true; }

  if(created){
    const onFilter = ()=> renderExpensesTable();
    qs('#expSearch')?.addEventListener('input', onFilter);
    qs('#expCategory')?.addEventListener('change', onFilter);
    qs('#expYear')?.addEventListener('change', onFilter);
    qs('#expMonth')?.addEventListener('change', onFilter);
    qs('#expReset')?.addEventListener('click', ()=>{
      qs('#expSearch').value='';
      qs('#expCategory').value='';
      qs('#expYear').value='';
      qs('#expMonth').value='';
      renderExpensesTable();
    });
    qs('#expExportCSV')?.addEventListener('click', exportExpensesCSV);

    const tb = qs('#expTbody');
    if(tb && !tb.dataset.bound){
      tb.addEventListener('click', onExpensesTableClick);
      tb.dataset.bound='1';
    }
  }
}
function matchExpenseFilters(rec, q, y, m, cat){
  let ok = true;
  if(q){
    const hay = `${rec.category||''} ${rec.note||''} ${fmtDate(rec.date)}`.toLowerCase();
    ok = hay.includes(q.toLowerCase());
  }
  if(ok && cat){ ok = (rec.category||'') === cat; }
  if(ok && y){
    const dt = rec.date? new Date(rec.date):null;
    ok = dt ? String(dt.getFullYear()) === y : false;
  }
  if(ok && m){
    const dt = rec.date? new Date(rec.date):null;
    ok = dt ? String(dt.getMonth()+1).padStart(2,'0') === m : false;
  }
  return ok;
}
async function renderExpensesTable(){
  await ensureExpensesUI();
  const tbody = qs('#expTbody'); const totalCell = qs('#expTotal');
  if(!tbody) return;

  const rows = await listExpenses();
  rows.sort((a,b)=>{
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const q   = qs('#expSearch')?.value?.trim() || '';
  const cat = qs('#expCategory')?.value || '';
  const y   = qs('#expYear')?.value || '';
  const m   = qs('#expMonth')?.value || '';
  const isAdminUI = currentRole==='admin';

  const filtered = rows.filter(r=>matchExpenseFilters(r,q,y,m,cat));

  let total=0;
  tbody.innerHTML = filtered.map(r=>{
    const amount = +r.amount || 0; total += amount;
    return `
      <tr data-id="${r.id}">
        <td>${r.category||'-'}</td>
        <td>${r.note||'-'}</td>
        <td>${fmtTRY.format(amount)}</td>
        <td>${fmtDate(r.date)}</td>
        <td>
          ${isAdminUI ? `
            <button type="button" class="btn small" data-edit="${r.id}">✏️ Düzenle</button>
            <button type="button" class="btn small danger" data-del="${r.id}">🗑️ Sil</button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="5" style="text-align:center;color:#777;padding:16px">Henüz gider yok</td></tr>`;

  totalCell.textContent = fmtTRY.format(total);
}
function exportExpensesCSV(){
  const rows = Array.from(document.querySelectorAll('#expTbody tr'));
  if(!rows.length){ alert('Dışa aktaracak veri yok.'); return; }
  const headers = ['Kategori','Not','Tutar','Tarih'];
  const data = rows.map(tr=>{
    const tds = tr.querySelectorAll('td');
    return [
      tds[0]?.innerText||'', tds[1]?.innerText||'',
      tds[2]?.innerText||'', tds[3]?.innerText||''
    ];
  });
  const csv = [headers, ...data].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `expenses-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}
async function onExpensesTableClick(e){
  const editBtn = e.target.closest('button[data-edit]');
  const delBtn  = e.target.closest('button[data-del]');
  if (!editBtn && !delBtn) return;
  e.preventDefault(); e.stopPropagation();
  if (currentRole !== 'admin') { alert('Sadece yönetici işlem yapabilir.'); return; }

  if (editBtn) {
    try{
      const id = editBtn.getAttribute('data-edit');
      const list = await listExpenses();
      const rec = list.find(x=>x.id===id); if(!rec) return;
      editingExpenseId = id;

      await enhanceExpenseForm();
      const f = qs('#formExpense');
      if(!f){ alert('Gider formu bulunamadı.'); return; }

      const catSel = qs('#expenseCategory');
      if(catSel) catSel.value = rec.category || '';
      setInputValue(f, 'textarea[name="note"]',  rec.note || '');
      setInputValue(f, 'input[name="amount"]',   rec.amount ?? '');
      setInputValue(f, 'input[name="date"]',     rec.date ? toISODateInput(rec.date) : '');

      openModal(modalSel('#modalExpense','#expenseModal'));
    }catch(err){
      console.error(err);
      alert('Düzenleme açılamadı: ' + (err?.message || 'Bilinmeyen hata'));
    }
  }

  if (delBtn) {
    try{
      const id = delBtn.getAttribute('data-del');
      if (!confirm('Bu gideri silmek istiyor musunuz?')) return;
      await deleteExpense(id);
      await renderExpensesTable();
      await renderDashboard();
    }catch(err){
      console.error(err);
      alert('Silinemedi: ' + (err?.message || 'Bilinmeyen hata'));
    }
  }
}
async function enhanceExpenseForm(){
  const f = qs('#formExpense'); if(!f) return;

  // Kategori
  if(!qs('#expenseCategory')){
    const lab = document.createElement('label');
    lab.innerHTML = `Kategori
      <select id="expenseCategory" name="category" required style="margin-top:6px">
        ${EXP_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select>`;
    const amountLabel = f.querySelector('input[name="amount"]')?.closest('label');
    if(amountLabel && amountLabel.parentNode){
      amountLabel.parentNode.insertBefore(lab, amountLabel);
    }else{
      f.prepend(lab);
    }
  }

  // Not
  if(!f.querySelector('textarea[name="note"]')){
    const lab = document.createElement('label');
    lab.innerHTML = `Not
      <textarea name="note" rows="2" placeholder="Kısa not (opsiyonel)"></textarea>`;
    const dateLabel = f.querySelector('input[name="date"]')?.closest('label');
    if(dateLabel && dateLabel.parentNode){
      dateLabel.parentNode.insertBefore(lab, dateLabel);
    }else{
      f.appendChild(lab);
    }
  }
}

/* ==================== Aidat / Ayarlamalar (FEES PAGE) ==================== */
function feesToolbarHTML(){
  const years = Array.from({length: 8}, (_,i)=> new Date().getFullYear() - 4 + i);
  const yearOpts = years.map(y=>`<option value="${y}">${y}</option>`).join('');
  const monthOpts = `
    <option value="01">Ocak</option><option value="02">Şubat</option><option value="03">Mart</option>
    <option value="04">Nisan</option><option value="05">Mayıs</option><option value="06">Haziran</option>
    <option value="07">Temmuz</option><option value="08">Ağustos</option><option value="09">Eylül</option>
    <option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
  `;
  return `
  <div class="panel">
    <div class="panel-head">
      <h3>Aidat / Ayarlamalar</h3>
      <div class="row-gap" style="align-items:center">
        <select id="feeYear" class="pill">${yearOpts}</select>
        <select id="feeMonth" class="pill">${monthOpts}</select>
        <input id="feeDefault" type="number" min="0" step="0.01" placeholder="Varsayılan (₺)" class="pill" style="width:160px">
        <button id="feeApplyEmpty" class="btn outline admin-only">Boşlara uygula</button>
        <button id="feeCopyNext" class="btn outline admin-only">İleri aya kopyala</button>
        <button id="feeExportCSV" class="btn outline">CSV</button>
        <button id="feeSave" class="btn primary admin-only">Kaydet</button>
      </div>
    </div>
    <div class="mt">
      <div class="row-gap" style="margin:8px 0 12px;flex-wrap:wrap">
        <button id="feeAddFlat" class="btn outline admin-only">+ Daire ekle</button>
        <span class="muted">Not: “Yeni Sakin Ata” ile eski kayıtlar silinmez; önceki sakin pasif yapılır.</span>
      </div>
      <div class="table-container">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width:120px">Daire</th>
              <th>Aktif Sakin</th>
              <th style="width:160px">Aidat (₺)</th>
              <th style="width:220px">İşlemler</th>
            </tr>
          </thead>
          <tbody id="feesTbody"></tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}

function ymStr(y,m){ return `${y}-${m}`; }
function nextYM(ym){
  const [y,m] = ym.split('-').map(Number);
  const d = new Date(y, m-1, 1); d.setMonth(d.getMonth()+1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

async function ensureFeesUI(){
  const box = qs('#fees'); if(!box) return;
  if(!qs('#feesTbody')){
    box.innerHTML = feesToolbarHTML();
    const now = new Date();
    qs('#feeYear').value = String(now.getFullYear());
    qs('#feeMonth').value = String(now.getMonth()+1).padStart(2,'0');

    const onChange = async ()=>{ await loadFeesForSelectors(); await renderFeesTable(); };
    qs('#feeYear')?.addEventListener('change', onChange);
    qs('#feeMonth')?.addEventListener('change', onChange);
    qs('#feeDefault')?.addEventListener('input', ()=>{ feesState.defaultAmount = +(qs('#feeDefault').value||0); });

    qs('#feeApplyEmpty')?.addEventListener('click', ()=>{ applyDefaultToEmptyRows(); renderFeesTable(); });
    qs('#feeCopyNext')?.addEventListener('click', async ()=>{ await copyFeesToNextMonth(); alert('İleri aya kopyalandı.'); });
    qs('#feeSave')?.addEventListener('click', saveFees);
    qs('#feeExportCSV')?.addEventListener('click', exportFeesCSV);
    qs('#feeAddFlat')?.addEventListener('click', ()=>{ addFlatRow(''); renderFeesTable(); });

    const tb = qs('#feesTbody');
    tb?.addEventListener('input', onFeesTbodyInput);
    tb?.addEventListener('click', onFeesTbodyClick);

    await loadFeesForSelectors();
  }
}

async function loadFeesForSelectors(){
  const y = qs('#feeYear')?.value; const m = qs('#feeMonth')?.value;
  const ym = ymStr(y,m);
  const feesDoc = await getFeesDoc(ym);
  feesState.ym = ym;
  feesState.defaultAmount = +(feesDoc?.defaultAmount || 0);
  feesState.items = {...(feesDoc?.items||{})};

  const defInp = qs('#feeDefault'); if(defInp) defInp.value = feesState.defaultAmount || '';

  const residents = await getResidentsCached();
  const activeFlats = new Set(residents.filter(isResidentActive).map(r=> String(r.flatNo||'').trim()).filter(Boolean));
  const feeFlats = new Set(Object.keys(feesState.items||{}));
  feesState._rows = Array.from(new Set([...activeFlats, ...feeFlats])).sort((a,b)=>(''+a).localeCompare((''+b),'tr',{numeric:true}));
}

function addFlatRow(flatNo){
  const f = String(flatNo||'').trim();
  if(!f) {
    const v = prompt('Daire No girin:');
    if(!v) return;
    feesState._rows.push(String(v).trim());
    feesState._rows = Array.from(new Set(feesState._rows)).sort((a,b)=>(''+a).localeCompare((''+b),'tr',{numeric:true}));
    return;
  }
  feesState._rows.push(f);
  feesState._rows = Array.from(new Set(feesState._rows)).sort((a,b)=>(''+a).localeCompare((''+b),'tr',{numeric:true}));
}

function applyDefaultToEmptyRows(){
  feesState._rows.forEach(flat=>{
    if(!feesState.items[flat] && feesState.defaultAmount>0){
      feesState.items[flat] = feesState.defaultAmount;
    }
  });
}

async function copyFeesToNextMonth(){
  const next = nextYM(feesState.ym);
  await setFeesDoc(next, { defaultAmount: feesState.defaultAmount, items: feesState.items });
}

function getActiveResidentNameForFlat(flatNo, residents){
  const list = residents.filter(r=> String(r.flatNo||'').trim() === String(flatNo).trim());
  const active = list.find(isResidentActive);
  return active?.name || '';
}

async function renderFeesTable(){
  const tb = qs('#feesTbody'); if(!tb) return;
  const residents = await getResidentsCached();

  if(!feesState._rows || feesState._rows.length===0){
    tb.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#777;padding:16px">Daire listesi yok. “Daire ekle” ile başlayın.</td></tr>`;
    return;
  }

  tb.innerHTML = feesState._rows.map(flat=>{
    const amount = feesState.items[flat] ?? '';
    const rName = getActiveResidentNameForFlat(flat, residents) || '<em>—</em>';
    const row = `
      <tr data-flat="${flat}">
        <td><input class="pill" data-key="flat" value="${flat}" style="min-width:90px"></td>
        <td>${rName}</td>
        <td><input class="pill" data-key="amount" type="number" min="0" step="0.01" placeholder="${feesState.defaultAmount||0}" value="${amount}"></td>
        <td>
          ${currentRole==='admin' ? `
            <button class="btn small" data-assign="${flat}">👤 Yeni Sakin Ata</button>
            <button class="btn small outline" data-clear="${flat}">Temizle</button>
          ` : ''}
        </td>
      </tr>
    `;
    return row;
  }).join('');
}

function onFeesTbodyInput(e){
  const tr = e.target.closest('tr'); if(!tr) return;
  const flatOld = tr.getAttribute('data-flat');
  const key = e.target.getAttribute('data-key');
  if(!key) return;

  if(key==='flat'){
    const newFlat = String(e.target.value||'').trim();
    const val = feesState.items[flatOld];
    delete feesState.items[flatOld];
    tr.setAttribute('data-flat', newFlat);
    if(newFlat) feesState.items[newFlat] = val;
    feesState._rows = feesState._rows.map(f=> f===flatOld? newFlat : f);
  }

  if(key==='amount'){
    const newVal = e.target.value;
    const flat = tr.getAttribute('data-flat');
    if(!flat) return;
    if(newVal==='' || isNaN(+newVal)) delete feesState.items[flat];
    else feesState.items[flat] = +newVal;
  }
}

function onFeesTbodyClick(e){
  const assignBtn = e.target.closest('button[data-assign]');
  const clearBtn  = e.target.closest('button[data-clear]');
  if(!assignBtn && !clearBtn) return;
  if(currentRole!=='admin'){ alert('Sadece yönetici işlem yapabilir.'); return; }

  if(assignBtn){
    const flat = assignBtn.getAttribute('data-assign');
    openAssignResidentForFlat(flat);
  }
  if(clearBtn){
    const flat = clearBtn.getAttribute('data-clear');
    delete feesState.items[flat];
    renderFeesTable();
  }
}

async function openAssignResidentForFlat(flat){
  if(!flat){ alert('Daire numarası yok.'); return; }
  assignFlatOnSave = String(flat).trim();

  const form = qs('#formResident');
  if(!form){ alert('Sakin formu bulunamadı.'); return; }
  form.reset();
  const title = qs('#residentModalTitle'); if(title) title.textContent = `Yeni Sakin Ata (Daire ${flat})`;
  setInputValue(form, 'input[name="flatNo"]', assignFlatOnSave);

  editingResidentId = null;
  openModal(modalSel('#modalResident','#residentModal'));
}

async function saveFees(){
  try{
    await setFeesDoc(feesState.ym, { defaultAmount: feesState.defaultAmount, items: feesState.items });
    alert('Kaydedildi.');
  }catch(err){
    console.error(err);
    alert('Kaydedilemedi: ' + (err?.message || 'Bilinmeyen hata'));
  }
}

async function exportFeesCSV(){
  if(!feesState._rows?.length){ alert('Dışa aktaracak veri yok.'); return; }
  const residents = await getResidentsCached();
  const headers = ['Daire','Sakin','Tutar'];
  const data = feesState._rows.map(flat=>{
    const name = getActiveResidentNameForFlat(flat, residents) || '';
    const amt = feesState.items[flat] ?? '';
    return [flat, name, amt];
  });
  const csv = [headers, ...data].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fees-${feesState.ym}.csv`;
  a.click();
}

/* ==================== RAPORLAR ==================== */
function reportsHTML(){
  const years = Array.from({length: 8}, (_,i)=> new Date().getFullYear() - 4 + i);
  const yearOpts = years.map(y=>`<option value="${y}">${y}</option>`).join('');
  return `
    <div class="panel">
      <div class="panel-head">
        <h3>Aidat Ödeme Cetveli</h3>
        <div class="row-gap" style="align-items:center">
          <select id="repYear" class="pill">${yearOpts}</select>
          <button id="repExportDues" class="btn outline">CSV</button>
        </div>
      </div>
      <div class="table-container">
        <table class="tbl" style="min-width:980px">
          <thead id="duesThead"></thead>
          <tbody id="duesTbody"></tbody>
        </table>
      </div>
      <div class="muted" style="margin-top:8px">İpucu: Hücreye tıklayınca ilgili sakin ve ay için ödeme formu açılır.</div>
    </div>

    <div class="panel mt">
      <div class="panel-head">
        <h3>Aylık Gelir - Gider Özeti</h3>
        <div><button id="repExportIE" class="btn outline">CSV</button></div>
      </div>
      <div class="table-container">
        <table class="tbl">
          <thead>
            <tr>
              <th>Ay</th>
              <th>Aidat Geliri</th>
              <th>Ek Gelir</th>
              <th>Toplam Gelir</th>
              <th>Gider</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody id="ieTbody"></tbody>
        </table>
      </div>
    </div>
  `;
}

async function ensureReportsUI(){
  const box = qs('#reports'); if(!box) return;
  if(!qs('#repYear')){
    box.innerHTML = reportsHTML();
    const now = new Date();
    qs('#repYear').value = String(now.getFullYear());

    qs('#repYear')?.addEventListener('change', renderReports);
    qs('#repExportDues')?.addEventListener('click', exportDuesMatrixCSV);
    qs('#repExportIE')?.addEventListener('click', exportIECSV);

    const tb = qs('#duesTbody');
    if(tb && !tb.dataset.bound){
      tb.addEventListener('click', onDuesCellClick);
      tb.dataset.bound = '1';
    }
  }
}

const MONTHS_TR = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTHS_TR_LABEL = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function isActiveInMonth(r, ym){
  const [y,m]=ym.split('-').map(Number);
  const start = new Date(y, m-1, 1);
  const end = new Date(y, m, 0, 23,59,59,999);
  const inDate  = r.moveInDate  ? new Date(r.moveInDate)  : null;
  const outDate = r.moveOutDate ? new Date(r.moveOutDate) : null;
  const activeFlag = r.isActive !== false;
  const afterIn  = !inDate  || inDate  <= end;
  const beforeOut= !outDate || outDate >= start;
  return activeFlag && afterIn && beforeOut;
}

let _lastDuesMatrix = null; // export için sakla

// ====== YENİ renderReports (N/A sadece ücret yoksa; ikonlar ✅🟡❌) ======
async function renderReports(){
  const year = qs('#repYear')?.value || String(new Date().getFullYear());
  const [residents, paymentsRaw, expenses] = await Promise.all([
    getResidentsCached(), listPayments(), listExpenses()
  ]);

  // Normalize payments: type + flatNo türet + month normalize
  const nameToFlat = new Map(residents.map(r=>[(r.name||'').trim().toLowerCase(), String(r.flatNo||'').trim()]));
  const payments = paymentsRaw.map(p=>{
    const type = p.type || p.paymentType || 'Due';
    let flat = (p.flatNo||'');
    if(!flat && p.residentName){
      const f = nameToFlat.get((p.residentName||'').trim().toLowerCase());
      if(f) flat = f;
    }
    // month'ı 'YYYY-MM' formuna zorla (aidat için)
    let mm = p.month || '';
    if(mm){
      const m = String(mm).slice(0,7);
      const parts = m.split('-');
      if(parts.length===2){
        const y = parts[0], mo = parts[1].padStart(2,'0');
        mm = `${y}-${mo}`;
      }else{
        mm = m;
      }
    }
    return { ...p, type, _flat: String(flat||'').trim(), month:mm };
  });

  // Ödeme kovaları
  const paysByRidYM  = new Map(); // "residentId|ym" -> sum
  const paysByFlatYM = new Map(); // "flat|ym" -> sum (rezidant bağımsız)
  const paysByNameFlat = new Map(); // "name|flat|ym" -> sum (ek/fallback)

  for(const p of payments){
    if(p.type !== 'Due') continue; // ek ödemeler cetvele girmez
    const ym = (p.month||'').slice(0,7);
    if(!ym) continue;

    const amt = +(p.amount||0);
    const rid = (p.residentId||'').trim();
    const flat = (p._flat||'').trim();
    const name = (p.residentName||'').trim().toLowerCase();

    if(rid){
      const k = `${rid}|${ym}`;
      paysByRidYM.set(k, (paysByRidYM.get(k)||0) + amt);
    }
    if(flat){
      const k = `${flat}|${ym}`;
      paysByFlatYM.set(k, (paysByFlatYM.get(k)||0) + amt);
    }
    if(name || flat){
      const k = `${name}|${flat}|${ym}`;
      paysByNameFlat.set(k, (paysByNameFlat.get(k)||0) + amt);
    }
  }

  // Yılın tüm ayları için aidat (fees) dokümanları
  const feesByYM = {};
  for(const m of MONTHS_TR){
    const ym = `${year}-${m}`;
    const fdoc = await getFeesDoc(ym);
    feesByYM[ym] = {
      defaultAmount: +(fdoc?.defaultAmount||0),
      items: {...(fdoc?.items||{})}
    };
  }

  // ===== Aidat Cetveli =====
  const thead = qs('#duesThead'); const tbody = qs('#duesTbody');
  if(thead){
    thead.innerHTML = `<tr>
      <th style="position:sticky;left:0;background:#fff;z-index:2">Sakin</th>
      <th style="position:sticky;left:120px;background:#fff;z-index:2">Daire</th>
      ${MONTHS_TR_LABEL.map(m=>`<th>${m}</th>`).join('')}
    </tr>`;
  }

  const sortedResidents = [...residents].sort((a,b)=>
    (''+(a.flatNo||'')).localeCompare((''+(b.flatNo||'')),'tr',{numeric:true}) || (a.name||'').localeCompare((b.name||''),'tr')
  );

  const matrix = [];

  if(tbody){
    tbody.innerHTML = sortedResidents.map(r=>{
      const rid  = r.id;
      const flat = String(r.flatNo||'').trim();
      const row  = { name:r.name||'', flat:flat, cells:[] };

      const tds = MONTHS_TR.map((m,idx)=>{
        const ym = `${year}-${m}`;
        // Ücret: daireye özel varsa onu, yoksa varsayılanı al
        const feeConf = feesByYM[ym] || {defaultAmount:0, items:{}};
        const fee = flat ? (feeConf.items[flat] ?? feeConf.defaultAmount ?? 0) : 0;

        // Ödenen: öncelik sırası residentId|ym -> flat|ym -> name|flat|ym
        let paid = 0;
        if(rid) paid = paysByRidYM.get(`${rid}|${ym}`) || 0;
        if(paid === 0 && flat) paid = paysByFlatYM.get(`${flat}|${ym}`) || 0;
        if(paid === 0 && (r.name||flat)) {
          const k = `${(r.name||'').trim().toLowerCase()}|${flat}|${ym}`;
          paid = paysByNameFlat.get(k) || 0;
        }

        let html = '';
        let status = 'NA';

        if(fee <= 0){
          // Yükümlülük yok: N/A (ücret tanımlı değil)
          html = `<span class="muted" title="Bu ay için ücret tanımlı değil">—</span>`;
          status = 'NA';
        }else if(paid <= 0){
          html = `<span class="status-icon status-unpaid" title="Ücret: ${fmtTRY.format(fee)} | Ödenen: ${fmtTRY.format(0)}">❌</span>`;
          status = 'UNPAID';
        }else if(paid < fee){
          html = `<span class="status-icon status-partial" title="Ücret: ${fmtTRY.format(fee)} | Ödenen: ${fmtTRY.format(paid)}">🟡</span>`;
          status = 'PARTIAL';
        }else{
          html = `<span class="status-icon status-paid" title="Ücret: ${fmtTRY.format(fee)} | Ödenen: ${fmtTRY.format(paid)}">✅</span>`;
          status = 'PAID';
        }

        row.cells.push({ym, fee, paid, status});

        // Ücret tanımlıysa hücreyi tıklanabilir yap (hızlı ödeme)
        const clickable = fee > 0 ? `style="cursor:pointer"` : '';
        return `<td data-rid="${rid}" data-ym="${ym}" data-exp="${fee}" ${clickable}>${html}</td>`;
      }).join('');

      matrix.push(row);

      return `<tr>
        <td style="position:sticky;left:0;background:#fff;z-index:1">${r.name||''}</td>
        <td style="position:sticky;left:120px;background:#fff;z-index:1">${flat}</td>
        ${tds}
      </tr>`;
    }).join('') || `<tr><td colspan="14" style="text-align:center;color:#777;padding:16px">Sakin bulunamadı</td></tr>`;
  }

  _lastDuesMatrix = { year, matrix };

  // ===== Aylık Gelir-Gider =====
  const ieTbody = qs('#ieTbody');
  if(ieTbody){
    const buckets = {};
    for(const m of MONTHS_TR){ buckets[`${year}-${m}`] = { due:0, extra:0, expense:0 }; }

    for(const p of payments){
      // Aidat gelirini month'a, ek ödemeyi tarih ayına yaz
      if(p.type==='Due' && p.month){
        const ym = p.month.slice(0,7);
        if(buckets[ym]) buckets[ym].due += (+p.amount||0);
      }else if(p.type==='Extra'){
        const d = p.date ? new Date(p.date) : null;
        const ym = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : '';
        if(buckets[ym]) buckets[ym].extra += (+p.amount||0);
      }
    }
    for(const ex of expenses){
      const d = ex.date ? new Date(ex.date) : null;
      const ym = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : '';
      if(buckets[ym]) buckets[ym].expense += (+ex.amount||0);
    }

    ieTbody.innerHTML = MONTHS_TR.map((m,i)=>{
      const ym = `${year}-${m}`, b=buckets[ym];
      if(!b) return '';
      const income = b.due + b.extra;
      const net = income - b.expense;
      return `<tr>
        <td>${MONTHS_TR_LABEL[i]} ${year}</td>
        <td>${fmtTRY.format(b.due)}</td>
        <td>${fmtTRY.format(b.extra)}</td>
        <td>${fmtTRY.format(income)}</td>
        <td>${fmtTRY.format(b.expense)}</td>
        <td>${fmtTRY.format(net)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="6" style="text-align:center;color:#777;padding:16px">Veri yok</td></tr>`;
  }
}

function onDuesCellClick(e){
  const td = e.target.closest('td[data-ym]'); if(!td) return;
  const ym = td.getAttribute('data-ym');
  const rid = td.getAttribute('data-rid') || '';
  const expected = +(td.getAttribute('data-exp')||0);
  if(!ym || expected<=0) return; // ücret yoksa form açma

  openQuickPayment(rid, ym, expected);
}

async function openQuickPayment(residentId, ym, expected){
  if(currentRole!=='admin') return;
  await enhancePaymentForm();
  const f = qs('#formPayment'); if(!f) return;

  const residents = await getResidentsCached();
  const sel = qs('#residentSelect');
  if(sel){ sel.value = residentId || ''; sel.dispatchEvent(new Event('change')); }

  const monthField = f.querySelector('[name="month"]');
  if(monthField) monthField.value = ym;

  const typeSel = qs('#paymentType'); if(typeSel) typeSel.value = 'Due';
  toggleMonthVisibility();

  const amountInp = f.querySelector('input[name="amount"]');
  if(amountInp && (!amountInp.value || +amountInp.value===0)) amountInp.value = expected;

  openModal(modalSel('#modalPayment','#paymentModal'));
}

function exportDuesMatrixCSV(){
  if(!_lastDuesMatrix || !_lastDuesMatrix.matrix?.length){ alert('Önce tabloyu görüntüleyin.'); return; }
  const year = _lastDuesMatrix.year;
  const headers = ['Sakin','Daire', ...MONTHS_TR_LABEL.map(m=>`${m} ${year}`)];
  const rows = _lastDuesMatrix.matrix.map(r=>{
    const cells = r.cells.map(c=>{
      if(c.fee<=0) return 'N/A';
      const s = (c.status==='PAID')?'Ödendi':(c.status==='PARTIAL'?'Eksik':'Yok');
      return `${s} (${c.paid}/${c.fee})`;
    });
    return [r.name, r.flat, ...cells];
  });

  const csv = [headers, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dues-matrix-${year}.csv`;
  a.click();
}

function exportIECSV(){
  const tbody = qs('#ieTbody');
  const rows = Array.from(tbody?.querySelectorAll('tr')||[]);
  if(!rows.length){ alert('Dışa aktaracak veri yok.'); return; }
  const headers = ['Ay','Aidat Geliri','Ek Gelir','Toplam Gelir','Gider','Net'];
  const data = rows.map(tr=> Array.from(tr.querySelectorAll('td')).map(td=>td.innerText||'') );
  const csv = [headers, ...data].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `income-expense-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

/* ==================== Modals ==================== */
const backdrop = qs('#modalBackdrop');
function openModal(sel){ const m=qs(sel); if(!m) return; show(backdrop); show(m); const i=m.querySelector('input,textarea,select,button'); if(i) setTimeout(()=>i.focus(),60); }
function closeModals(){
  hide(backdrop); qsa('.modal').forEach(m=>hide(m));
  editingPaymentId = null;
  editingResidentId = null;
  editingAnnouncementId = null;
  editingExpenseId = null;
}
backdrop?.addEventListener('click',closeModals);
qsa('.modal [data-close]')?.forEach(b=>b.addEventListener('click',closeModals));

/* Açma butonları */
qs('#addAnnouncement')?.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();editingAnnouncementId=null; qs('#formAnnouncement').reset(); openModal(modalSel('#modalAnnouncement','#announcementModal'));});
qs('#addPayment')?.addEventListener('click', async (e)=>{
  e.preventDefault();e.stopPropagation();
  editingPaymentId=null;
  qs('#formPayment')?.reset();
  await enhancePaymentForm();
  const sel = qs('#residentSelect'); if(sel) sel.value='';
  const idInp = qs('input[name="residentId"]'); if(idInp) idInp.value='';
  const typSel = qs('#paymentType'); if(typSel) typSel.value='Due';
  toggleMonthVisibility();
  openModal(modalSel('#modalPayment','#paymentModal'));
});
qs('#addExpense')?.addEventListener('click', async (e)=>{
  e.preventDefault();e.stopPropagation();
  editingExpenseId = null;
  qs('#formExpense')?.reset();
  await enhanceExpenseForm();
  openModal(modalSel('#modalExpense','#expenseModal'));
});
qs('#setFee')?.addEventListener('click',async (e)=>{
  e.preventDefault();e.stopPropagation();
  await ensureFeesUI(); await renderFeesTable();
  showPage('fees');
});

/* Duyuru form */
qs('#formAnnouncement')?.addEventListener('submit', async (e)=>{
  e.preventDefault(); if(currentRole!=='admin') return;
  const fd=new FormData(e.target); const data=Object.fromEntries(fd.entries());
  if(editingAnnouncementId){ await updateAnnouncement(editingAnnouncementId,{title:data.title,type:data.type||'info',content:data.content}); }
  else { await addAnnouncement({title:data.title,type:data.type||'info',content:data.content}); }
  editingAnnouncementId=null; e.target.reset(); closeModals(); await renderAnnouncements();
});

/* === Admin Bilgileri formu === */
const adminForm = qs('#adminInfoForm') || qs('#formAdminInfo');
adminForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (currentRole !== 'admin') { alert('Sadece yönetici düzenleyebilir.'); return; }

  const data = Object.fromEntries(new FormData(e.target).entries());

  const patch = {};
  if (editingRole === 'admin' || editingRole === 'all') {
    patch.adminName  = (data.adminName  || '').trim();
    patch.adminPhone = (data.adminPhone || '').trim();
  }
  if (editingRole === 'assistant' || editingRole === 'all') {
    patch.assistantName  = (data.assistantName  || '').trim();
    patch.assistantPhone = (data.assistantPhone || '').trim();
  }
  if (editingRole === 'supervisor' || editingRole === 'all') {
    patch.supervisorName  = (data.supervisorName  || '').trim();
    patch.supervisorPhone = (data.supervisorPhone  || '').trim();
  }

  try {
    await setAdminInfoDoc(patch);
    closeModals();
    await renderAdminInfo();
  } catch (err) {
    console.error(err);
    alert('Kaydedilemedi: ' + (err?.message || 'Bilinmeyen hata'));
  }
});

/* Ödeme formu */
qs('#formPayment')?.addEventListener('submit', async (e)=>{
  e.preventDefault(); if(currentRole!=='admin') return;
  const o=Object.fromEntries(new FormData(e.target).entries());
  const date=o.date?new Date(o.date).toISOString():new Date().toISOString();
  const type = o.type ? o.type : 'Due';
  const monthVal = (type === 'Extra') ? '' : (o.month || '');
  const descVal  = (type === 'Extra') ? (o.description || '') : '';

  const payload = {
    residentId: o.residentId || '',
    residentName: o.residentName,
    flatNo: o.flatNo || '',
    type,
    month: monthVal,
    description: descVal,
    amount: +(o.amount||0),
    date
  };
  try{
    if(editingPaymentId){
      await updatePayment(editingPaymentId, payload);
    }else{
      await addPayment(payload);
    }
    editingPaymentId = null;
    e.target.reset(); closeModals();
    await renderPaymentsTable(); await renderDashboard(); await renderReports();
  }catch(err){
    console.error(err);
    alert('Kaydedilemedi: ' + (err?.message||'Bilinmeyen hata'));
  }
});

/* Gider formu */
qs('#formExpense')?.addEventListener('submit', async (e)=>{
  e.preventDefault(); if(currentRole!=='admin') return;
  await enhanceExpenseForm();
  const o = Object.fromEntries(new FormData(e.target).entries());
  const date = o.date ? new Date(o.date).toISOString() : new Date().toISOString();
  const payload = {
    category: o.category || EXP_CATEGORIES[0],
    note: (o.note || '').trim(),
    amount: +(o.amount || 0),
    date
  };
  try{
    if(editingExpenseId){ await updateExpense(editingExpenseId, payload); }
    else{ await addExpense(payload); }
    editingExpenseId = null;
    e.target.reset(); closeModals();
    await renderExpensesTable(); await renderDashboard(); await renderReports();
  }catch(err){
    console.error(err);
    alert('Kaydedilemedi: ' + (err?.message||'Bilinmeyen hata'));
  }
});

/* ==================== Auth State ==================== */
onAuthStateChanged(auth, async (user)=>{
  currentUser = user || null;
  if(!currentUser){
    show(qs('#loginView')); hide(qs('#appView')); hide(qs('#nav')); hide(qs('#userBox')); return;
  }

  currentRole = (await fetchRole(currentUser.uid)) ? 'admin' : 'user';
  qsa('.admin-only').forEach(el=> currentRole==='admin'?show(el):hide(el));
  qs('#userEmail').textContent = currentUser.email || '';
  qs('#userRole').textContent  = currentRole==='admin' ? 'Admin' : 'Kullanıcı';

  hide(qs('#loginView')); show(qs('#appView')); show(qs('#nav')); show(qs('#userBox'));
  showPage('dashboard');

  await ensureAdminInfoDoc();

  await Promise.all([
    renderDashboard(),
    renderAnnouncements(),
    renderAdminInfo(),
    renderResidentsTable(),
    (async ()=>{ await ensurePaymentsUI(); await renderPaymentsTable(); })(),
    (async ()=>{ await ensureExpensesUI(); await renderExpensesTable(); })(),
    (async ()=>{ await ensureFeesUI(); await renderFeesTable(); })(),
    (async ()=>{ await ensureReportsUI(); await renderReports(); })()
  ]);
});

/* ==================== Minor ==================== */
try{ document.getElementById('yearCopy').textContent = new Date().getFullYear(); }catch{}
