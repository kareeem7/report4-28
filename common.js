/* ===== بلاغ الحملة القومية للتطعيم —  JavaScript مشترك ===== */

/* أسماء الوحدات الـ 34 (الإدارة الصحية / قويسنا — المنوفية) */
const UNITS = [
  "مكتب الصحة", "شبرابخوم", "ميت بره", "أبنهس", "ميت سراج", "أم خنان",
  "أجهور الرمل", "منشأة دملو", "شرانيس", "قويسنا البلد", "بجيرم", "كفر بني غريان",
  "بقسا", "كفر الأكرم", "كفر إبنهس", "الرمالي", "مصطاي", "كفر طه شبرا",
  "كفر أبو الحسن", "ميت أبو شيخه", "طه شبرا", "أشليم", "شبرا قبالة", "عرب الرمل",
  "كفر ميت سراج", "كفر أبشيش", "كفر ميت العبسي", "كفر وهب", "دمهوج", "كفر زين الدين",
  "عزبة أبو النصر", "شمنديل", "كفور الرمل", "منشأة أم خنان"
];

/* ---------- تطبيع أسماء الوحدات ----------
   الشيت بيكتب الأسماء بـ: تطويل (ـ) و ى بدل ي و ة بدل ه و مسافات مختلفة
   (شبرابخـــــوم / الرمــالى / شبرا قبالــه / ميت أبـوشيخه)
   الدالة دي بتوحّد الشكل عشان المطابقة تشتغل مهما اختلف الرسم. */
