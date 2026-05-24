import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend
} from "recharts";
import {
  Wallet, Plus, Mic, MicOff, Home, List, BarChart3, Settings,
  Download, ArrowUpRight, ArrowDownRight, Edit3, Trash2, X, Check,
  ChevronRight, ChevronLeft, Sparkles, RefreshCw, TrendingUp,
  TrendingDown, Search, Tag, FileDown, Filter, Eye, EyeOff,
  CheckCircle, AlertCircle, PiggyBank, CreditCard, LogOut, User, Mail, Shield
} from "lucide-react";

// ─── Firebase — npm install firebase ─────────────────────
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, sendPasswordResetEmail
} from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, collection, getDocs
} from "firebase/firestore";

// ═══════════════════════════════════════════════════════════
//  🔧 KONFIGURASI — isi sebelum deploy ke Vercel
// ═══════════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC7ZoqG00x6-oZHXlTzk7frKTUh5VkCqmY",
  authDomain: "vault-app-4bacb.firebaseapp.com",
  projectId: "vault-app-4bacb",
  storageBucket: "vault-app-4bacb.firebasestorage.app",
  messagingSenderId: "645133095463",
  appId: "1:645133095463:web:927514084e8908cc53f402",
  measurementId: "G-6V63JXXMB9"
};
// 👑 Email akun kamu (admin) — satu-satunya yang bisa lihat semua data
const ADMIN_EMAIL = "zaidan1408@gmail.com";

const FB_ON = FIREBASE_CONFIG.apiKey !== "AIzaSyC7ZoqG00x6-oZHXlTzk7frKTUh5VkCqmY";
let fbAuth = null, fbDb = null;
if (FB_ON) {
  try {
    const fbApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    fbAuth = getAuth(fbApp);
    fbDb   = getFirestore(fbApp);
  } catch(e) { console.warn("Firebase init failed:", e); }
}

// ═══════════════════ CONSTANTS ═══════════════════
const C = {
  bg: '#06080E', surface: '#0B0E19', card: '#101624', cardHov: '#141D2E',
  border: '#1C2840', text: '#D8E4FF', muted: '#3D5580',
  gold: '#C9913A', goldL: '#E0A84E', goldD: '#9B6F28',
  income: '#1BC278', expense: '#FF3D60', blue: '#4F7EFF',
};

const PALETTE = ['#C9913A','#4F7EFF','#1BC278','#FF3D60','#8B5CF6','#38BDF8','#F472B6','#34D399','#FB923C','#60A5FA','#A78BFA','#4ADE80'];

const WALLET_TYPES = [
  { value:'bank', label:'Rekening Bank', emoji:'🏦' },
  { value:'cash', label:'Tunai / Cash', emoji:'💵' },
  { value:'ewallet', label:'E-Wallet', emoji:'📱' },
  { value:'savings', label:'Tabungan', emoji:'🐷' },
  { value:'investment', label:'Investasi', emoji:'📊' },
];

const DEF_INC = [
  {name:'Gaji',emoji:'💼',color:'#1BC278'},{name:'Freelance',emoji:'💻',color:'#4F7EFF'},
  {name:'Bonus',emoji:'🎁',color:'#C9913A'},{name:'Investasi',emoji:'📈',color:'#8B5CF6'},
  {name:'Transfer Masuk',emoji:'📥',color:'#34D399'},{name:'Lainnya',emoji:'💰',color:'#3D5580'},
];

const DEF_EXP = [
  {name:'Makan & Minum',emoji:'🍔',color:'#FB923C'},{name:'Transportasi',emoji:'🚗',color:'#38BDF8'},
  {name:'Belanja',emoji:'🛒',color:'#F472B6'},{name:'Hiburan',emoji:'🎮',color:'#8B5CF6'},
  {name:'Kos / Sewa',emoji:'🏠',color:'#FF3D60'},{name:'Kesehatan',emoji:'💊',color:'#4ADE80'},
  {name:'Tagihan',emoji:'⚡',color:'#FBBF24'},{name:'Perawatan Diri',emoji:'🛁',color:'#F9A8D4'},
  {name:'Pendidikan',emoji:'📚',color:'#60A5FA'},{name:'Olahraga',emoji:'🏋️',color:'#6EE7B7'},
  {name:'Lainnya',emoji:'💸',color:'#3D5580'},
];

