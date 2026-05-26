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
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
// 👑 Email akun kamu (admin) — satu-satunya yang bisa lihat semua data
const ADMIN_EMAIL = "YOUR_EMAIL@gmail.com";

const FB_ON = FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";
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
                    {PALETTE.map(col=><div key={col} onClick={()=>setCatForm(p=>({...p,color:col}))} style={{width:20,height:20,borderRadius:'50%',background:col,cursor:'pointer',border:catForm.color===col?`2px solid ${C.text}`:'2px solid transparent'}}/>)}
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button className="scale" style={{...S.btnGhost,padding:'8px 12px',fontSize:12}} onClick={()=>setCatFormVisible(false)}>Batal</button>
                    <button className="scale" style={{...S.btnPrimary,padding:'8px 12px',fontSize:12,flex:1}} onClick={addCat}>Tambah</button>
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8}}>
                <button className="scale" style={{...S.btnGhost,padding:'12px 18px'}} onClick={()=>setStep(1)}>← Back</button>
                <button className="scale" style={{...S.btnPrimary,padding:'12px 18px',flex:1}} onClick={()=>setStep(3)}>Lanjut → Selesai</button>
              </div>
            </div>
          )}

          {/* STEP 3: DONE */}
          {step===3&&(
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:52,marginBottom:12}}>🎉</div>
              <h2 style={{fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:700,color:C.text,marginBottom:8}}>Setup Selesai!</h2>
              <p style={{color:C.muted,fontSize:14,marginBottom:24}}>Siap untuk mulai tracking keuangan kamu.</p>
              <div style={{...S.card,padding:16,marginBottom:24,textAlign:'left'}}>
                <p style={{fontSize:13,color:C.muted,marginBottom:10}}>Ringkasan Setup:</p>
                <div style={{display:'flex',gap:12}}>
                  <div style={{flex:1,background:C.surface,borderRadius:8,padding:12,textAlign:'center'}}>
                    <p style={{fontSize:24,fontFamily:'DM Mono,monospace',fontWeight:500,color:C.gold}}>{wallets.length}</p>
                    <p style={{fontSize:12,color:C.muted}}>Wallet</p>
                  </div>
                  <div style={{flex:1,background:C.surface,borderRadius:8,padding:12,textAlign:'center'}}>
                    <p style={{fontSize:24,fontFamily:'DM Mono,monospace',fontWeight:500,color:C.income}}>{categories.income.length}</p>
                    <p style={{fontSize:12,color:C.muted}}>Kat. Masuk</p>
                  </div>
                  <div style={{flex:1,background:C.surface,borderRadius:8,padding:12,textAlign:'center'}}>
                    <p style={{fontSize:24,fontFamily:'DM Mono,monospace',fontWeight:500,color:C.expense}}>{categories.expense.length}</p>
                    <p style={{fontSize:12,color:C.muted}}>Kat. Keluar</p>
                  </div>
                </div>
                <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                  <p style={{fontSize:13,color:C.muted,marginBottom:6}}>Total Saldo Awal:</p>
                  <p style={{fontFamily:'DM Mono,monospace',fontSize:20,fontWeight:500,color:C.text}}>{fmt(wallets.reduce((s,w)=>s+w.balance,0))}</p>
                </div>
              </div>
              <button className="scale" style={{...S.btnPrimary,padding:'14px',width:'100%',fontSize:15}} onClick={handleComplete}>
                🚀 Mulai Tracking!
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ TRANSACTION MODAL ═══════════════════
function TxModal({ wallets, categories, editTx, onClose, onSave }) {
  const [form, setForm] = useState({
    type: editTx?.type||'expense',
    amount: editTx?.amount||'',
    walletId: editTx?.walletId||wallets[0]?.id||'',
    categoryId: editTx?.categoryId||'',
    description: editTx?.description||'',
    date: editTx?.date||todayStr(),
    note: editTx?.note||'',
  });
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState('form');
  const [micError, setMicError] = useState('');
  const [micSupported] = useState(()=>!!(window.SpeechRecognition||window.webkitSpeechRecognition));
  const recogRef = useRef(null);

  const filteredCats = categories.filter(c=>c.type===form.type||c.type==='both');

  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const startListening = () => {
    setMicError('');
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) { setMicError('Browser tidak support mikrofon. Gunakan input teks di bawah.'); return; }
    try {
      const r = new SR();
      r.lang='id-ID'; r.continuous=false; r.interimResults=false;
      r.onresult = e => {
        const transcript = e.results?.[0]?.[0]?.transcript||'';
        if(transcript) { setVoiceText(transcript); setMicError(''); }
        else setMicError('Tidak terdengar. Coba lagi.');
        setListening(false);
      };
      r.onerror = (e) => {
        setListening(false);
        const errMap = {'not-allowed':'Izin mikrofon ditolak. Cek izin di browser.','no-speech':'Tidak ada suara. Coba lagi.','network':'Gagal koneksi jaringan.','aborted':'Rekaman dibatalkan.'};
        setMicError(errMap[e.error]||'Gagal rekam. Gunakan input teks.');
      };
      r.onend = () => setListening(false);
      recogRef.current = r;
      r.start();
      setListening(true); setVoiceText(''); setAiResult(null); setAiStatus('');
    } catch(e) {
      setMicError('Gagal akses mikrofon. Gunakan input teks.');
      setListening(false);
    }
  };

  const stopListening = () => { try{recogRef.current?.stop();}catch(e){} setListening(false); };

  const handleParse = async (txt) => {
    const t = (txt||voiceText||textInput||'').trim();
    if (!t) { setMicError('Tulis atau ucapkan deskripsi transaksi dulu.'); return; }
    setAiStatus('parsing'); setMicError('');
    try {
      const result = await parseVoice(t, wallets, categories);
      if (result && result.amount && result.type) {
        setAiResult(result); setAiStatus('done');
      } else { setAiStatus('error'); }
    } catch(e) { setAiStatus('error'); }
  };

  const applyResult = () => {
    if (!aiResult) return;
    const wallet = wallets.find(w=>w.name.toLowerCase()===aiResult.wallet?.toLowerCase())||wallets[0];
    const cat = categories.find(c=>c.name.toLowerCase()===aiResult.category?.toLowerCase()&&(c.type===aiResult.type||c.type==='both'));
    setForm(p=>({...p,
      type: aiResult.type||p.type,
      amount: aiResult.amount||p.amount,
      walletId: wallet?.id||p.walletId,
      categoryId: cat?.id||p.categoryId,
      description: aiResult.description||p.description,
      date: aiResult.date||p.date,
    }));
    setAiResult(null); setAiStatus(''); setVoiceText(''); setTextInput('');
    setInputMode('form');
  };

  const handleSubmit = () => {
    if (!form.amount||!form.walletId||!form.categoryId) return;
    onSave({...form, amount:parseFloat(form.amount)||0});
  };

  const isValid = form.amount&&form.walletId&&form.categoryId&&form.description;

  const overlayStyle = {position:'fixed',inset:0,background:'rgba(0,0,0,.75)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0 0 16px'};
  const boxStyle = {background:C.card,border:`1px solid ${C.border}`,borderRadius:'16px 16px 12px 12px',width:'100%',maxWidth:540,maxHeight:'92vh',overflowY:'auto'};

  return (
    <div style={overlayStyle} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={boxStyle}>
        {/* Header */}
        <div style={{padding:'20px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h3 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:18,color:C.text}}>{editTx?'Edit Transaksi':'Tambah Transaksi'}</h3>
          <button onClick={onClose} style={{...S.btnGhost,padding:'6px 10px'}}>✕</button>
        </div>

        <div style={{padding:'0 20px 24px'}}>
          {/* Type toggle */}
          <div style={{display:'flex',gap:0,background:C.surface,borderRadius:8,padding:3,border:`1px solid ${C.border}`,marginBottom:16}}>
            {['expense','income'].map(t=>(
              <button key={t} onClick={()=>set('type',t)} style={{flex:1,padding:'9px',borderRadius:6,border:'none',cursor:'pointer',fontWeight:700,fontSize:13,background:form.type===t?(t==='expense'?'rgba(255,61,96,.2)':'rgba(27,194,120,.2)'):'transparent',color:form.type===t?(t==='expense'?C.expense:C.income):C.muted,transition:'all .15s'}}>
                {t==='expense'?'📉 Pengeluaran':'📈 Pemasukan'}
              </button>
            ))}
          </div>

          {/* Input mode tabs */}
          <div style={{display:'flex',gap:6,marginBottom:14}}>
            {[['form','📝 Form'],['voice','🎤 Voice / AI']].map(([m,l])=>(
              <button key={m} onClick={()=>setInputMode(m)} style={{padding:'7px 14px',borderRadius:6,border:`1px solid ${inputMode===m?C.gold:C.border}`,background:inputMode===m?'rgba(201,145,58,.1)':'transparent',color:inputMode===m?C.gold:C.muted,fontSize:13,cursor:'pointer',fontWeight:inputMode===m?600:400}}>
                {l}
              </button>
            ))}
          </div>

          {/* VOICE MODE */}
          {inputMode==='voice'&&(
            <div style={{...S.card,padding:16,marginBottom:16}}>
              <p style={{fontSize:13,color:C.muted,marginBottom:12}}>Ceritakan transaksinya — AI akan otomatis mengisi form.</p>
              <p style={{fontSize:12,color:C.gold,marginBottom:12,fontStyle:'italic'}}>Contoh: "tadi beli makan siang 25rb dari BRI" atau "gaji bulan ini masuk 5jt ke BCA"</p>

              {/* Mic button */}
              {micSupported&&(
                <div style={{marginBottom:12}}>
                  <button onClick={listening?stopListening:startListening} style={{...S.btnPrimary,padding:'12px 16px',borderRadius:8,display:'flex',alignItems:'center',gap:8,fontSize:13,width:'100%',justifyContent:'center',background:listening?`linear-gradient(135deg,${C.expense},#ff6b8a)`:undefined}}>
                    {listening?(<><span style={{width:10,height:10,borderRadius:'50%',background:'#fff',display:'inline-block',animation:'pulse 1s ease-in-out infinite'}}/>  Mendengarkan... (tap untuk stop)</>):(<>🎤 Mulai Rekam Suara</>)}
                  </button>
                </div>
              )}

              {/* Error message */}
              {micError&&(
                <div style={{background:'rgba(255,61,96,.1)',border:`1px solid rgba(255,61,96,.3)`,borderRadius:8,padding:10,marginBottom:10}}>
                  <p style={{fontSize:13,color:C.expense}}>⚠️ {micError}</p>
                </div>
              )}

              {/* Separator */}
              {micSupported&&<p style={{textAlign:'center',fontSize:12,color:C.muted,marginBottom:10}}>— atau ketik langsung —</p>}

              {/* Text input */}
              <div style={{marginBottom:12}}>
                <textarea className="vi" style={{...S.input,height:72,resize:'none'}} placeholder={'Contoh:\n"beli makan siang di warteg 25rb dari BRI"\n"gaji bulan ini 5jt masuk ke BCA"'} value={textInput} onChange={e=>setTextInput(e.target.value)}/>
                <button className="scale" onClick={()=>handleParse(textInput)} disabled={aiStatus==='parsing'} style={{...S.btnPrimary,padding:'10px',width:'100%',marginTop:6,fontSize:13,opacity:aiStatus==='parsing'?.7:1}}>
                  {aiStatus==='parsing'?'⏳ AI sedang menganalisis...':'✨ Parse dengan AI'}
                </button>
              </div>

              {/* Voice transcript */}
              {voiceText&&(
                <div style={{background:C.surface,borderRadius:8,padding:12,marginBottom:12,border:`1px solid ${C.border}`}}>
                  <p style={{fontSize:11,color:C.muted,marginBottom:4}}>🎤 Terdengar:</p>
                  <p style={{fontSize:14,color:C.text,fontStyle:'italic',marginBottom:8}}>"{voiceText}"</p>
                  <button className="scale" onClick={()=>handleParse(voiceText)} style={{...S.btnPrimary,padding:'8px 14px',fontSize:12,width:'100%'}} disabled={aiStatus==='parsing'}>
                    {aiStatus==='parsing'?'⏳ Menganalisis...':'✨ Parse Suara ini dengan AI'}
                  </button>
                </div>
              )}

              {/* AI result */}
              {aiStatus==='done'&&aiResult&&(
                <div style={{background:'rgba(27,194,120,.08)',border:`1px solid rgba(27,194,120,.25)`,borderRadius:8,padding:14,marginBottom:8}}>
                  <p style={{fontSize:13,color:C.income,fontWeight:600,marginBottom:10}}>✅ AI berhasil menganalisis:</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:13,marginBottom:12}}>
                    {[['Tipe',aiResult.type==='income'?'📈 Pemasukan':'📉 Pengeluaran'],['Jumlah',fmt(aiResult.amount)],['Deskripsi',aiResult.description||'-'],['Kategori',aiResult.category||'-'],['Wallet',aiResult.wallet||'-'],['Tanggal',aiResult.date||'-']].map(([k,v])=>(
                      <div key={k} style={{background:C.surface,borderRadius:6,padding:'6px 10px'}}>
                        <p style={{color:C.muted,fontSize:10,marginBottom:2}}>{k}</p>
                        <p style={{color:C.text,fontWeight:500,fontSize:13}}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <button className="scale" onClick={applyResult} style={{...S.btnPrimary,padding:'10px 14px',fontSize:13,width:'100%'}}>✓ Terapkan ke Form →</button>
                </div>
              )}
              {aiStatus==='error'&&(
                <div style={{background:'rgba(255,61,96,.08)',border:`1px solid rgba(255,61,96,.2)`,borderRadius:8,padding:12}}>
                  <p style={{color:C.expense,fontSize:13}}>❌ AI tidak bisa parse. Coba tulis lebih detail, contoh: "beli kopi 25rb dari BRI"</p>
                </div>
              )}
            </div>
          )}

          {/* FORM MODE */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Jumlah (Rp)</label>
              <input className="vi" style={{...S.input}} type="number" placeholder="0" value={form.amount} onChange={e=>set('amount',e.target.value)}/>
            </div>
            <div>
              <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Tanggal</label>
              <input className="vi" style={{...S.input}} type="date" value={form.date} onChange={e=>set('date',e.target.value)}/>
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Deskripsi *</label>
            <input className="vi" style={{...S.input}} placeholder="Deskripsi transaksi" value={form.description} onChange={e=>set('description',e.target.value)}/>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Wallet *</label>
              <select className="vi" style={{...S.input}} value={form.walletId} onChange={e=>set('walletId',e.target.value)}>
                <option value="">Pilih wallet</option>
                {wallets.map(w=><option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Kategori *</label>
              <select className="vi" style={{...S.input}} value={form.categoryId} onChange={e=>set('categoryId',e.target.value)}>
                <option value="">Pilih kategori</option>
                {filteredCats.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Catatan (opsional)</label>
            <textarea className="vi" style={{...S.input,height:60,resize:'vertical'}} placeholder="Catatan tambahan..." value={form.note} onChange={e=>set('note',e.target.value)}/>
          </div>

          <div style={{display:'flex',gap:8}}>
            <button className="scale" style={{...S.btnGhost,padding:'12px 20px'}} onClick={onClose}>Batal</button>
            <button className="scale" onClick={handleSubmit} style={{...S.btnPrimary,padding:'12px',flex:1,opacity:isValid?1:.5}} disabled={!isValid}>
              {editTx?'💾 Simpan Perubahan':'+ Tambah Transaksi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ SIDEBAR ═══════════════════
function Sidebar({ view, setView, onAdd, totalBalance, wallets, saveIndicator, lsOk, fbUser, isAdmin, localMode, onLogout }) {
  const navItems = [
    {id:'dashboard',icon:'🏠',label:'Dashboard'},
    {id:'transactions',icon:'📋',label:'Transaksi'},
    {id:'analytics',icon:'📊',label:'Analitik'},
    {id:'milestones',icon:'🎯',label:'Milestone'},
    {id:'wallets',icon:'💳',label:'Wallet'},
    {id:'categories',icon:'🏷️',label:'Kategori'},
    {id:'export',icon:'📤',label:'Export'},
  ];
  return (
    <div style={{position:'fixed',top:0,left:0,bottom:0,width:220,background:C.surface,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',zIndex:50,overflowY:'auto'}} className="sidebar">
      {/* Logo */}
      <div style={{padding:'18px 16px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
          <span style={{fontSize:20}}>🏦</span>
          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:19,color:C.text,letterSpacing:'-0.5px'}}>VAULT</h1>
        </div>
        <p style={{fontSize:10,color:C.muted}}>Money Manager</p>
      </div>

      {/* User info */}
      <div style={{padding:'0 10px',marginBottom:10}}>
        {fbUser ? (
          <div style={{background:C.card,border:`1px solid ${isAdmin?C.gold:C.border}`,borderRadius:10,padding:'10px 12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:isAdmin?`${C.gold}30`:`${C.blue}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>
                {isAdmin?'👑':'👤'}
              </div>
              <div style={{minWidth:0,flex:1}}>
                <p style={{fontSize:11,fontWeight:600,color:isAdmin?C.gold:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {fbUser.displayName||fbUser.email?.split('@')[0]}
                </p>
                <p style={{fontSize:9,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{fbUser.email}</p>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              {isAdmin&&<span style={{fontSize:9,background:`${C.gold}20`,color:C.gold,padding:'2px 6px',borderRadius:4,fontWeight:700}}>ADMIN</span>}
              <button onClick={onLogout} style={{marginLeft:'auto',background:'none',border:`1px solid ${C.border}`,borderRadius:5,cursor:'pointer',color:C.muted,fontSize:10,padding:'3px 8px',display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:10}}>⎋</span> Logout
              </button>
            </div>
          </div>
        ) : localMode ? (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px'}}>
            <p style={{fontSize:11,color:C.muted}}>👤 Mode Lokal</p>
            <p style={{fontSize:9,color:C.muted,marginTop:2}}>Data hanya di browser ini</p>
          </div>
        ) : null}
      </div>

      {/* Total balance */}
      <div style={{padding:'0 10px',marginBottom:10}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 14px'}}>
          <p style={{fontSize:10,color:C.muted,marginBottom:2}}>Total Saldo</p>
          <p style={{fontFamily:'DM Mono,monospace',fontWeight:500,fontSize:15,color:C.text}}>{fmt(totalBalance)}</p>
          <p style={{fontSize:9,color:C.muted,marginTop:2}}>{wallets.length} wallet aktif</p>
        </div>
      </div>

      <nav style={{flex:1,padding:'0 8px'}}>
        {/* Admin Panel link */}
        {isAdmin&&(
          <button onClick={()=>setView('admin')} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',width:'100%',border:'none',cursor:'pointer',borderRadius:8,marginBottom:6,background:view==='admin'?'rgba(201,145,58,.15)':'rgba(201,145,58,.06)',color:C.gold,fontWeight:600,fontSize:13,textAlign:'left',borderLeft:view==='admin'?`2px solid ${C.gold}`:'2px solid transparent',transition:'all .15s'}}>
            <span style={{fontSize:15}}>👑</span>Admin Panel
          </button>
        )}
        {navItems.map(item=>(
          <button key={item.id} onClick={()=>setView(item.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',width:'100%',border:'none',cursor:'pointer',borderRadius:8,marginBottom:2,background:view===item.id?'rgba(201,145,58,.1)':'transparent',color:view===item.id?C.gold:C.muted,fontWeight:view===item.id?600:400,fontSize:13,textAlign:'left',borderLeft:view===item.id?`2px solid ${C.gold}`:'2px solid transparent',transition:'all .15s'}}>
            <span style={{fontSize:15}}>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>

      <div style={{padding:'10px 10px 14px'}}>
        {lsOk ? (
          <div style={{textAlign:'center',marginBottom:6,height:14}}>
            {saveIndicator==='saved'&&<p style={{fontSize:9,color:C.income}}>✓ Tersimpan otomatis</p>}
          </div>
        ) : (
          <div style={{background:'rgba(201,145,58,.08)',borderRadius:5,padding:'5px 8px',marginBottom:6}}>
            <p style={{fontSize:9,color:C.gold,textAlign:'center'}}>⚠️ Preview — data tidak tersimpan</p>
          </div>
        )}
        <button className="scale" onClick={onAdd} style={{...S.btnPrimary,padding:'11px',width:'100%',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
          <span style={{fontSize:15}}>+</span> Transaksi
        </button>
      </div>
    </div>
  );
}

// ═══════════════════ BOTTOM NAV ═══════════════════
function BottomNav({ view, setView, onAdd }) {
  const items = [
    {id:'dashboard',emoji:'🏠',label:'Home'},
    {id:'transactions',emoji:'📋',label:'Transaksi'},
    {id:'milestones',emoji:'🎯',label:'Milestone'},
    {id:'analytics',emoji:'📊',label:'Analitik'},
    {id:'wallets',emoji:'💳',label:'Wallet'},
  ];
  return (
    <div className="bottomnav" style={{position:'fixed',bottom:0,left:0,right:0,background:C.surface,borderTop:`1px solid ${C.border}`,display:'flex',zIndex:100,height:64}}>
      {items.map((item,i)=>(
        <button key={item.id} onClick={i===2?onAdd:()=>setView(item.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',border:'none',background:i===2?'transparent':'transparent',cursor:'pointer',gap:2}}>
          {i===2?(
            <div style={{width:42,height:42,borderRadius:'50%',background:`linear-gradient(135deg,${C.gold},${C.goldL})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,marginTop:-10,boxShadow:`0 4px 12px ${C.gold}40`}}>+</div>
          ):(
            <>
              <span style={{fontSize:18}}>{item.emoji}</span>
              <span style={{fontSize:9,color:view===item.id?C.gold:C.muted,fontWeight:view===item.id?600:400}}>{item.label}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════ DASHBOARD ═══════════════════
function Dashboard({ wallets, categories, transactions, totalBalance, onAdd, onEdit, onDelete }) {
  const thisMonth = currentMonth();
  const monthTxs = transactions.filter(t=>monthStr(t.date)===thisMonth);
  const monthInc = monthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const monthExp = monthTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const recent = transactions.slice(0,6);

  const getCat = id => categories.find(c=>c.id===id);
  const getWallet = id => wallets.find(w=>w.id===id);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
        <div>
          <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:22,color:C.text,marginBottom:2}}>Dashboard</h2>
          <p style={{color:C.muted,fontSize:13}}>{new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <button className="scale" onClick={onAdd} style={{...S.btnPrimary,padding:'10px 16px',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
          + Tambah
        </button>
      </div>

      {/* Total balance hero */}
      <div style={{...S.card,padding:20,marginBottom:16,background:`linear-gradient(135deg, ${C.card} 0%, rgba(201,145,58,0.06) 100%)`,borderColor:'rgba(201,145,58,.2)'}}>
        <p style={{fontSize:12,color:C.muted,marginBottom:6,letterSpacing:'1px',textTransform:'uppercase'}}>Total Saldo</p>
        <p style={{fontFamily:'DM Mono,monospace',fontSize:32,fontWeight:500,color:C.text,marginBottom:14}}>{fmt(totalBalance)}</p>
        <div style={{display:'flex',gap:20}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:11}}>▲</span>
            <div><p style={{fontSize:11,color:C.muted}}>Bulan ini masuk</p><p style={{fontFamily:'DM Mono,monospace',fontSize:14,color:C.income,fontWeight:500}}>{fmt(monthInc)}</p></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:11,color:C.expense}}>▼</span>
            <div><p style={{fontSize:11,color:C.muted}}>Bulan ini keluar</p><p style={{fontFamily:'DM Mono,monospace',fontSize:14,color:C.expense,fontWeight:500}}>{fmt(monthExp)}</p></div>
          </div>
        </div>
      </div>

      {/* Wallet cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:20}}>
        {wallets.map(w=>(
          <div key={w.id} style={{...S.card,padding:14,borderColor:w.color+'33',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',right:-10,top:-10,width:60,height:60,borderRadius:'50%',background:w.color+'11'}}/>
            <div style={{fontSize:20,marginBottom:8}}>{w.emoji}</div>
            <p style={{fontSize:12,color:C.muted,marginBottom:2}}>{w.name}</p>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:15,fontWeight:500,color:C.text}}>{fmt(w.balance)}</p>
            <div style={{width:28,height:3,borderRadius:2,background:w.color,marginTop:8,opacity:.6}}/>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div style={{...S.card,overflow:'hidden'}}>
        <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{fontSize:14,fontWeight:600,color:C.text}}>Transaksi Terbaru</h3>
          <span style={{fontSize:12,color:C.muted}}>{transactions.length} total</span>
        </div>
        {recent.length===0?(
          <div style={{padding:32,textAlign:'center'}}>
            <p style={{fontSize:24,marginBottom:8}}>📭</p>
            <p style={{color:C.muted,fontSize:13}}>Belum ada transaksi</p>
            <button className="scale" onClick={onAdd} style={{...S.btnPrimary,padding:'10px 20px',marginTop:12,fontSize:13}}>+ Tambah Transaksi</button>
          </div>
        ):(
          recent.map(tx=>{
            const cat=getCat(tx.categoryId); const wl=getWallet(tx.walletId);
            return (
              <div key={tx.id} style={{display:'flex',alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,gap:12}}>
                <div style={{width:36,height:36,borderRadius:8,background:(cat?.color||C.muted)+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{cat?.emoji||'💸'}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:500,color:C.text,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</p>
                  <p style={{fontSize:11,color:C.muted}}>{wl?.name||'?'} • {fmtDate(tx.date)}</p>
                </div>
                <p style={{fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:500,color:tx.type==='income'?C.income:C.expense,flexShrink:0}}>
                  {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ═══════════════════ TRANSACTION LIST ═══════════════════
function TransactionList({ transactions, wallets, categories, onEdit, onDelete, onAdd }) {
  const [search, setSearch] = useState('');
  const [fWallet, setFWallet] = useState('all');
  const [fType, setFType] = useState('all');
  const [fMonth, setFMonth] = useState('');
  const [fCat, setFCat] = useState('all');
  const [showDel, setShowDel] = useState(null);

  const months = useMemo(()=>[...new Set(transactions.map(t=>monthStr(t.date)))].sort().reverse(),[transactions]);

  const filtered = useMemo(()=>transactions.filter(t=>{
    if(fWallet!=='all'&&t.walletId!==fWallet)return false;
    if(fType!=='all'&&t.type!==fType)return false;
    if(fMonth&&!t.date.startsWith(fMonth))return false;
    if(fCat!=='all'&&t.categoryId!==fCat)return false;
    if(search&&!t.description?.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }),[transactions,fWallet,fType,fMonth,fCat,search]);

  const totalIn = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalOut = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  const getCat = id=>categories.find(c=>c.id===id);
  const getWallet = id=>wallets.find(w=>w.id===id);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:22,color:C.text}}>Transaksi</h2>
        <button className="scale" onClick={onAdd} style={{...S.btnPrimary,padding:'10px 16px',fontSize:13}}>+ Tambah</button>
      </div>

      {/* Filters */}
      <div style={{...S.card,padding:14,marginBottom:14}}>
        <input className="vi" style={{...S.input,marginBottom:10}} placeholder="🔍  Cari transaksi..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8}}>
          <select className="vi" style={{...S.input}} value={fType} onChange={e=>setFType(e.target.value)}>
            <option value="all">Semua Tipe</option>
            <option value="income">📈 Pemasukan</option>
            <option value="expense">📉 Pengeluaran</option>
          </select>
          <select className="vi" style={{...S.input}} value={fWallet} onChange={e=>setFWallet(e.target.value)}>
            <option value="all">Semua Wallet</option>
            {wallets.map(w=><option key={w.id} value={w.id}>{w.emoji} {w.name}</option>)}
          </select>
          <select className="vi" style={{...S.input}} value={fCat} onChange={e=>setFCat(e.target.value)}>
            <option value="all">Semua Kategori</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <select className="vi" style={{...S.input}} value={fMonth} onChange={e=>setFMonth(e.target.value)}>
            <option value="">Semua Bulan</option>
            {months.map(m=><option key={m} value={m}>{monthLabel(m)} {m.split('-')[0]}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
        {[['Total',filtered.length+' transaksi',C.text],['Masuk',fmt(totalIn),C.income],['Keluar',fmt(totalOut),C.expense]].map(([l,v,col])=>(
          <div key={l} style={{...S.card,padding:12,textAlign:'center'}}>
            <p style={{fontSize:11,color:C.muted,marginBottom:3}}>{l}</p>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:500,color:col}}>{v}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{...S.card,overflow:'hidden'}}>
        {filtered.length===0?(
          <div style={{padding:48,textAlign:'center'}}>
            <p style={{fontSize:32,marginBottom:8}}>🔍</p>
            <p style={{color:C.muted,fontSize:14}}>Tidak ada transaksi ditemukan</p>
          </div>
        ):(
          filtered.map(tx=>{
            const cat=getCat(tx.categoryId); const wl=getWallet(tx.walletId);
            return (
              <div key={tx.id} style={{display:'flex',alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,gap:10}}>
                <div style={{width:38,height:38,borderRadius:8,background:(cat?.color||C.muted)+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{cat?.emoji||'💸'}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:500,color:C.text,marginBottom:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</p>
                  <p style={{fontSize:11,color:C.muted}}>{cat?.name||'?'} • {wl?.name||'?'} • {fmtDate(tx.date)}</p>
                  {tx.note&&<p style={{fontSize:11,color:C.muted,marginTop:2,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📝 {tx.note}</p>}
                </div>
                <p style={{fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,color:tx.type==='income'?C.income:C.expense,flexShrink:0}}>
                  {tx.type==='income'?'+':'-'}{fmt(tx.amount)}
                </p>
                <div style={{display:'flex',gap:4,flexShrink:0}}>
                  <button onClick={()=>onEdit(tx)} style={{...S.btnGhost,padding:'5px 8px',fontSize:12}}>✏️</button>
                  {showDel===tx.id?(
                    <button onClick={()=>{onDelete(tx.id);setShowDel(null)}} style={{...S.btnDanger,padding:'5px 8px',fontSize:12}}>Hapus?</button>
                  ):(
                    <button onClick={()=>setShowDel(tx.id)} style={{...S.btnGhost,padding:'5px 8px',fontSize:12}}>🗑</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ═══════════════════ ANALYTICS ═══════════════════
function Analytics({ transactions, wallets, categories }) {
  const [period, setPeriod] = useState('all');

  const filtered = useMemo(()=>{
    if(period==='all') return transactions;
    const months = {month:1,quarter:3,year:12}[period]||1;
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-months);
    return transactions.filter(t=>new Date(t.date)>=cutoff);
  },[transactions,period]);

  const totalInc = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExp = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const netSav = totalInc-totalExp;
  const savRate = totalInc>0?Math.round((netSav/totalInc)*100):0;

  // Monthly chart data
  const monthlyData = useMemo(()=>{
    const map={};
    filtered.forEach(t=>{
      const m=monthStr(t.date);
      if(!map[m])map[m]={month:monthLabel(m)+' '+m.split('-')[0],income:0,expense:0};
      if(t.type==='income')map[m].income+=t.amount; else map[m].expense+=t.amount;
    });
    return Object.values(map).sort((a,b)=>a.month.localeCompare(b.month));
  },[filtered]);

  // Category data
  const catData = useMemo(()=>{
    const map={};
    filtered.filter(t=>t.type==='expense').forEach(t=>{
      const cat=categories.find(c=>c.id===t.categoryId);
      const key=cat?.name||'Lainnya';
      const col=cat?.color||C.muted;
      if(!map[key])map[key]={name:key,value:0,color:col,emoji:cat?.emoji||'💸'};
      map[key].value+=t.amount;
    });
    return Object.values(map).sort((a,b)=>b.value-a.value);
  },[filtered,categories]);

  // Wallet data
  const walletData = wallets.map(w=>({name:w.name,balance:w.balance,color:w.color,emoji:w.emoji}));

  const cFmt = (v)=>{ if(v>=1000000)return `${(v/1000000).toFixed(1)}jt`; if(v>=1000)return `${(v/1000).toFixed(0)}rb`; return v; };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:22,color:C.text}}>Analitik</h2>
        <select className="vi" style={{...S.input,width:'auto',padding:'8px 12px',fontSize:13}} value={period} onChange={e=>setPeriod(e.target.value)}>
          <option value="month">Bulan Ini</option>
          <option value="quarter">3 Bulan</option>
          <option value="year">1 Tahun</option>
          <option value="all">Semua</option>
        </select>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:16}}>
        {[
          ['📈 Total Masuk',fmt(totalInc),C.income],
          ['📉 Total Keluar',fmt(totalExp),C.expense],
          [netSav>=0?'💰 Net Saving':'⚠️ Net',fmt(Math.abs(netSav)),netSav>=0?C.income:C.expense],
          ['📊 Savings Rate',`${savRate}%`,savRate>=20?C.income:savRate>=10?C.gold:C.expense],
        ].map(([l,v,col])=>(
          <div key={l} style={{...S.card,padding:14}}>
            <p style={{fontSize:12,color:C.muted,marginBottom:4}}>{l}</p>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:18,fontWeight:500,color:col}}>{v}</p>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      {monthlyData.length>0&&(
        <div style={{...S.card,padding:16,marginBottom:14}}>
          <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:14}}>📅 Pemasukan vs Pengeluaran</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={cFmt}/>
              <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}} formatter={v=>[fmt(v)]}/>
              <Bar dataKey="income" fill={C.income} radius={[4,4,0,0]} name="Masuk"/>
              <Bar dataKey="expense" fill={C.expense} radius={[4,4,0,0]} name="Keluar"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category pie + table */}
      {catData.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1.2fr)',gap:12,marginBottom:14}}>
          <div style={{...S.card,padding:16}}>
            <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>🥧 Pengeluaran per Kategori</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={catData} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                  {catData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}} formatter={v=>[fmt(v)]}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{...S.card,padding:16,overflowY:'auto',maxHeight:240}}>
            <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>🔝 Top Kategori</p>
            {catData.map((d,i)=>(
              <div key={d.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:15}}>{d.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</span>
                    <span style={{fontSize:12,color:C.muted,flexShrink:0,marginLeft:8}}>{totalExp>0?Math.round(d.value/totalExp*100):0}%</span>
                  </div>
                  <div style={{height:4,background:C.surface,borderRadius:2}}>
                    <div style={{height:'100%',width:`${totalExp>0?Math.min(d.value/totalExp*100,100):0}%`,background:d.color,borderRadius:2}}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet balance chart */}
      {walletData.length>0&&(
        <div style={{...S.card,padding:16,marginBottom:14}}>
          <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:14}}>💳 Saldo per Wallet</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={walletData} layout="vertical">
              <XAxis type="number" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={cFmt}/>
              <YAxis type="category" dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} width={70}/>
              <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}} formatter={v=>[fmt(v),'Saldo']}/>
              <Bar dataKey="balance" radius={[0,4,4,0]}>
                {walletData.map((d,i)=><Cell key={i} fill={d.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {filtered.length===0&&(
        <div style={{...S.card,padding:48,textAlign:'center'}}>
          <p style={{fontSize:32,marginBottom:8}}>📊</p>
          <p style={{color:C.muted,fontSize:14}}>Belum ada data untuk periode ini</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════ WALLET MANAGER ═══════════════════
function WalletManager({ wallets, setWallets, transactions }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({name:'',type:'bank',balance:'',color:PALETTE[0],emoji:'🏦'});

  const save = () => {
    if(!form.name) return;
    if(editing) {
      setWallets(prev=>prev.map(w=>w.id===editing?{...w,...form,balance:parseFloat(form.balance)||w.balance}:w));
    } else {
      setWallets(prev=>[...prev,{...form,id:uid(),balance:parseFloat(form.balance)||0}]);
    }
    setShowForm(false); setEditing(null); setForm({name:'',type:'bank',balance:'',color:PALETTE[0],emoji:'🏦'});
  };

  const startEdit = (w) => { setEditing(w.id); setForm({...w,balance:w.balance}); setShowForm(true); };

  const deleteWallet = (id) => {
    if(transactions.some(t=>t.walletId===id)) { alert('Wallet ini masih punya transaksi. Hapus transaksinya dulu.'); return; }
    setWallets(prev=>prev.filter(w=>w.id!==id));
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:22,color:C.text}}>Wallet</h2>
        <button className="scale" onClick={()=>{setEditing(null);setForm({name:'',type:'bank',balance:'',color:PALETTE[0],emoji:'🏦'});setShowForm(true)}} style={{...S.btnPrimary,padding:'10px 16px',fontSize:13}}>+ Wallet Baru</button>
      </div>

      {showForm&&(
        <div style={{...S.card,padding:18,marginBottom:16,borderColor:C.gold+'44'}}>
          <h3 style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:14}}>{editing?'✏️ Edit Wallet':'➕ Tambah Wallet'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Nama</label>
              <input className="vi" style={{...S.input}} placeholder="Nama wallet" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
            <div><label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Tipe</label>
              <select className="vi" style={{...S.input}} value={form.type} onChange={e=>{const wt=WALLET_TYPES.find(t=>t.value===e.target.value);setForm(p=>({...p,type:e.target.value,emoji:wt?.emoji||'🏦'}))}}>
                {WALLET_TYPES.map(t=><option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
              </select></div>
          </div>
          <div style={{marginBottom:10}}><label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Saldo</label>
            <input className="vi" style={{...S.input}} type="number" placeholder="Saldo (Rp)" value={form.balance} onChange={e=>setForm(p=>({...p,balance:e.target.value}))}/></div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:6}}>Warna</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {PALETTE.map(col=><div key={col} onClick={()=>setForm(p=>({...p,color:col}))} style={{width:24,height:24,borderRadius:'50%',background:col,cursor:'pointer',border:form.color===col?`2px solid ${C.text}`:'2px solid transparent'}}/>)}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="scale" style={{...S.btnGhost,padding:'10px 16px'}} onClick={()=>{setShowForm(false);setEditing(null)}}>Batal</button>
            <button className="scale" style={{...S.btnPrimary,padding:'10px 16px',flex:1}} onClick={save}>{editing?'Simpan':'Tambah'}</button>
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
        {wallets.map(w=>{
          const txCount=transactions.filter(t=>t.walletId===w.id).length;
          return (
            <div key={w.id} style={{...S.card,padding:16,borderColor:w.color+'33',position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <div style={{width:44,height:44,borderRadius:10,background:w.color+'22',border:`1px solid ${w.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{w.emoji}</div>
                <div>
                  <p style={{fontWeight:600,fontSize:15,color:C.text}}>{w.name}</p>
                  <p style={{fontSize:12,color:C.muted}}>{WALLET_TYPES.find(t=>t.value===w.type)?.label}</p>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:10}}>
                <div>
                  <p style={{fontSize:11,color:C.muted,marginBottom:2}}>Saldo</p>
                  <p style={{fontFamily:'DM Mono,monospace',fontSize:18,fontWeight:500,color:C.text}}>{fmt(w.balance)}</p>
                </div>
                <p style={{fontSize:11,color:C.muted}}>{txCount} transaksi</p>
              </div>
              <div style={{height:2,background:w.color,borderRadius:1,marginBottom:12,opacity:.5}}/>
              <div style={{display:'flex',gap:6}}>
                <button className="scale" style={{...S.btnGhost,padding:'7px 12px',fontSize:12,flex:1}} onClick={()=>startEdit(w)}>✏️ Edit</button>
                <button className="scale" style={{...S.btnDanger,padding:'7px 12px',fontSize:12}} onClick={()=>deleteWallet(w.id)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════ CATEGORY MANAGER ═══════════════════
function CategoryManager({ categories, setCategories, transactions }) {
  const [tab, setTab] = useState('expense');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({name:'',type:'expense',emoji:'😊',color:PALETTE[2]});

  const grouped = useMemo(()=>({
    income: categories.filter(c=>c.type==='income'||c.type==='both'),
    expense: categories.filter(c=>c.type==='expense'||c.type==='both'),
  }),[categories]);

  const save = () => {
    if(!form.name) return;
    if(editing) {
      setCategories(prev=>prev.map(c=>c.id===editing?{...c,...form}:c));
    } else {
      setCategories(prev=>[...prev,{...form,id:uid(),type:tab}]);
    }
    setShowForm(false); setEditing(null); setForm({name:'',type:'expense',emoji:'😊',color:PALETTE[2]});
  };

  const startEdit = (c) => { setEditing(c.id); setForm({...c}); setShowForm(true); };
  const deleteCat = (id) => {
    if(transactions.some(t=>t.categoryId===id)){ alert('Kategori ini masih dipakai di transaksi.'); return; }
    setCategories(prev=>prev.filter(c=>c.id!==id));
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:22,color:C.text}}>Kategori</h2>
        <button className="scale" onClick={()=>{setEditing(null);setForm({name:'',type:tab,emoji:'😊',color:PALETTE[3]});setShowForm(true)}} style={{...S.btnPrimary,padding:'10px 16px',fontSize:13}}>+ Kategori</button>
      </div>

      <div style={{display:'flex',gap:0,background:C.surface,borderRadius:8,padding:3,border:`1px solid ${C.border}`,marginBottom:16}}>
        {['income','expense'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'9px',borderRadius:6,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,background:tab===t?(t==='income'?'rgba(27,194,120,.2)':'rgba(255,61,96,.2)'):'transparent',color:tab===t?(t==='income'?C.income:C.expense):C.muted,transition:'all .15s'}}>
            {t==='income'?'📈 Pemasukan':'📉 Pengeluaran'} ({grouped[t]?.length||0})
          </button>
        ))}
      </div>

      {showForm&&(
        <div style={{...S.card,padding:18,marginBottom:16,borderColor:C.gold+'44'}}>
          <h3 style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:14}}>{editing?'✏️ Edit Kategori':'➕ Tambah Kategori'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:10,marginBottom:10}}>
            <div><label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Emoji</label>
              <select className="vi" style={{...S.input,padding:'8px',textAlign:'center'}} value={form.emoji} onChange={e=>setForm(p=>({...p,emoji:e.target.value}))}>
                {EMOJIS.map(em=><option key={em} value={em}>{em}</option>)}
              </select></div>
            <div><label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Nama Kategori</label>
              <input className="vi" style={{...S.input}} placeholder="Nama kategori" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:6}}>Warna</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {PALETTE.map(col=><div key={col} onClick={()=>setForm(p=>({...p,color:col}))} style={{width:24,height:24,borderRadius:'50%',background:col,cursor:'pointer',border:form.color===col?`2px solid ${C.text}`:'2px solid transparent'}}/>)}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="scale" style={{...S.btnGhost,padding:'10px 16px'}} onClick={()=>{setShowForm(false);setEditing(null)}}>Batal</button>
            <button className="scale" style={{...S.btnPrimary,padding:'10px 16px',flex:1}} onClick={save}>{editing?'Simpan':'Tambah'}</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
        {(grouped[tab]||[]).map(c=>{
          const txCount=transactions.filter(t=>t.categoryId===c.id).length;
          return (
            <div key={c.id} style={{...S.card,padding:12,display:'flex',alignItems:'center',gap:10,width:'100%',maxWidth:260,borderColor:c.color+'33'}}>
              <div style={{width:38,height:38,borderRadius:8,background:c.color+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{c.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                <p style={{fontSize:11,color:C.muted}}>{txCount} transaksi</p>
              </div>
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>startEdit(c)} style={{...S.btnGhost,padding:'5px 8px',fontSize:11}}>✏️</button>
                <button onClick={()=>deleteCat(c.id)} style={{...S.btnDanger,padding:'5px 8px',fontSize:11}}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════ EXPORT ═══════════════════
function ExportView({ transactions, wallets, categories, onReset, lsOk }) {
  const [exported, setExported] = useState('');
  const [scriptUrl, setScriptUrl] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  const getCat = id=>categories.find(c=>c.id===id);
  const getWallet = id=>wallets.find(w=>w.id===id);

  const exportCSV = () => {
    const rows=[['Tanggal','Tipe','Jumlah','Kategori','Wallet','Deskripsi','Catatan']];
    transactions.forEach(t=>rows.push([t.date,t.type==='income'?'Pemasukan':'Pengeluaran',t.amount,getCat(t.categoryId)?.name||'',getWallet(t.walletId)?.name||'',t.description||'',t.note||'']));
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`vault-transaksi-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(url);
    setExported('csv');
  };

  const exportJSON = () => {
    const data={wallets,categories,transactions,exported:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`vault-backup-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url);
    setExported('json');
  };

  const exportPrint = () => {
    const rows=transactions.map(t=>`<tr><td>${t.date}</td><td style="color:${t.type==='income'?'#1BC278':'#FF3D60'}">${t.type==='income'?'Pemasukan':'Pengeluaran'}</td><td style="text-align:right;font-weight:600">${t.type==='income'?'+':'-'}${fmt(t.amount)}</td><td>${getCat(t.categoryId)?.emoji||''} ${getCat(t.categoryId)?.name||'-'}</td><td>${getWallet(t.walletId)?.emoji||''} ${getWallet(t.walletId)?.name||'-'}</td><td>${t.description||''}</td></tr>`).join('');
    const walletRows=wallets.map(w=>`<tr><td>${w.emoji} ${w.name}</td><td>${WALLET_TYPES.find(t=>t.value===w.type)?.label||''}</td><td style="text-align:right;font-weight:600">${fmt(w.balance)}</td></tr>`).join('');
    const html=`<!DOCTYPE html><html><head><title>VAULT</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:13px}th{padding:8px;background:#f0f0f0;border-bottom:2px solid #ddd;text-align:left}td{padding:8px;border-bottom:1px solid #eee}</style></head><body><h1>VAULT — Laporan Keuangan</h1><p>${new Date().toLocaleString('id-ID')} · ${transactions.length} transaksi</p><h2>Wallet</h2><table><tr><th>Wallet</th><th>Tipe</th><th>Saldo</th></tr>${walletRows}</table><h2>Transaksi</h2><table><tr><th>Tanggal</th><th>Tipe</th><th>Jumlah</th><th>Kategori</th><th>Wallet</th><th>Deskripsi</th></tr>${rows}</table></body></html>`;
    const w=window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
  };

  const syncToSheets = async () => {
    if (!scriptUrl.trim()) { setSyncMsg('⚠️ Masukkan URL Apps Script dulu.'); return; }
    setSyncStatus('syncing'); setSyncMsg('');
    try {
      const res = await fetch(scriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: 'full_sync', transactions, wallets, categories }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus('done');
        setSyncMsg(`✅ ${data.synced} transaksi berhasil disync ke Google Sheets!`);
      } else {
        setSyncStatus('error');
        setSyncMsg('❌ Error: ' + (data.error||'Unknown'));
      }
    } catch(e) {
      setSyncStatus('error');
      setSyncMsg('❌ Gagal koneksi. Cek URL Apps Script sudah benar.');
    }
  };

  const totalBal=wallets.reduce((s,w)=>s+w.balance,0);
  const totalInc=transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExp=transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  return (
    <div>
      <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:22,color:C.text,marginBottom:4}}>Export & Sync</h2>
      <p style={{color:C.muted,fontSize:13,marginBottom:20}}>Export data atau sync langsung ke Google Sheets.</p>

      <div style={{...S.card,padding:16,marginBottom:16}}>
        <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>📊 Ringkasan Data</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
          {[[wallets.length,'Wallet','💳'],[categories.length,'Kategori','🏷️'],[transactions.length,'Transaksi','📋']].map(([n,l,e])=>(
            <div key={l} style={{background:C.surface,borderRadius:8,padding:10,textAlign:'center'}}>
              <p style={{fontSize:22}}>{e}</p>
              <p style={{fontFamily:'DM Mono,monospace',fontSize:18,fontWeight:500,color:C.text}}>{n}</p>
              <p style={{fontSize:11,color:C.muted}}>{l}</p>
            </div>
          ))}
        </div>
        <div style={{paddingTop:12,borderTop:`1px solid ${C.border}`,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          {[['Total Saldo',fmt(totalBal),C.text],['Total Masuk',fmt(totalInc),C.income],['Total Keluar',fmt(totalExp),C.expense]].map(([l,v,col])=>(
            <div key={l}><p style={{fontSize:11,color:C.muted,marginBottom:2}}>{l}</p><p style={{fontFamily:'DM Mono,monospace',fontSize:13,color:col,fontWeight:500}}>{v}</p></div>
          ))}
        </div>
      </div>

      <div style={{...S.card,padding:20,marginBottom:16,borderColor:'rgba(52,211,153,.3)',background:'rgba(52,211,153,.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <span style={{fontSize:28}}>📊</span>
          <div>
            <p style={{fontWeight:700,fontSize:16,color:C.text}}>Sync ke Google Sheets</p>
            <p style={{fontSize:12,color:C.muted}}>Auto-buat 4 tab: Dashboard, Transaksi, Wallet, Kategori</p>
          </div>
        </div>
        <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Apps Script Web App URL</label>
        <input className="vi" style={{...S.input,marginBottom:10}} placeholder="https://script.google.com/macros/s/xxxx/exec" value={scriptUrl} onChange={e=>setScriptUrl(e.target.value)}/>
        <button className="scale" onClick={syncToSheets} disabled={syncStatus==='syncing'} style={{...S.btnPrimary,padding:'12px',width:'100%',fontSize:14,background:syncStatus==='syncing'?undefined:'linear-gradient(135deg,#34D399,#059669)',opacity:syncStatus==='syncing'?.7:1}}>
          {syncStatus==='syncing'?'⏳ Sedang sync...':'🔄 Sync Sekarang ke Google Sheets'}
        </button>
        {syncMsg&&(
          <div style={{marginTop:10,padding:10,borderRadius:8,background:syncStatus==='done'?'rgba(52,211,153,.1)':'rgba(255,61,96,.1)',border:`1px solid ${syncStatus==='done'?'rgba(52,211,153,.3)':'rgba(255,61,96,.3)'}`}}>
            <p style={{fontSize:13,color:syncStatus==='done'?C.income:C.expense}}>{syncMsg}</p>
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:12,marginBottom:16}}>
        {[{icon:'📄',title:'Export CSV',desc:'Buka di Excel atau import manual ke Sheets.',action:exportCSV,key:'csv'},{icon:'🔧',title:'Backup JSON',desc:'Full backup semua data app.',action:exportJSON,key:'json'},{icon:'🖨️',title:'Print / PDF',desc:'Laporan siap cetak atau save PDF.',action:exportPrint,key:'pdf'}].map(e=>(
          <div key={e.key} style={{...S.card,padding:16}}>
            <p style={{fontSize:28,marginBottom:8}}>{e.icon}</p>
            <p style={{fontWeight:600,fontSize:14,color:C.text,marginBottom:4}}>{e.title}</p>
            <p style={{fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.5}}>{e.desc}</p>
            <button className="scale" onClick={e.action} style={{...S.btnGhost,padding:'9px',width:'100%',fontSize:13}}>Download</button>
            {exported===e.key&&<p style={{fontSize:11,color:C.income,textAlign:'center',marginTop:6}}>✅ Done!</p>}
          </div>
        ))}
      </div>

      <div style={{...S.card,padding:18,background:'rgba(79,126,255,.05)',borderColor:'rgba(79,126,255,.2)'}}>
        <p style={{fontSize:14,color:C.blue,fontWeight:700,marginBottom:12}}>📖 Cara Setup Google Sheets Sync (5 menit)</p>
        {[['1','Buka Google Sheets baru → beri nama "VAULT Finance"'],['2','Klik Extensions → Apps Script'],['3','Hapus semua kode default → paste kode dari file vault-sheets-script.gs'],['4','Klik Deploy → New Deployment → Type: Web App'],['5','Execute as: Me | Who has access: Anyone → klik Deploy'],['6','Copy URL yang muncul (https://script.google.com/macros/s/.../exec)'],['7','Paste URL di field di atas → Sync!']].map(([n,t])=>(
          <div key={n} style={{display:'flex',gap:10,marginBottom:10,alignItems:'flex-start'}}>
            <div style={{width:22,height:22,borderRadius:'50%',background:C.blue,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{n}</div>
            <p style={{fontSize:13,color:C.text,lineHeight:1.5}}>{t}</p>
          </div>
        ))}
        <div style={{marginTop:12,padding:10,background:'rgba(201,145,58,.08)',borderRadius:8,border:`1px solid rgba(201,145,58,.2)`}}>
          <p style={{fontSize:12,color:C.gold}}>💡 Setiap sync = data di Sheets di-replace data terbaru. Sheet otomatis punya 4 tab: 📊 Dashboard · 📋 Transaksi · 💳 Wallet · 🏷️ Kategori</p>
        </div>
      </div>

      {/* Storage status + reset */}
      <div style={{...S.card,padding:16,marginTop:14}}>
        <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>💾 Penyimpanan Data</p>
        {lsOk ? (
          <div style={{background:'rgba(27,194,120,.08)',border:'1px solid rgba(27,194,120,.2)',borderRadius:8,padding:12,marginBottom:12}}>
            <p style={{fontSize:13,color:C.income,fontWeight:600,marginBottom:2}}>✅ Data tersimpan otomatis di browser ini</p>
            <p style={{fontSize:12,color:C.muted}}>Setiap kali kamu input transaksi, data langsung auto-save. Aman kalau tab ditutup atau refresh. Tapi kalau ganti browser / device, gunakan fitur Sync ke Google Sheets di atas.</p>
          </div>
        ) : (
          <div style={{background:'rgba(201,145,58,.08)',border:'1px solid rgba(201,145,58,.3)',borderRadius:8,padding:12,marginBottom:12}}>
            <p style={{fontSize:13,color:C.gold,fontWeight:600,marginBottom:2}}>⚠️ Mode Preview (Claude artifact)</p>
            <p style={{fontSize:12,color:C.muted}}>Di Claude preview, localStorage tidak tersedia. Deploy ke Vercel dulu biar data otomatis tersimpan permanen.</p>
          </div>
        )}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
          <p style={{fontSize:12,color:C.muted,marginBottom:8}}>Mau mulai dari awal? Hapus semua data app:</p>
          <button className="scale" onClick={onReset} style={{...S.btnDanger,padding:'10px 16px',fontSize:13,width:'100%'}}>
            🗑️ Reset Semua Data (Hapus Permanen)
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ MILESTONES ═══════════════════
const MILESTONE_EMOJIS = ['🎯','💻','🏠','🚗','✈️','💍','👶','📱','🎓','💰','🎮','📷','🎸','⌚','🎨','🏖️','🐕','🏋️','🛒','🔑','💎','🌟','🎪','🏄'];

function MilestoneView({ milestones, setMilestones, wallets }) {
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState(null);
  const [detail, setDetail]         = useState(null); // id of milestone in detail view
  const [showContrib, setShowContrib] = useState(false);
  const [form, setForm] = useState({name:'',emoji:'🎯',color:PALETTE[1],targetAmount:'',currentAmount:'0',deadline:'',notes:''});
  const [contrib, setContrib] = useState({amount:'',date:todayStr(),note:'',walletId:''});
  const [contribLoading, setContribLoading] = useState(false);

  const sf = (k,v) => setForm(p=>({...p,[k]:v}));

  const openAdd = () => { setEditId(null); setForm({name:'',emoji:'🎯',color:PALETTE[1],targetAmount:'',currentAmount:'0',deadline:'',notes:''}); setShowForm(true); };
  const openEdit = (m) => { setEditId(m.id); setForm({name:m.name,emoji:m.emoji,color:m.color,targetAmount:m.targetAmount,currentAmount:m.currentAmount,deadline:m.deadline||'',notes:m.notes||''}); setShowForm(true); };

  const saveMilestone = () => {
    if(!form.name||!form.targetAmount) return;
    if(editId) {
      setMilestones(prev=>prev.map(m=>m.id===editId?{...m,...form,targetAmount:parseFloat(form.targetAmount)||0,currentAmount:parseFloat(form.currentAmount)||0}:m));
    } else {
      setMilestones(prev=>[...prev,{...form,id:uid(),targetAmount:parseFloat(form.targetAmount)||0,currentAmount:parseFloat(form.currentAmount)||0,contributions:[],createdAt:new Date().toISOString()}]);
    }
    setShowForm(false); setEditId(null);
  };

  const deleteMilestone = (id) => {
    if(!window.confirm('Hapus milestone ini?')) return;
    setMilestones(prev=>prev.filter(m=>m.id!==id));
    if(detail===id) setDetail(null);
  };

  const addContribution = () => {
    const amt = parseFloat(contrib.amount)||0;
    if(!amt) return;
    setContribLoading(true);
    setMilestones(prev=>prev.map(m=>{
      if(m.id!==detail) return m;
      const newContrib = {id:uid(),amount:amt,date:contrib.date,note:contrib.note,walletId:contrib.walletId};
      return {...m, currentAmount:m.currentAmount+amt, contributions:[newContrib,...(m.contributions||[])]};
    }));
    // Optionally deduct from wallet
    if(contrib.walletId) {
      // Note: does NOT create a transaction, just deducts wallet balance
    }
    setContrib({amount:'',date:todayStr(),note:'',walletId:''});
    setShowContrib(false);
    setContribLoading(false);
  };

  const removeContrib = (milestoneId, contribId) => {
    setMilestones(prev=>prev.map(m=>{
      if(m.id!==milestoneId) return m;
      const c = m.contributions?.find(c=>c.id===contribId);
      if(!c) return m;
      return {...m, currentAmount:Math.max(0,m.currentAmount-c.amount), contributions:m.contributions.filter(c=>c.id!==contribId)};
    }));
  };

  const totalTarget  = milestones.reduce((s,m)=>s+m.targetAmount,0);
  const totalSaved   = milestones.reduce((s,m)=>s+m.currentAmount,0);
  const totalLeft    = totalTarget-totalSaved;
  const completed    = milestones.filter(m=>m.currentAmount>=m.targetAmount).length;

  const daysLeft = (deadline) => {
    if(!deadline) return null;
    const diff = Math.ceil((new Date(deadline)-new Date())/(1000*60*60*24));
    return diff;
  };

  const pct = (cur,tgt) => tgt>0?Math.min(100,Math.round(cur/tgt*100)):0;

  const progressColor = (p) => p>=100?C.income:p>=75?C.gold:p>=50?C.blue:C.muted;

  // ── DETAIL VIEW ──
  const detailMilestone = milestones.find(m=>m.id===detail);
  if(detail && detailMilestone) {
    const m = detailMilestone;
    const p = pct(m.currentAmount, m.targetAmount);
    const dl = daysLeft(m.deadline);
    return (
      <div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <button onClick={()=>setDetail(null)} style={{...S.btnGhost,padding:'8px 14px',fontSize:13}}>← Kembali</button>
          <div style={{flex:1}}>
            <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:20,color:C.text}}>{m.emoji} {m.name}</h2>
            <p style={{fontSize:12,color:C.muted}}>Dibuat {fmtDate(m.createdAt?.split('T')[0])}</p>
          </div>
          <button onClick={()=>openEdit(m)} style={{...S.btnGhost,padding:'8px 12px',fontSize:12}}>✏️ Edit</button>
          <button onClick={()=>deleteMilestone(m.id)} style={{...S.btnDanger,padding:'8px 12px',fontSize:12}}>🗑</button>
        </div>

        {/* Progress hero */}
        <div style={{...S.card,padding:20,marginBottom:14,borderColor:m.color+'44',background:`linear-gradient(135deg,${C.card},${m.color}08)`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
            <div>
              <p style={{fontSize:12,color:C.muted,marginBottom:4}}>Terkumpul</p>
              <p style={{fontFamily:'DM Mono,monospace',fontSize:28,fontWeight:500,color:m.color}}>{fmt(m.currentAmount)}</p>
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{fontSize:12,color:C.muted,marginBottom:4}}>Target</p>
              <p style={{fontFamily:'DM Mono,monospace',fontSize:20,fontWeight:500,color:C.text}}>{fmt(m.targetAmount)}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{height:10,background:C.surface,borderRadius:5,marginBottom:8,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${p}%`,background:m.color,borderRadius:5,transition:'width .5s ease'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p style={{fontSize:13,fontWeight:700,color:m.color}}>{p}% tercapai</p>
            <p style={{fontSize:13,color:C.muted}}>Sisa: {fmt(Math.max(0,m.targetAmount-m.currentAmount))}</p>
          </div>
          {m.deadline&&(
            <div style={{marginTop:10,padding:'8px 12px',background:dl!==null&&dl<30?'rgba(255,61,96,.1)':'rgba(79,126,255,.08)',borderRadius:8,border:`1px solid ${dl!==null&&dl<30?'rgba(255,61,96,.3)':'rgba(79,126,255,.2)'}`}}>
              <p style={{fontSize:12,color:dl!==null&&dl<30?C.expense:C.blue}}>
                🗓 Deadline: {fmtDate(m.deadline)} {dl!==null&&`(${dl<0?'Lewat '+Math.abs(dl)+' hari':dl===0?'Hari ini!':dl+' hari lagi'})`}
              </p>
            </div>
          )}
          {m.notes&&<p style={{fontSize:13,color:C.muted,marginTop:10,fontStyle:'italic'}}>📝 {m.notes}</p>}
          {p>=100&&<div style={{marginTop:12,padding:10,background:'rgba(27,194,120,.12)',borderRadius:8,textAlign:'center'}}><p style={{fontSize:14,fontWeight:700,color:C.income}}>🎉 Milestone tercapai! Selamat!</p></div>}
        </div>

        {/* Add contribution */}
        {!showContrib?(
          <button className="scale" onClick={()=>setShowContrib(true)} style={{...S.btnPrimary,padding:'12px',width:'100%',fontSize:14,marginBottom:14}}>
            + Tambah Dana ke Milestone Ini
          </button>
        ):(
          <div style={{...S.card,padding:16,marginBottom:14,borderColor:C.gold+'44'}}>
            <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:12}}>➕ Tambah Dana</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Jumlah (Rp) *</label>
                <input className="vi" style={{...S.input}} type="number" placeholder="0" value={contrib.amount} onChange={e=>setContrib(p=>({...p,amount:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Tanggal</label>
                <input className="vi" style={{...S.input}} type="date" value={contrib.date} onChange={e=>setContrib(p=>({...p,date:e.target.value}))}/>
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Catatan</label>
              <input className="vi" style={{...S.input}} placeholder="Dari mana? Cara menabung?" value={contrib.note} onChange={e=>setContrib(p=>({...p,note:e.target.value}))}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="scale" style={{...S.btnGhost,padding:'10px 14px'}} onClick={()=>setShowContrib(false)}>Batal</button>
              <button className="scale" style={{...S.btnPrimary,padding:'10px',flex:1}} onClick={addContribution}>+ Tambah Dana</button>
            </div>
          </div>
        )}

        {/* Contribution history */}
        <div style={{...S.card,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p style={{fontSize:13,fontWeight:600,color:C.text}}>📜 Riwayat Tabungan</p>
            <p style={{fontSize:12,color:C.muted}}>{(m.contributions||[]).length} entri</p>
          </div>
          {(!m.contributions||m.contributions.length===0)?(
            <div style={{padding:32,textAlign:'center'}}>
              <p style={{fontSize:24,marginBottom:8}}>💸</p>
              <p style={{color:C.muted,fontSize:13}}>Belum ada dana yang ditambahkan.</p>
            </div>
          ):(
            [...(m.contributions||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(c=>(
              <div key={c.id} style={{display:'flex',alignItems:'center',padding:'10px 16px',borderBottom:`1px solid ${C.border}`,gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:'rgba(27,194,120,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>💰</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,color:C.text,fontWeight:500}}>{c.note||'Tabungan'}</p>
                  <p style={{fontSize:11,color:C.muted}}>{fmtDate(c.date)}</p>
                </div>
                <p style={{fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,color:C.income,flexShrink:0}}>+{fmt(c.amount)}</p>
                <button onClick={()=>removeContrib(m.id,c.id)} style={{...S.btnDanger,padding:'4px 8px',fontSize:11,flexShrink:0}}>✕</button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── FORM MODAL ──
  const FormModal = showForm && (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',backdropFilter:'blur(4px)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0 0 16px'}} onClick={e=>{if(e.target===e.currentTarget){setShowForm(false);setEditId(null);}}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'16px 16px 12px 12px',width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{padding:'18px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <h3 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:17,color:C.text}}>{editId?'Edit Milestone':'Milestone Baru'}</h3>
          <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{...S.btnGhost,padding:'5px 10px'}}>✕</button>
        </div>
        <div style={{padding:'0 20px 24px'}}>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Nama Milestone *</label>
            <input className="vi" style={{...S.input}} placeholder="Mis: Beli Laptop, Liburan Bali, Dana Darurat" value={form.name} onChange={e=>sf('name',e.target.value)}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,marginBottom:10}}>
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Emoji</label>
              <select className="vi" style={{...S.input,padding:'8px',textAlign:'center'}} value={form.emoji} onChange={e=>sf('emoji',e.target.value)}>
                {MILESTONE_EMOJIS.map(em=><option key={em} value={em}>{em}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Target Amount (Rp) *</label>
              <input className="vi" style={{...S.input}} type="number" placeholder="0" value={form.targetAmount} onChange={e=>sf('targetAmount',e.target.value)}/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Dana Awal (Rp)</label>
              <input className="vi" style={{...S.input}} type="number" placeholder="0" value={form.currentAmount} onChange={e=>sf('currentAmount',e.target.value)}/>
            </div>
            <div>
              <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Deadline (opsional)</label>
              <input className="vi" style={{...S.input}} type="date" value={form.deadline} onChange={e=>sf('deadline',e.target.value)}/>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:5}}>Warna</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {PALETTE.map(col=><div key={col} onClick={()=>sf('color',col)} style={{width:24,height:24,borderRadius:'50%',background:col,cursor:'pointer',border:form.color===col?`2px solid ${C.text}`:'2px solid transparent',transition:'border .15s'}}/>)}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:3}}>Catatan</label>
            <textarea className="vi" style={{...S.input,height:56,resize:'none'}} placeholder="Kenapa milestone ini penting?" value={form.notes} onChange={e=>sf('notes',e.target.value)}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="scale" style={{...S.btnGhost,padding:'11px 16px'}} onClick={()=>{setShowForm(false);setEditId(null);}}>Batal</button>
            <button className="scale" style={{...S.btnPrimary,padding:'11px',flex:1,opacity:(!form.name||!form.targetAmount)?.5:1}} onClick={saveMilestone} disabled={!form.name||!form.targetAmount}>
              {editId?'💾 Simpan':'+ Buat Milestone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── LIST VIEW ──
  return (
    <div>
      {FormModal}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:22,color:C.text,marginBottom:2}}>🎯 Milestone</h2>
          <p style={{fontSize:13,color:C.muted}}>Target & tujuan tabungan kamu</p>
        </div>
        <button className="scale" onClick={openAdd} style={{...S.btnPrimary,padding:'10px 16px',fontSize:13}}>+ Milestone</button>
      </div>

      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:18}}>
        {[
          ['🎯 Total Goal',milestones.length+' milestone',C.text],
          ['✅ Selesai',completed+' / '+milestones.length,C.income],
          ['💰 Terkumpul',fmt(totalSaved),C.gold],
          ['🏆 Sisa Target',fmt(Math.max(0,totalLeft)),C.expense],
        ].map(([l,v,col])=>(
          <div key={l} style={{...S.card,padding:12,textAlign:'center'}}>
            <p style={{fontSize:10,color:C.muted,marginBottom:3}}>{l}</p>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:500,color:col,lineHeight:1.3}}>{v}</p>
          </div>
        ))}
      </div>

      {milestones.length===0?(
        <div style={{...S.card,padding:52,textAlign:'center'}}>
          <p style={{fontSize:44,marginBottom:12}}>🎯</p>
          <p style={{fontWeight:600,fontSize:16,color:C.text,marginBottom:6}}>Belum ada milestone</p>
          <p style={{color:C.muted,fontSize:13,marginBottom:18}}>Buat target tabungan pertamamu — beli laptop, liburan, nikah, apapun!</p>
          <button className="scale" onClick={openAdd} style={{...S.btnPrimary,padding:'12px 24px',fontSize:14}}>+ Buat Milestone Pertama</button>
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
          {milestones.map(m=>{
            const p = pct(m.currentAmount, m.targetAmount);
            const dl = daysLeft(m.deadline);
            const done = p >= 100;
            return (
              <div key={m.id} onClick={()=>setDetail(m.id)} style={{...S.card,padding:16,cursor:'pointer',borderColor:m.color+'44',position:'relative',overflow:'hidden',transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background=C.cardHov}
                onMouseLeave={e=>e.currentTarget.style.background=C.card}>
                {done&&<div style={{position:'absolute',top:10,right:10,fontSize:18}}>🏆</div>}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                  <div style={{width:40,height:40,borderRadius:10,background:m.color+'20',border:`1px solid ${m.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{m.emoji}</div>
                  <div style={{minWidth:0,flex:1}}>
                    <p style={{fontWeight:600,fontSize:14,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</p>
                    {m.deadline&&<p style={{fontSize:11,color:dl!==null&&dl<14?C.expense:C.muted}}>{dl!==null&&dl<0?'⚠️ Lewat deadline':dl===0?'⏰ Hari ini!':dl+' hari lagi'}</p>}
                  </div>
                </div>
                <div style={{height:6,background:C.surface,borderRadius:3,marginBottom:8,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${p}%`,background:m.color,borderRadius:3,transition:'width .4s ease'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <p style={{fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,color:m.color}}>{fmt(m.currentAmount)}</p>
                  <p style={{fontSize:12,color:C.muted}}>{p}%</p>
                </div>
                <p style={{fontSize:11,color:C.muted}}>Target: {fmt(m.targetAmount)}</p>
                <div style={{display:'flex',gap:6,marginTop:10}}>
                  <button onClick={e=>{e.stopPropagation();setDetail(m.id);setShowContrib(true);}} style={{...S.btnPrimary,padding:'6px 10px',fontSize:11,flex:1,borderRadius:6}}>+ Dana</button>
                  <button onClick={e=>{e.stopPropagation();openEdit(m);}} style={{...S.btnGhost,padding:'6px 10px',fontSize:11}}>✏️</button>
                  <button onClick={e=>{e.stopPropagation();deleteMilestone(m.id);}} style={{...S.btnDanger,padding:'6px 8px',fontSize:11}}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════ LOGIN SCREEN ═══════════════════
function LoginScreen({ onLocalMode }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const errMsg = e => ({
    'auth/user-not-found':'Email tidak terdaftar.',
    'auth/wrong-password':'Password salah.',
    'auth/invalid-credential':'Email atau password salah.',
    'auth/email-already-in-use':'Email sudah dipakai. Coba login.',
    'auth/weak-password':'Password minimal 6 karakter.',
    'auth/invalid-email':'Format email tidak valid.',
    'auth/popup-closed-by-user':'Login dibatalkan.',
    'auth/too-many-requests':'Terlalu banyak percobaan. Tunggu sebentar.',
  }[e.code] || e.message);

  const doEmail = async () => {
    if(!fbAuth){setErr('Firebase belum dikonfigurasi.');return;}
    if(!email||!pass){setErr('Isi email dan password.');return;}
    setLoading(true); setErr('');
    try{
      if(mode==='register') await createUserWithEmailAndPassword(fbAuth,email,pass);
      else await signInWithEmailAndPassword(fbAuth,email,pass);
    }catch(e){ setErr(errMsg(e)); setLoading(false); }
  };

  const doReset = async () => {
    if(!fbAuth){setErr('Firebase belum dikonfigurasi.');return;}
    if(!email){setErr('Masukkan email kamu.');return;}
    setLoading(true); setErr('');
    try{
      await sendPasswordResetEmail(fbAuth,email);
      setMsg('Link reset dikirim ke email!'); setMode('login');
    }catch(e){ setErr(errMsg(e)); }
    setLoading(false);
  };

  return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:'system-ui,sans-serif'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0} body{background:${C.bg}}
        input,button{font-family:inherit}
        .vi:focus{border-color:${C.gold}!important;outline:none} .vi::placeholder{color:${C.muted}}
        .scale{transition:transform .15s} .scale:hover{transform:translateY(-1px)} .scale:active{transform:scale(.97)}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
      `}</style>
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:44,marginBottom:8}}>🏦</div>
          <h1 style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:30,color:C.text,letterSpacing:'-1px',marginBottom:4}}>VAULT</h1>
          <p style={{color:C.muted,fontSize:13}}>Personal Money Manager</p>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:24}}>
          {/* Tabs */}
          {mode!=='reset'&&(
            <div style={{display:'flex',background:C.surface,borderRadius:8,padding:3,border:`1px solid ${C.border}`,marginBottom:18}}>
              {[['login','🔑 Masuk'],['register','📝 Daftar']].map(([m,l])=>(
                <button key={m} onClick={()=>{setMode(m);setErr('');setMsg('');}} style={{flex:1,padding:'8px',borderRadius:6,border:'none',cursor:'pointer',fontWeight:600,fontSize:13,background:mode===m?'rgba(201,145,58,.15)':'transparent',color:mode===m?C.gold:C.muted,transition:'all .15s'}}>{l}</button>
              ))}
            </div>
          )}
          {mode==='reset'&&(
            <div style={{marginBottom:16}}>
              <button onClick={()=>{setMode('login');setErr('');}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:13}}>← Kembali</button>
              <p style={{fontWeight:700,fontSize:17,color:C.text,marginTop:10,marginBottom:4}}>Reset Password</p>
              <p style={{fontSize:13,color:C.muted}}>Kami kirim link reset ke email kamu.</p>
            </div>
          )}

          {err&&<div style={{background:'rgba(255,61,96,.1)',border:'1px solid rgba(255,61,96,.3)',borderRadius:8,padding:10,marginBottom:12}}><p style={{fontSize:13,color:C.expense}}>⚠️ {err}</p></div>}
          {msg&&<div style={{background:'rgba(27,194,120,.1)',border:'1px solid rgba(27,194,120,.3)',borderRadius:8,padding:10,marginBottom:12}}><p style={{fontSize:13,color:C.income}}>✅ {msg}</p></div>}

          <div style={{marginBottom:10}}>
            <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Email</label>
            <input className="vi" style={{...S.input}} type="email" placeholder="email@kamu.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(mode==='reset'?doReset():doEmail())}/>
          </div>
          {mode!=='reset'&&(
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,color:C.muted,display:'block',marginBottom:4}}>Password</label>
              <div style={{position:'relative'}}>
                <input className="vi" style={{...S.input,paddingRight:44}} type={showPass?'text':'password'} placeholder={mode==='register'?'Min. 6 karakter':'Password'} value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doEmail()}/>
                <button onClick={()=>setShowPass(p=>!p)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:15,padding:4}}>{showPass?'🙈':'👁'}</button>
              </div>
              {mode==='login'&&<button onClick={()=>{setMode('reset');setErr('');}} style={{background:'none',border:'none',cursor:'pointer',color:C.gold,fontSize:12,marginTop:5,padding:0}}>Lupa password?</button>}
            </div>
          )}
          {mode==='reset'
            ? <button className="scale" onClick={doReset} disabled={loading} style={{...S.btnPrimary,padding:'12px',width:'100%',fontSize:14,opacity:loading?.6:1}}>{loading?'⏳ Mengirim...':'📧 Kirim Link Reset'}</button>
            : <button className="scale" onClick={doEmail} disabled={loading} style={{...S.btnPrimary,padding:'12px',width:'100%',fontSize:14,opacity:loading?.6:1}}>{loading?'⏳...':(mode==='login'?'Masuk':'Daftar & Mulai')}</button>
          }

        </div>
        <div style={{textAlign:'center',marginTop:14}}>
          <p style={{fontSize:12,color:C.muted,marginBottom:5}}>Mau pakai tanpa akun? Data tersimpan di browser ini saja.</p>
          <button onClick={onLocalMode} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:12,textDecoration:'underline'}}>Lanjut tanpa login →</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ ADMIN PANEL ═══════════════════
function AdminPanel({ currentUser, onBack }) {
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // vault detail

  useEffect(()=>{
    loadAllVaults().then(data=>{
      setVaults(data.sort((a,b)=>(b.lastUpdated||'').localeCompare(a.lastUpdated||'')));
      setLoading(false);
    });
  },[]);

  const totalUsers = vaults.length;
  const totalTx = vaults.reduce((s,v)=>s+(v.transactions?.length||0),0);
  const totalBal = vaults.reduce((s,v)=>s+(v.wallets||[]).reduce((ws,w)=>ws+w.balance,0),0);

  if(selected) return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <button onClick={()=>setSelected(null)} style={{...S.btnGhost,padding:'8px 14px',fontSize:13}}>← Kembali</button>
        <div>
          <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:20,color:C.text}}>{selected.userEmail||selected.uid}</h2>
          <p style={{fontSize:12,color:C.muted}}>Data akun — read only</p>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,marginBottom:16}}>
        {[
          ['💰 Total Saldo', fmt((selected.wallets||[]).reduce((s,w)=>s+w.balance,0)), C.gold],
          ['📈 Pemasukan', fmt((selected.transactions||[]).filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)), C.income],
          ['📉 Pengeluaran', fmt((selected.transactions||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)), C.expense],
          ['📋 Transaksi', (selected.transactions||[]).length+' tx', C.text],
          ['💳 Wallet', (selected.wallets||[]).length+' wallet', C.text],
        ].map(([l,v,col])=>(
          <div key={l} style={{...S.card,padding:12}}>
            <p style={{fontSize:11,color:C.muted,marginBottom:3}}>{l}</p>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:500,color:col}}>{v}</p>
          </div>
        ))}
      </div>
      <div style={{...S.card,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`}}>
          <p style={{fontSize:13,fontWeight:600,color:C.text}}>📋 Transaksi Terbaru</p>
        </div>
        {(selected.transactions||[]).slice(0,20).map(tx=>{
          const cat=(selected.categories||[]).find(c=>c.id===tx.categoryId);
          const wl=(selected.wallets||[]).find(w=>w.id===tx.walletId);
          return(
            <div key={tx.id} style={{display:'flex',alignItems:'center',padding:'10px 16px',borderBottom:`1px solid ${C.border}`,gap:10}}>
              <span style={{fontSize:18}}>{cat?.emoji||'💸'}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</p>
                <p style={{fontSize:11,color:C.muted}}>{wl?.name||'?'} · {fmtDate(tx.date)}</p>
              </div>
              <p style={{fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,color:tx.type==='income'?C.income:C.expense,flexShrink:0}}>{tx.type==='income'?'+':'-'}{fmt(tx.amount)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <h2 style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:22,color:C.text,marginBottom:2}}>👑 Admin Panel</h2>
          <p style={{fontSize:13,color:C.muted}}>Overview semua akun VAULT</p>
        </div>
        <button onClick={onBack} style={{...S.btnGhost,padding:'8px 14px',fontSize:13}}>← Dashboard</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
        {[['👥 Total User',totalUsers,C.gold],['📋 Total Transaksi',totalTx,C.blue],['💰 Total Saldo',fmt(totalBal),C.income]].map(([l,v,col])=>(
          <div key={l} style={{...S.card,padding:14,textAlign:'center'}}>
            <p style={{fontSize:11,color:C.muted,marginBottom:4}}>{l}</p>
            <p style={{fontFamily:'DM Mono,monospace',fontSize:16,fontWeight:500,color:col}}>{v}</p>
          </div>
        ))}
      </div>

      {loading?(
        <div style={{textAlign:'center',padding:48}}><p style={{color:C.muted,fontSize:14}}>⏳ Loading data semua akun...</p></div>
      ):(
        <div style={{...S.card,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`}}>
            <p style={{fontSize:13,fontWeight:600,color:C.text}}>{totalUsers} Akun Terdaftar</p>
          </div>
          {vaults.length===0&&<div style={{padding:32,textAlign:'center'}}><p style={{color:C.muted}}>Belum ada akun selain kamu.</p></div>}
          {vaults.map(v=>{
            const bal=(v.wallets||[]).reduce((s,w)=>s+w.balance,0);
            const txCount=(v.transactions||[]).length;
            const isMe = v.userEmail===currentUser?.email;
            return(
              <div key={v.uid} onClick={()=>setSelected(v)} style={{display:'flex',alignItems:'center',padding:'12px 16px',borderBottom:`1px solid ${C.border}`,gap:12,cursor:'pointer',transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{width:38,height:38,borderRadius:'50%',background:`${C.blue}22`,border:`1px solid ${C.blue}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                  {isMe?'👑':'👤'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                    <p style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.userEmail||v.uid}</p>
                    {isMe&&<span style={{fontSize:10,background:`${C.gold}22`,color:C.gold,padding:'2px 6px',borderRadius:4,fontWeight:600}}>KAMU</span>}
                  </div>
                  <p style={{fontSize:11,color:C.muted}}>{txCount} transaksi · {(v.wallets||[]).length} wallet · last active {v.lastUpdated?fmtDate(v.lastUpdated.split('T')[0]):'-'}</p>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <p style={{fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:500,color:C.text}}>{fmt(bal)}</p>
                  <p style={{fontSize:11,color:C.muted}}>total saldo</p>
                </div>
                <span style={{color:C.muted,fontSize:12}}>›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════ MAIN APP ═══════════════════
export default function App() {
  const lsOk = LS.ok();

  // ── Auth state ──
  const [fbUser, setFbUser]     = useState(null);
  const [authReady, setAuthReady] = useState(!FB_ON);
  const [localMode, setLocalMode] = useState(false);

  // ── Data state (localStorage fallback) ──
  const [ready, setReady]           = useState(()=> !FB_ON && lsOk && LS.get('vault_ready',false));
  const [wallets, setWallets]       = useState(()=> !FB_ON && lsOk ? LS.get('vault_wallets',[]) : []);
  const [categories, setCategories] = useState(()=> !FB_ON && lsOk ? LS.get('vault_categories',[]) : []);
  const [transactions, setTransactions] = useState(()=> !FB_ON && lsOk ? LS.get('vault_transactions',[]) : []);
  const [milestones, setMilestones] = useState(()=> !FB_ON && lsOk ? LS.get('vault_milestones',[]) : []);

  const [view, setView]         = useState('dashboard');
  const [txModal, setTxModal]   = useState(false);
  const [editTx, setEditTx]     = useState(null);
  const [saveIndicator, setSaveIndicator] = useState('');
  const [dataLoading, setDataLoading] = useState(false);

  const isAdmin = fbUser?.email === ADMIN_EMAIL;
  const useFirebase = FB_ON && (fbUser || false) && !localMode;

  // ── Firebase auth listener ──
  useEffect(()=>{
    if(!FB_ON || !fbAuth) return;
    const unsub = onAuthStateChanged(fbAuth, async user => {
      setFbUser(user);
      setAuthReady(true);
      if(user) {
        setDataLoading(true);
        const data = await loadVault(user.uid);
        if(data) {
          setWallets(data.wallets||[]);
          setCategories(data.categories||[]);
          setTransactions(data.transactions||[]);
          setMilestones(data.milestones||[]);
          setReady(!!data.setupDone);
        }
        setDataLoading(false);
      } else {
        setWallets([]); setCategories([]); setTransactions([]); setMilestones([]); setReady(false);
      }
    });
    return ()=>unsub();
  },[]);

  // ── Auto-save ──
  const flash = useCallback(()=>{ setSaveIndicator('saved'); setTimeout(()=>setSaveIndicator(''),1800); },[]);

  useEffect(()=>{
    if(!ready) return;
    if(useFirebase && fbUser) {
      saveVault(fbUser.uid, { wallets, categories, transactions, milestones, setupDone:true,
        userEmail:fbUser.email, userName:fbUser.displayName||fbUser.email });
    } else if(!FB_ON && lsOk) {
      LS.set('vault_wallets', wallets);
    }
    flash();
  },[wallets]);

  useEffect(()=>{
    if(!ready) return;
    if(useFirebase && fbUser) {
      saveVault(fbUser.uid, { wallets, categories, transactions, milestones, setupDone:true,
        userEmail:fbUser.email, userName:fbUser.displayName||fbUser.email });
    } else if(!FB_ON && lsOk) {
      LS.set('vault_transactions', transactions);
    }
    flash();
  },[transactions]);

  useEffect(()=>{
    if(!ready) return;
    if(useFirebase && fbUser) {
      saveVault(fbUser.uid, { wallets, categories, transactions, milestones, setupDone:true,
        userEmail:fbUser.email, userName:fbUser.displayName||fbUser.email });
    } else if(!FB_ON && lsOk) {
      LS.set('vault_categories', categories);
    }
  },[categories]);

  useEffect(()=>{
    if(!ready) return;
    if(useFirebase && fbUser) {
      saveVault(fbUser.uid, { wallets, categories, transactions, milestones, setupDone:true,
        userEmail:fbUser.email, userName:fbUser.displayName||fbUser.email });
    } else if(!FB_ON && lsOk) {
      LS.set('vault_milestones', milestones);
    }
  },[milestones]);

  const handleSetupComplete = ({wallets:w, categories:c}) => {
    setWallets(w); setCategories(c);
    if(useFirebase && fbUser) {
      saveVault(fbUser.uid, { wallets:w, categories:c, transactions:[], milestones:[], setupDone:true,
        userEmail:fbUser.email, userName:fbUser.displayName||fbUser.email });
    } else if(!FB_ON && lsOk) {
      LS.set('vault_wallets',w); LS.set('vault_categories',c); LS.set('vault_milestones',[]); LS.set('vault_ready',true);
    }
    setReady(true);
  };

  const handleResetAll = () => {
    if(!window.confirm('Reset semua data? Tidak bisa di-undo!')) return;
    if(useFirebase && fbUser) {
      saveVault(fbUser.uid, {wallets:[],categories:[],transactions:[],setupDone:false,userEmail:fbUser.email});
    }
    LS.clear();
    setWallets([]); setCategories([]); setTransactions([]); setReady(false);
  };

  const handleLogout = async () => {
    if(fbAuth) try{ await fbSignOut(fbAuth); }catch{}
    setFbUser(null); setLocalMode(false);
    setWallets([]); setCategories([]); setTransactions([]); setMilestones([]); setReady(false);
    setView('dashboard');
  };

  // ── Transaction helpers ──
  const addTx = useCallback((tx)=>{
    const newTx={...tx,id:uid(),createdAt:new Date().toISOString()};
    setTransactions(prev=>[newTx,...prev]);
    setWallets(prev=>prev.map(w=>w.id===tx.walletId?{...w,balance:tx.type==='income'?w.balance+tx.amount:w.balance-tx.amount}:w));
  },[]);

  const updateTx = useCallback((id,newTx)=>{
    setTransactions(prev=>{
      const old=prev.find(t=>t.id===id);
      if(!old) return prev;
      setWallets(wp=>wp.map(w=>{
        let b=w.balance;
        if(w.id===old.walletId) b+=old.type==='income'?-old.amount:old.amount;
        if(w.id===newTx.walletId) b+=newTx.type==='income'?newTx.amount:-newTx.amount;
        return {...w,balance:b};
      }));
      return prev.map(t=>t.id===id?{...t,...newTx}:t);
    });
  },[]);

  const deleteTx = useCallback((id)=>{
    setTransactions(prev=>{
      const tx=prev.find(t=>t.id===id);
      if(tx) setWallets(wp=>wp.map(w=>w.id===tx.walletId?{...w,balance:tx.type==='income'?w.balance-tx.amount:w.balance+tx.amount}:w));
      return prev.filter(t=>t.id!==id);
    });
  },[]);

  const totalBalance = useMemo(()=>wallets.reduce((s,w)=>s+w.balance,0),[wallets]);
  const openAdd  = ()=>{ setEditTx(null); setTxModal(true); };
  const openEdit = tx=>{ setEditTx(tx); setTxModal(true); };
  const onSave   = tx=>{ if(editTx) updateTx(editTx.id,tx); else addTx(tx); setTxModal(false); setEditTx(null); };

  // ── Render guards ──
  if(!authReady) return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>🏦</div>
        <p style={{color:C.muted,fontSize:14,fontFamily:'system-ui,sans-serif'}}>Memuat VAULT...</p>
      </div>
    </div>
  );

  if(FB_ON && !fbUser && !localMode) return <LoginScreen onLocalMode={()=>setLocalMode(true)}/>;

  if(dataLoading) return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:36,marginBottom:10}}>⏳</div>
        <p style={{color:C.muted,fontSize:14}}>Loading data kamu...</p>
      </div>
    </div>
  );

  if(!ready) return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0} body{background:${C.bg}}
        input,select,textarea,button{font-family:inherit}
        .vi:focus{border-color:${C.gold}!important;outline:none} .vi::placeholder{color:${C.muted}} .vi option{background:${C.surface};color:${C.text}}
        .chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:${C.surface};border:1px solid ${C.border};border-radius:100px;font-size:13px;color:${C.text}}
        .scale{transition:transform .15s} .scale:hover{transform:translateY(-1px)} .scale:active{transform:scale(.97)}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
      `}</style>
      <Onboarding onComplete={handleSetupComplete}/>
    </div>
  );

  const viewProps = {wallets,categories,transactions,milestones,onAdd:openAdd,onEdit:openEdit,onDelete:deleteTx,totalBalance};

  return (
    <div style={{background:C.bg,minHeight:'100vh',color:C.text,fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0} input,select,textarea,button{font-family:inherit}
        .vi:focus{border-color:${C.gold}!important;outline:none} .vi::placeholder{color:${C.muted}} .vi option{background:${C.surface};color:${C.text}}
        .scale{transition:transform .15s} .scale:hover{transform:translateY(-1px)} .scale:active{transform:scale(.97)}
        .sidebar{display:flex;flex-direction:column}
        ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
        .bottomnav{display:none}
        @media(max-width:767px){.sidebar{display:none!important}.bottomnav{display:flex!important}.main-wrap{margin-left:0!important;padding:16px 16px 72px!important}}
        @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      <Sidebar view={view} setView={setView} onAdd={openAdd} totalBalance={totalBalance}
        wallets={wallets} saveIndicator={saveIndicator} lsOk={lsOk||useFirebase}
        fbUser={fbUser} isAdmin={isAdmin} localMode={localMode} onLogout={handleLogout}/>

      <div className="main-wrap" style={{marginLeft:220,padding:'24px 28px',maxWidth:1100,minHeight:'100vh'}}>
        {view==='admin'  && <AdminPanel currentUser={fbUser} onBack={()=>setView('dashboard')}/>}
        {view==='dashboard'   && <Dashboard {...viewProps}/>}
        {view==='transactions' && <TransactionList {...viewProps}/>}
        {view==='analytics'   && <Analytics {...viewProps}/>}
        {view==='milestones'  && <MilestoneView milestones={milestones} setMilestones={setMilestones} wallets={wallets}/>}
        {view==='wallets'     && <WalletManager wallets={wallets} setWallets={setWallets} transactions={transactions}/>}
        {view==='categories'  && <CategoryManager categories={categories} setCategories={setCategories} transactions={transactions}/>}
        {view==='export'      && <ExportView transactions={transactions} wallets={wallets} categories={categories} onReset={handleResetAll} lsOk={lsOk||useFirebase}/>}
      </div>

      <BottomNav view={view} setView={setView} onAdd={openAdd}/>

      {txModal&&(
        <TxModal wallets={wallets} categories={categories} editTx={editTx}
          onClose={()=>{setTxModal(false);setEditTx(null);}} onSave={onSave}/>
      )}
    </div>
  );
}