function normUnitName(s){
  return String(s==null?"":s)
    .replace(/[\u0640\u064B-\u065F\u0670\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,"") // تطويل + تشكيل + محارف اتجاه
    .replace(/[أإآٱ]/g,"ا")
    .replace(/[ىئ]/g,"ي").replace(/ؤ/g,"و")
    .replace(/ة/g,"ه")
    .replace(/[\s\u00A0\u2007\u202F]+/g,"")          // كل أنواع المسافات
    .replace(/[.،,\-–—_/\\]+/g,"")
    .trim();
}
/* مسافة تعديل بسيطة (Levenshtein) — للمطابقة التقريبية */
function editDistance(a,b){
  a=[...a]; b=[...b];
  if(!a.length) return b.length; if(!b.length) return a.length;
  let prev=Array.from({length:b.length+1},(_,i)=>i), cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){
    cur[0]=i;
    for(let j=1;j<=b.length;j++){
      cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    [prev,cur]=[cur,prev];
  }
  return prev[b.length];
}

/* بيرجع اسم الوحدة الرسمي من قائمة UNITS، أو "" لو مش لاقيه.
   1) مطابقة حرفية → 2) مطابقة بعد التطبيع (تطويل/ى/ة/مسافات) → 3) مطابقة تقريبية (خطأ كتابة بسيط) */
function matchUnitName(raw){
  const rawTrim = String(raw==null?"":raw).trim();
  if(!rawTrim) return "";
  const exact = UNITS.find(u=>u===rawTrim);
  if(exact) return exact;
  const k = normUnitName(rawTrim);
  if(!k) return "";
  const hits = UNITS.filter(u=>normUnitName(u)===k);
  if(hits.length) return hits[0];

  // مطابقة تقريبية: أقرب اسم بفارق ≤ 2 حرف، وبشرط تكون أفضلية واحدة واضحة
  if(k.length>=5){
    let best=null, bestD=99, tie=false;
    UNITS.forEach(u=>{
      const d=editDistance(k, normUnitName(u));
      if(d<bestD){ bestD=d; best=u; tie=false; }
      else if(d===bestD){ tie=true; }
    });
    if(best && bestD>0 && bestD<=2 && !tie) return best;
  }
  return "";
}

/* ---------- مساعدة ---------- */
const $ = id => document.getElementById(id);
function num(id){ const v=$(id).value.trim(); const n=Number(v); return v==="" ? 0 : (isNaN(n)?0:n); }
/* تحويل مرن: بيشيل الفواصل والـ% وبيحوّل الأرقام العربية، وبيرجع NaN لو فاضي */
function numv(x){
  if(x===null||x===undefined) return NaN;
  let s=String(x).replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-0x0660))
                   .replace(/[\u06F0-\u06F9]/g,d=>String(d.charCodeAt(0)-0x06F0))
                   .replace(/[,،\s\u00A0]/g,"").replace(/%/g,"").trim();
  if(s===""||/^#/.test(s)) return NaN;
  const n=Number(s); return isNaN(n)?NaN:n;
}
function fmt(n){ return Number(n||0).toLocaleString("ar-EG"); }
function todayLocal(){
  const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10);
}
function prevDateStr(dateStr){
  if(!dateStr) return "";
  const p=dateStr.split("-").map(Number); const d=new Date(p[0],p[1]-1,p[2]); d.setDate(d.getDate()-1);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

/* =====================================================================
   الطبقة المشتركة (سيرفر + ملف الفولدر + كاش محلي)
   ---------------------------------------------------------------------
   API_BASE بيتحسب من مسار الصفحة نفسها، عشان الموقع يشتغل صح سواء كان في
   جذر الدومين (سيرفر محلي) أو في مسار فرعي زي GitHub Pages: /mr-report/
   ===================================================================== */
const API_BASE = (function(){
  try{
    const base = new URL(".", location.href).pathname;      // "/" أو "/mr-report/"
    return base.replace(/\/$/, "");                         // ""  أو "/mr-report"
  }catch(e){ return ""; }
})();
const ADMIN_KEY_LS = "mr-admin-key";
let __baselineCache = null;        // نسخة في الذاكرة عشان الاستخدام يبقى فوري
let __serverInfo = {reachable:false, adminRequired:false};

function apiUrl(path){ return (API_BASE || "") + path; }
function adminKey(){ try{ return localStorage.getItem(ADMIN_KEY_LS) || ""; }catch(e){ return ""; } }
function setAdminKey(k){ try{ localStorage.setItem(ADMIN_KEY_LS, k||""); }catch(e){} }
function apiHeaders(extra){
  const h = Object.assign({"Content-Type":"application/json"}, extra||{});
  const k = adminKey(); if(k) h["x-admin-key"] = encodeURIComponent(k);  // الهيدر لازم ASCII
  return h;
}

/* فحص السيرفر مرة واحدة */
async function serverStatus(force){
  if(__serverInfo.checked && !force) return __serverInfo;
  try{
    const r = await fetch(apiUrl("/api/health"), {cache:"no-store"});
    if(r.ok){
      const j = await r.json();
      __serverInfo = {reachable:!!j.server, adminRequired:!!j.adminRequired, name:j.name, checked:true};
    }else __serverInfo = {reachable:false, adminRequired:false, checked:true};
  }catch(e){ __serverInfo = {reachable:false, adminRequired:false, checked:true}; }
  return __serverInfo;
}

/* تحميل شيت اليوم السابق — ترتيب الأولوية:
     1) السيرفر (لو شغّال بـ server.js)
     2) ملف الشيت اللي في الفولدر جنب index.html  ← وضع GitHub Pages
     3) الكاش المحلي على الجهاز (أوفلاين)
   بيرجع {source, baseline, file, unmatched} — source ∈ server | folder | local | empty */
async function loadBaselineFromServer(){
  /* فتح الصفحة من جهازك مباشرة (file://)؟ المتصفح بيمنع قراءة أي ملف جنبها.
     في الحالة دي بنكمّل بالكاش المحلي ونرجّع سبب واضح. */
  if(typeof isLocalFileMode === "function" && isLocalFileMode()){
    const localKB = getBaselineLocal();
    if(localKB && localKB.units && Object.keys(localKB.units).length){
      __baselineCache = localKB;
      return {source:"local", baseline:localKB, localMode:true};
    }
    __baselineCache = {date:"", units:{}};
    return {source:"open-local", baseline:null, localMode:true, protocol:"file:"};
  }

  await serverStatus();

  /* 1) السيرفر */
  if(__serverInfo.reachable){
    try{
      const r = await fetch(apiUrl("/api/baseline"), {cache:"no-store"});
      if(r.ok){
        const j = await r.json();
        if(j && j.units && Object.keys(j.units).length){
          __baselineCache = j; setBaselineLocal(j);
          return {source:"server", baseline:j};
        }
      }
    }catch(e){}
  }

  /* 2) ملف الفولدر (وضع جيت هاب) */
  let folderDiag = null;
  try{
    const pb = await loadSheetFromFolder();
    if(pb && !pb.__none){
      const b = {date: pb.date, units: pb.units, file: pb.file,
                 sheetCount: pb.sheetCount || 1, usedSheets: pb.usedSheets || [],
                 skipped: pb.skipped || [], perSheet: pb.perSheet || []};
      __baselineCache = b; setBaselineLocal(b);
      return {source:"folder", baseline:b, file:pb.file, unmatched:pb.unmatched||[]};
    }
    if(pb && pb.__none) folderDiag = pb;
  }catch(e){}

  /* 3) الكاش المحلي */
  const local = getBaselineLocal();
  if(local && local.units && Object.keys(local.units).length){
    __baselineCache = local;
    return {source:"local", baseline:local};
  }
  __baselineCache = {date:"", units:{}};
  const netBlocked = !!(folderDiag && folderDiag.networkBlocked);
  return {source: netBlocked ? "blocked" : (__serverInfo.reachable ? "server-empty" : "empty"),
          baseline:null,
          tried: folderDiag ? folderDiag.tried : [],
          discovered: folderDiag ? folderDiag.discovered : null,
          networkBlocked: netBlocked,
          protocol: location.protocol};
}

/* عمر الشيت بالأيام — عشان ننبّه لو الملف قديم */
function baselineAgeDays(){
  const d = baselineDate();
  if(!d) return null;
  const p = d.split("-").map(Number);
  if(p.length!==3 || !p[0]) return null;
  const then = new Date(p[0], p[1]-1, p[2], 12, 0, 0);
  const now  = new Date(); now.setHours(12,0,0,0);
  return Math.round((now - then) / 86400000);
}

/* رفع الشيت للسيرفر (الإدارة) */
async function pushBaselineToServer(obj, userLabel){
  await serverStatus();
  if(!__serverInfo.reachable) return {ok:false, error:"السيرفر غير متاح"};
  try{
    const r = await fetch(apiUrl("/api/baseline"), {
      method:"POST", headers: apiHeaders({"x-user": userLabel||"admin"}),
      body: JSON.stringify(obj)
    });
    const j = await r.json().catch(()=>({}));
    if(!r.ok) return {ok:false, error: j.error || ("HTTP "+r.status), needKey: r.status===401};
    return {ok:true, unitsCount:j.unitsCount, savedAt:j.savedAt};
  }catch(e){ return {ok:false, error:e.message}; }
}

/* بلاغات الوحدات (للإدارة) */
async function loadReportsFromServer(date){
  if(!date) return {units:{}, source:"none"};
  await serverStatus();
  if(__serverInfo.reachable){
    try{
      const r = await fetch(apiUrl("/api/reports?date="+encodeURIComponent(date)), {cache:"no-store"});
      if(r.ok){
        const j = await r.json();
        return {units: j.units || {}, source:"server", count:j.count||0};
      }
    }catch(e){}
  }
  return {units:{}, source:"local"};
}
async function pushReportToServer(payload){
  await serverStatus();
  if(!__serverInfo.reachable) return {ok:false, error:"offline"};
  try{
    const r = await fetch(apiUrl("/api/reports"), {
      method:"POST", headers: apiHeaders(), body: JSON.stringify(payload)
    });
    const j = await r.json().catch(()=>({}));
    return r.ok ? {ok:true, count:j.count} : {ok:false, error:j.error||("HTTP "+r.status)};
  }catch(e){ return {ok:false, error:e.message}; }
}

/* ---------- شيت اليوم السابق — تخزين محلي (كاش/وضع أوفلاين) ---------- */
const BASELINE_KEY = "mr-prevday-baseline";
function getBaselineLocal(){
  try{ return JSON.parse(localStorage.getItem(BASELINE_KEY) || "{}"); }catch(e){ return {}; }
}
function setBaselineLocal(obj){
  try{ localStorage.setItem(BASELINE_KEY, JSON.stringify(obj)); }catch(e){}
}
/* القراءة المتزامنة اللي بيستخدمها باقي الكود: الكاش الأول ثم المحلي */
function getBaseline(){
  if(__baselineCache) return __baselineCache;
  return getBaselineLocal();
}
function setBaseline(obj){
  __baselineCache = obj;
  setBaselineLocal(obj);
}
function baselineDate(){ const b=getBaseline(); return b.date || ""; }
/* البحث بيشتغل حتى لو اسم الوحدة في الشيت مكتوب بشكل مختلف (تطويل/ى/ة/مسافات)
   وكمان بيدعم الشيتات القديمة المحفوظة بأسماء خام */
function baselineUnit(unit){
  const b=getBaseline(); const units=(b && b.units) || {};
  if(units[unit]) return units[unit];
  const k=normUnitName(unit);
  if(!k) return null;
  for(const name in units){ if(normUnitName(name)===k) return units[name]; }
  return null;
}

/* ---------- ثوابت الوحدة (تُحفظ أول مرة تُدخل) ---------- */
function unitBaseKey(unit){ return "mr-unit-base-" + unit; }
function getUnitBase(unit){
  try{ return JSON.parse(localStorage.getItem(unitBaseKey(unit)) || "{}"); }catch(e){ return {}; }
}
function setUnitBase(unit, obj){
  try{ localStorage.setItem(unitBaseKey(unit), JSON.stringify(obj)); }catch(e){}
}

/* ---------- تجميع بيانات اليوم للوحدة (للإدارة) ---------- */
function unitSavedKey(unit, date){ return "mr-unit-saved-" + unit + "-" + date; }
function saveUnitData(unit, date, payload){
  try{ localStorage.setItem(unitSavedKey(unit,date), JSON.stringify(payload)); }catch(e){}
}
function getUnitSaved(unit, date){
  try{ return JSON.parse(localStorage.getItem(unitSavedKey(unit,date)) || "null"); }catch(e){ return null; }
}