const EMOJIS = ['😊','🍔','🚗','🏠','💊','📚','🎮','✈️','🎁','💼','📱','⚡','🛒','☕','💅','🏋️','🐾','🎨','🎵','💡','🎬','📦','🔧','🌿'];

// ═══════════════════ HELPERS ═══════════════════
const uid = () => Math.random().toString(36).slice(2,10);
const fmt = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0,maximumFractionDigits:0}).format(n||0);
const fmtDate = d => { try { return new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); } catch{return d;} };
const todayStr = () => new Date().toISOString().split('T')[0];
const monthStr = (d) => d?.slice(0,7) || todayStr().slice(0,7);
const currentMonth = () => todayStr().slice(0,7);
const monthLabel = m => { const [,mo]=m.split('-'); return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][+mo-1]; };

// ─── LocalStorage helpers ─────────────────────────────────
const LS = {
  get: (k,fb) => { try{ const v=localStorage.getItem(k); return v!==null?JSON.parse(v):fb; }catch{return fb;} },
  set: (k,v)  => { try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch{return false;} },
  clear: ()   => { try{ ['vault_wallets','vault_categories','vault_transactions','vault_ready'].forEach(k=>localStorage.removeItem(k)); }catch{} },
  ok: ()      => { try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return true; }catch{return false;} },
};

// ─── Firestore helpers ────────────────────────────────────
const saveVault = async (uid, data) => {
  if(!fbDb) return;
  try{ await setDoc(doc(fbDb,'vaults',uid), {...data, lastUpdated:new Date().toISOString()}, {merge:true}); }catch(e){console.warn('Firestore save:',e);}
};
const loadVault = async (uid) => {
  if(!fbDb) return null;
  try{ const s=await getDoc(doc(fbDb,'vaults',uid)); return s.exists()?s.data():null; }catch{return null;}
};
const loadAllVaults = async () => {
  if(!fbDb) return [];
  try{ const s=await getDocs(collection(fbDb,'vaults')); return s.docs.map(d=>({uid:d.id,...d.data()})); }catch(e){ console.warn('loadAllVaults:',e); return []; }
};

// ═══════════════════ CLAUDE API ═══════════════════
async function parseVoice(text, wallets, categories) {
  const wl = wallets.map(w=>w.name).join(', ');
  const ic = categories.filter(c=>c.type==='income'||c.type==='both').map(c=>c.name).join(', ');
  const ec = categories.filter(c=>c.type==='expense'||c.type==='both').map(c=>c.name).join(', ');
  const prompt = `Kamu parser transaksi keuangan Indonesia. Extract info dari teks dan return HANYA JSON valid.\n\nWallet: ${wl}\nKategori Income: ${ic}\nKategori Expense: ${ec}\nHari ini: ${todayStr()}\n\nAturan:\n- "25rb/25ribu/25k"=25000, "1jt/1juta"=1000000, "500k"=500000\n- beli/bayar/makan/belanja/keluar/habis/isi=expense\n- gaji/terima/dapat/masuk/transfer dari=income\n- Pilih wallet & kategori terdekat dari list\n\nFormat JSON: {"type":"income|expense","amount":integer,"description":"max 40 char","category":"dari list","wallet":"dari list","date":"YYYY-MM-DD"}\n\nTeks: "${text}"\n\nJSON:`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,messages:[{role:"user",content:prompt}]})});
    const d = await r.json();
    return JSON.parse((d.content?.[0]?.text||'').replace(/```json|```/g,'').trim());
  } catch(e) { return null; }
}

// ═══════════════════ STYLES ═══════════════════
const S = {
  input: {background:C.surface,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:'10px 14px',width:'100%',outline:'none',fontSize:14,fontFamily:'inherit'},
  btnPrimary: {background:`linear-gradient(135deg, ${C.gold}, ${C.goldL})`,color:'#060208',fontWeight:700,border:'none',borderRadius:8,cursor:'pointer',fontSize:14,letterSpacing:'0.3px',transition:'opacity .15s'},
  btnGhost: {background:'transparent',border:`1px solid ${C.border}`,color:C.text,borderRadius:8,cursor:'pointer',fontSize:14,transition:'all .15s'},
  btnDanger: {background:'rgba(255,61,96,.1)',border:`1px solid rgba(255,61,96,.3)`,color:C.expense,borderRadius:8,cursor:'pointer',fontSize:14},
  card: {background:C.card,border:`1px solid ${C.border}`,borderRadius:12},
};

// ═══════════════════ ONBOARDING ═══════════════════
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState({
    income: DEF_INC.map((c,i)=>({...c, id:uid(), type:'income', color:c.color||PALETTE[i%PALETTE.length]})),
    expense: DEF_EXP.map((c,i)=>({...c, id:uid(), type:'expense', color:c.color||PALETTE[i%PALETTE.length]})),
  });
  const [wForm, setWForm] = useState({name:'',type:'bank',balance:'',color:PALETTE[0],emoji:'🏦'});
  const [catTab, setCatTab] = useState('income');
  const [catForm, setCatForm] = useState({name:'',emoji:'😊',color:PALETTE[1]});
  const [catFormVisible, setCatFormVisible] = useState(false);

  const addWallet = () => {
    if (!wForm.name || wForm.balance === '') return;
    setWallets(prev=>[...prev,{...wForm,id:uid(),balance:parseFloat(wForm.balance)||0}]);
    const wt = WALLET_TYPES.find(t=>t.value===wForm.type);
    setWForm({name:'',type:'bank',balance:'',color:PALETTE[wallets.length%PALETTE.length],emoji:wt?.emoji||'🏦'});
  };

  const removeWallet = (id) => setWallets(prev=>prev.filter(w=>w.id!==id));

  const addCat = () => {
    if (!catForm.name) return;
    setCategories(prev=>({...prev,[catTab]:[...prev[catTab],{...catForm,id:uid(),type:catTab}]}));
    setCatForm({name:'',emoji:'😊',color:PALETTE[categories[catTab].length%PALETTE.length]});
    setCatFormVisible(false);
  };

  const removeCat = (tab, id) => setCategories(prev=>({...prev,[tab]:prev[tab].filter(c=>c.id!==id)}));

  const handleComplete = () => {
    if (wallets.length === 0) return;
    onComplete({wallets, categories:[...categories.income,...categories.expense]});
  };

  const stepsLabel = ['Selamat Datang','Setup Wallet','Setup Kategori','Selesai!'];
  const bg = {background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16};
  const box = {...S.card,width:'100%',maxWidth:520,overflow:'hidden'};

  return (
    <div style={bg}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0} body{background:${C.bg}} input,select,textarea,button{font-family:inherit}
        .vi:focus{border-color:${C.gold}!important} .vi::placeholder{color:${C.muted}} .vi option{background:${C.surface};color:${C.text}}
        .chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:${C.surface};border:1px solid ${C.border};border-radius:100px;font-size:13px;color:${C.text}}
        .chip:hover{border-color:${C.expense}}
        .hov:hover{opacity:.85} .scale:hover{transform:translateY(-1px)} .scale:active{transform:scale(.97)}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
      `}</style>

      <div style={box}>
        {/* Progress bar */}
        <div style={{height:3,background:C.surface}}>
          <div style={{height:'100%',background:`linear-gradient(90deg,${C.gold},${C.goldL})`,width:`${((step+1)/4)*100}%`,transition:'width .4s ease'}}/>
        </div>

        {/* Steps indicator */}
        <div style={{display:'flex',justifyContent:'center',gap:8,padding:'20px 24px 0',flexWrap:'wrap'}}>
          {stepsLabel.map((l,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:i<=step?C.gold:C.muted}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:i<step?C.gold:i===step?'rgba(201,145,58,.2)':C.surface,border:`1px solid ${i<=step?C.gold:C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:i<step?C.bg:i===step?C.gold:C.muted}}>
                {i<step?'✓':i+1}
              </div>
              <span style={{fontWeight:i===step?600:400}}>{l}</span>
              {i<3&&<span style={{color:C.border}}>›</span>}
            </div>
          ))}
        </div>

        <div style={{padding:28}}>

          {/* STEP 0: WELCOME */}
          {step===0&&(
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:56,marginBottom:16}}>🏦</div>
              <h1 style={{fontFamily:'Syne,sans-serif',fontSize:36,fontWeight:800,color:C.text,letterSpacing:'-1px',marginBottom:8}}>
                VAULT
              </h1>
              <p style={{color:C.muted,fontSize:15,marginBottom:8}}>Personal Money Manager</p>
              <p style={{color:C.gold,fontSize:13,marginBottom:28,fontStyle:'italic'}}>Financial clarity, redefined.</p>
              <div style={{...S.card,padding:16,marginBottom:24,textAlign:'left'}}>
                {[['🏦','Multi-Wallet Tracking','Kelola BRI, BCA, GoPay, dll.'],['🎤','Voice Input + AI','Ngomong aja, otomatis diparse'],['📊','Analytics Lengkap','Grafik, breakdown kategori, trend'],['📤','Export Data','CSV, JSON, Print PDF']].map(([e,t,d])=>(
                  <div key={t} style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:12}}>
                    <span style={{fontSize:20}}>{e}</span>
                    <div><p style={{fontWeight:600,fontSize:13,color:C.text,marginBottom:2}}>{t}</p><p style={{fontSize:12,color:C.muted}}>{d}</p></div>
                  </div>
                ))}
              </div>
              <button className="scale" style={{...S.btnPrimary,padding:'14px 32px',borderRadius:10,fontSize:15,width:'100%'}} onClick={()=>setStep(1)}>
                Mulai Setup →
              </button>
            </div>
          )}

          {/* STEP 1: WALLETS */}
          {step===1&&(
            <div>
              <h2 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color:C.text,marginBottom:4}}>💳 Setup Wallet</h2>
              <p style={{color:C.muted,fontSize:13,marginBottom:20}}>Tambahkan wallet & saldo awalnya. Minimal 1 wallet.</p>

              {/* Added wallets */}
              {wallets.length>0&&(
                <div style={{marginBottom:16}}>
                  {wallets.map(w=>(
                    <div key={w.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',...S.card,marginBottom:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:36,height:36,borderRadius:8,background:w.color+'22',border:`1px solid ${w.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{w.emoji}</div>
                        <div>
                          <p style={{fontWeight:600,fontSize:14,color:C.text}}>{w.name}</p>
                          <p style={{fontSize:12,color:C.muted}}>{WALLET_TYPES.find(t=>t.value===w.type)?.label} • {fmt(w.balance)}</p>
                        </div>
                      </div>
                      <button className="hov" style={{...S.btnDanger,padding:'6px 10px',fontSize:12}} onClick={()=>removeWallet(w.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Wallet form */}
              <div style={{...S.card,padding:16,marginBottom:16}}>
                <p style={{fontSize:13,fontWeight:600,color:C.gold,marginBottom:12}}>➕ Tambah Wallet</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <input className="vi" style={{...S.input}} placeholder="Nama wallet (mis: BRI)" value={wForm.name} onChange={e=>setWForm(p=>({...p,name:e.target.value}))}/>
                  <select className="vi" style={{...S.input}} value={wForm.type} onChange={e=>{const wt=WALLET_TYPES.find(t=>t.value===e.target.value);setWForm(p=>({...p,type:e.target.value,emoji:wt?.emoji||'🏦'}))}}>
                    {WALLET_TYPES.map(t=><option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
                <input className="vi" style={{...S.input,marginBottom:8}} type="number" placeholder="Saldo awal (Rp)" value={wForm.balance} onChange={e=>setWForm(p=>({...p,balance:e.target.value}))}/>
                <div style={{marginBottom:10}}>
                  <p style={{fontSize:12,color:C.muted,marginBottom:6}}>Warna</p>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {PALETTE.map(col=><div key={col} onClick={()=>setWForm(p=>({...p,color:col}))} style={{width:22,height:22,borderRadius:'50%',background:col,cursor:'pointer',border:wForm.color===col?`2px solid ${C.text}`:'2px solid transparent',transition:'border .15s'}}/>)}
                  </div>
                </div>
                <button className="scale" style={{...S.btnPrimary,padding:'10px 18px',width:'100%'}} onClick={addWallet}>+ Tambah Wallet</button>
              </div>

              <div style={{display:'flex',gap:8}}>
                <button className="scale" style={{...S.btnGhost,padding:'12px 18px'}} onClick={()=>setStep(0)}>← Back</button>
                <button className="scale" style={{...S.btnPrimary,padding:'12px 18px',flex:1,opacity:wallets.length===0?.5:1}} onClick={()=>wallets.length>0&&setStep(2)} disabled={wallets.length===0}>
                  Lanjut → Kategori
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CATEGORIES */}
          {step===2&&(
            <div>
              <h2 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color:C.text,marginBottom:4}}>🏷️ Setup Kategori</h2>
              <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Sudah ada default. Kamu bisa tambah atau hapus.</p>

              <div style={{display:'flex',gap:0,marginBottom:16,background:C.surface,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
                {['income','expense'].map(t=>(
                  <button key={t} style={{flex:1,padding:'8px',borderRadius:6,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,background:catTab===t?(t==='income'?'rgba(27,194,120,.2)':'rgba(255,61,96,.2)'):'transparent',color:catTab===t?(t==='income'?C.income:C.expense):C.muted,transition:'all .15s'}} onClick={()=>setCatTab(t)}>
                    {t==='income'?'📈 Pemasukan':'📉 Pengeluaran'} ({categories[t].length})
                  </button>
                ))}
              </div>

              <div style={{maxHeight:200,overflowY:'auto',marginBottom:12}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {categories[catTab].map(c=>(
                    <div key={c.id} className="chip">
                      <span style={{fontSize:14}}>{c.emoji}</span>
                      <span style={{fontSize:12}}>{c.name}</span>
                      <span onClick={()=>removeCat(catTab,c.id)} style={{cursor:'pointer',color:C.expense,fontSize:11,marginLeft:2}}>✕</span>
                    </div>
                  ))}
                </div>
              </div>

              {!catFormVisible?(
                <button className="scale" style={{...S.btnGhost,padding:'8px 14px',fontSize:13,marginBottom:16,width:'100%'}} onClick={()=>setCatFormVisible(true)}>+ Tambah Kategori</button>
              ):(
                <div style={{...S.card,padding:12,marginBottom:12}}>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    <select style={{...S.input,width:64,padding:'8px',textAlign:'center'}} className="vi" value={catForm.emoji} onChange={e=>setCatForm(p=>({...p,emoji:e.target.value}))}>
                      {EMOJIS.map(em=><option key={em} value={em}>{em}</option>)}
                    </select>
                    <input className="vi" style={{...S.input}} placeholder={`Nama kategori ${catTab==='income'?'pemasukan':'pengeluaran'}`} value={catForm.name} onChange={e=>setCatForm(p=>({...p,name:e.target.value}))}/>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                    {PALETTE.map(col=><div key={col} onClick={()=>setCatForm(p=>({...p,color:col}))} style={{width:20,height:20,borderRadius:'50%',background:col,cursor:'pointer',border:catForm.color===col?`2px 
