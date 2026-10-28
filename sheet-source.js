/* =====================================================================
   قراءة شيت البلاغ — نسخة «الفولدر» (GitHub Pages أو أي استضافة ثابتة)
   ---------------------------------------------------------------------
   الصفحة بتدوّر على ملف الشيت جنب index.html بالترتيب:
     1) الاسم اللي في SHEET_FILE (لو مكتوب)
     2) آخر ملف نجح قبل كده (محفوظ في المتصفح)
     3) أسماء شائعة: baseline.xlsx / Baseline.xlsx / شيت.xlsx / بلاغ.xlsx ...
     4) أي ملف إكسيل أو CSV موجود في الريبو (عن طريق GitHub API)

   يعني مش شرط الاسم يبقى baseline.xlsx — بس ده الأسرع والأضمن.
   ===================================================================== */

/* اكتب اسم ملف معيّن هنا لو عايز تثبّته */
const SHEET_FILE = "";

const SHEET_CANDIDATES = SHEET_FILE ? [SHEET_FILE] : [
  "baseline.xlsx", "Baseline.xlsx", "BASELINE.XLSX", "baseline.XLSX",
  // فخ شائع: ويندوز مخفي الامتدادات → الاسم الحقيقي بيبقى baseline.xlsx.xlsx
  "baseline.xlsx.xlsx", "baseline.csv.xlsx", "baseline.xls.xlsx",
  "Baseline.xlsx.xlsx", "baseline.xlsx.csv",
  "baseline.xls", "baseline.xlsm", "baseline.csv", "baseline.json",
  "sheet.xlsx", "data.xlsx", "الشيت.xlsx", "شيت.xlsx",
  "البلاغ.xlsx", "بلاغ.xlsx", "البلاغ اليومي للادارة.xlsx",
  "البلاغ اليومي للادارة.csv", "البلاغ اليومي للادارة 26.csv"
];

const SHEET_OK_KEY = "mr-sheet-file";        // آخر ملف اتقرأ بنجاح
const SHEET_DIAG   = [];                     // سجل المحاولات (للصفحة التشخيصية)
let   SHEET_DISCOVERED = null;               // آخر قائمة ملفات جت من GitHub
let   SHEET_NET_BLOCKED = false;             // fetch نفسه فشل (file:// أو مفيش شبكة)

/* ملفات JSON مش شيتات — نستثنيها وقت الاكتشاف */
const NOT_SHEETS = new Set(["package.json","package-lock.json","tsconfig.json",
                            "manifest.json","vercel.json","composer.json","now.json"]);
const SHEET_EXT = /\.(xlsx|xlsm|xls|csv)$/i;

/* ---------- معلومات الريبو على GitHub ---------- */
function ghTarget(){
  // ?gh=owner/repo — للتجربة، أو لو الموقع على دومين مخصص
  try{
    const q = new URLSearchParams(location.search).get("gh");
    if(q && q.indexOf("/") > 0){
      const parts = q.split("/");
      return {owner: parts[0], repo: parts.slice(1).join("/"), dir: ""};
    }
  }catch(e){}

  const h = location.hostname;
  if(!/\.github\.io$/i.test(h)) return null;       // مش على GitHub Pages
  const owner = h.split(".")[0];
  const segs = location.pathname.split("/").filter(Boolean);
  // https://owner.github.io/repo/unit.html  → segs = [repo, unit.html]
  const repo = segs.length ? segs[0] : (owner + ".github.io");
  const dir  = segs.length > 1 ? segs.slice(1, -1).join("/") : "";
  return {owner: owner, repo: repo, dir: dir};
}

/* ---------- قائمة الملفات من GitHub API (الريبو لازم يكون عام) ---------- */
async function ghListFiles(){
  const t = ghTarget();
  if(!t) return null;
  const url = "https://api.github.com/repos/" + t.owner + "/" + t.repo +
              "/contents/" + encodeURI(t.dir);
  try{
    const ctl = new AbortController();
    const timer = setTimeout(function(){ ctl.abort(); }, 4000);
    const r = await fetch(url, {signal: ctl.signal, headers: {"Accept":"application/vnd.github+json"}});
    clearTimeout(timer);
    if(!r.ok) return null;
    const list = await r.json();
    if(!Array.isArray(list)) return null;
    return list.filter(f => f && f.type==="file" && SHEET_EXT.test(f.name) && !NOT_SHEETS.has(f.name))
               .map(f => f.name);
  }catch(e){ return null; }
}

/* ترتيب أفضلية: أسماء فيها baseline أو شيت/بلاغ الأول */
function rankSheetNames(names){
  function score(n){
    const s = n.toLowerCase();
    let k = 0;
    if(s.indexOf("baseline") >= 0) k -= 100;
    if(/شيت|بلاغ/.test(n))         k -= 80;
    if(/\.xlsx$|\.xlsm$/i.test(n)) k -= 20;
    else if(/\.xls$/i.test(n))     k -= 10;
    return k;
  }
  return names.slice().sort(function(a,b){ return score(a) - score(b); });
}

/* ---------- آخر ملف نجح ---------- */
function getLastSheet(){ try{ return localStorage.getItem(SHEET_OK_KEY) || ""; }catch(e){ return ""; } }
function setLastSheet(n){ try{ localStorage.setItem(SHEET_OK_KEY, n || ""); }catch(e){} }

/* ---------- الأسماء الأساسية (بدون أي طلب شبكة) ---------- */
function baseSheetNames(){
  const seen = new Set();
  const out = [];
  function push(n){ if(n && !seen.has(n)){ seen.add(n); out.push(n); } }

  if(SHEET_FILE) push(SHEET_FILE);
  push(getLastSheet());
  SHEET_CANDIDATES.forEach(push);
  return out;
}

/* ---------- تحليل نص CSV إلى صفوف ---------- */
function parseCsvText(text){
  const rows=[]; let row=[]; let field=''; let inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQ=false; }
      else field+=c;
    } else {
      if(c==='"') inQ=true;
      else if(c===','){ row.push(field); field=''; }
      else if(c==='\n'||c==='\r'){
        if(c==='\r'&&text[i+1]==='\n') i++;
        row.push(field); field=''; rows.push(row); row=[];
      } else field+=c;
    }
  }
  if(field!==''||row.length>0){ row.push(field); rows.push(row); }
  return rows;
}

/* تحويل قيمة للرقم (يتعامل مع #DIV/0! والنسبة) */
function cv(x){
  if(x===null||x===undefined) return NaN;
  const s=String(x).replace('%','').replace('#DIV/0!','0').replace('\ufeff','').trim();
  if(s==='') return NaN;
  const n=Number(s);
  return isNaN(n)?NaN:n;
}

/* ===== خريطة أعمدة قالب «البلاغ اليومي للادارة» (62 عمود) ===== */
const COLS = {
  name:1, target:2, teams:3,
  e0:[5,4], e1:[7,6], e2:[9,8], n0:[11,10], n1:[13,12], n2:[15,14],
  totC:17, totT:16, pct:18,
  abs:[20,19], absv:[22,21], side:[24,23],
  open:29, recv:[31,30], used:[33,32], remaining:34, rateT:35, rateC:36,
  schTotal:49, schTarget:50, schVisited:51, schVaccT:52, schVacc:53, schPct:54,
  nurTotal:55, nurTarget:56, nurVisited:57, nurVaccT:58, nurVacc:59, nurPct:60
};

/* ================= قراءة تاريخ البلاغ من رأس الشيت =================
   مشكلة شائعة: في الإكسيل الحقيقي خانة «التاريخ» بتكون مخزّنة كـتاريخ
   (كائن Date أو رقم سيريال) مش نص — فالقراءة النصية بتفشل وبيتم اختراع
   تاريخ غلط (تاريخ البلاغ − 1). الدالة دي بتتعامل مع كل الحالات.
   ==================================================================== */

function _pad2(n){ return String(n).padStart(2,"0"); }
function _ymd(y,m,d){ return y + "-" + _pad2(m) + "-" + _pad2(d); }
function _validYMD(y,m,d){
  return y>=2000 && y<=2100 && m>=1 && m<=12 && d>=1 && d<=31;
}
/* أرقام عربية/فارسية → إنجليزية */
function _normDigits(s){
  return String(s).replace(/[\u0660-\u0669]/g, function(d){ return String(d.charCodeAt(0)-0x0660); })
                  .replace(/[\u06F0-\u06F9]/g, function(d){ return String(d.charCodeAt(0)-0x06F0); });
}
/* أي قيمة → تاريخ (Date / سيريال إكسيل / نص) */
function _asDate(v){
  if(v instanceof Date && !isNaN(v.getTime())) return v;
  if(typeof v === "number" && isFinite(v)){
    // سيريال إكسيل (1900): 25569 = 1970-01-01
    if(v > 20000 && v < 80000){
      const dt = new Date(Math.round((v - 25569) * 86400000));
      if(!isNaN(dt.getTime()))
        return new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    }
  }
  return null;
}
/* نص فيه تاريخ بأي شكل → "YYYY-MM-DD" أو "" */
function _dateFromText(s){
  s = _normDigits(s);
  let m = s.match(/(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{4})/);   // 26/10/2026
  if(m){ const d=+m[1], mo=+m[2], y=+m[3]; if(_validYMD(y,mo,d)) return _ymd(y,mo,d); }
  m = s.match(/(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/);       // 2026-10-26
  if(m){ const y=+m[1], mo=+m[2], d=+m[3]; if(_validYMD(y,mo,d)) return _ymd(y,mo,d); }
  return "";
}
function _dateOfValue(v){
  const dt = _asDate(v);
  if(dt) return _ymd(dt.getFullYear(), dt.getMonth()+1, dt.getDate());
  return _dateFromText(String(v==null ? "" : v));
}

function sheetDateFrom(rows, beforeRow){
  const lim = beforeRow > 0 ? beforeRow : rows.length;

  /* ① الأولوية: الصف اللي فيه كلمة «التاريخ» — والقيمة جنبها */
  for(let i=0;i<lim;i++){
    const r = rows[i] || [];
    for(let j=0;j<r.length;j++){
      const txt = _normDigits(String(r[j]==null ? "" : r[j]));
      if(txt.indexOf("التاريخ") < 0) continue;

      // التاريخ مكتوب في نفس الخانة
      const same = _dateFromText(txt);
      if(same) return same;

      // التاريخ في خانة مجاورة (قبل أو بعد) — شائع في الإكسيل
      for(const k of [j+1, j+2, j-1, j-2]){
        if(k < 0 || k >= r.length) continue;
        const got = _dateOfValue(r[k]);
        if(got) return got;
      }
    }
  }

  /* ② مفيش كلمة «التاريخ»: أي خانة فيها تاريخ حقيقي في أول الصفوف */
  for(let i=0;i<Math.min(lim, 15);i++){
    const r = rows[i] || [];
    for(let j=0;j<r.length;j++){
      const dt = _asDate(r[j]);
      if(dt && dt.getFullYear() >= 2000 && dt.getFullYear() <= 2100)
        return _ymd(dt.getFullYear(), dt.getMonth()+1, dt.getDate());
    }
  }

  /* ③ آخر محاولة: أي نص فيه تاريخ كامل */
  for(let i=0;i<Math.min(lim, 15);i++){
    const r = rows[i] || [];
    for(let j=0;j<r.length;j++){
      const got = _dateFromText(String(r[j]==null ? "" : r[j]));
      if(got) return got;
    }
  }

  return "";
}

/* تحليل صفوف البلاغ (نفس النموذج) — بيشتغل مع CSV ومع XLSX بنفس الكود */
function parseRows(rows){
  rows = rows || [];
  let hdr=-1;
  for(let i=0;i<Math.min(rows.length,40);i++){
    const r=rows[i]||[];
    if(r.some(c=>String(c==null?"":c).includes("اسم الوحدة"))){ hdr=i; break; }
  }
  if(hdr<0) return {units:{}, unmatched:[], error:"مافيش شريط أسماء الوحدات في الشيت"};

  let nameCol=COLS.name;
  for(let i=0;i<(rows[hdr]||[]).length;i++){
    if(String(rows[hdr][i]==null?"":rows[hdr][i]).includes("اسم الوحدة")){ nameCol=i; break; }
  }
  const off = nameCol - COLS.name;

  const units={}, unmatched=[], rowsInfo=[];
  let started=false;
  for(let i=hdr+1;i<rows.length;i++){
    const r=rows[i]||[];
    const rawName=String(r[nameCol]==null?"":r[nameCol]).replace(/\ufeff/g,'').trim();
    if(!rawName || /^\d+$/.test(rawName)){ if(started) break; else continue; }
    if(rawName.includes("الاجمالي")||rawName.includes("الإجمالي")) break;
    started=true;
    const u={ __name:rawName, __row:i+1 };
    u.target=cv(r[COLS.target+off]); u.teams=cv(r[COLS.teams+off])||1;
    u.e0_t=cv(r[COLS.e0[1]+off])||0; u.e0=cv(r[COLS.e0[0]+off])||0;
    u.e1_t=cv(r[COLS.e1[1]+off])||0; u.e1=cv(r[COLS.e1[0]+off])||0;
    u.e2_t=cv(r[COLS.e2[1]+off])||0; u.e2=cv(r[COLS.e2[0]+off])||0;
    u.n0_t=cv(r[COLS.n0[1]+off])||0; u.n0=cv(r[COLS.n0[0]+off])||0;
    u.n1_t=cv(r[COLS.n1[1]+off])||0; u.n1=cv(r[COLS.n1[0]+off])||0;
    u.n2_t=cv(r[COLS.n2[1]+off])||0; u.n2=cv(r[COLS.n2[0]+off])||0;
    u.totT=cv(r[COLS.totT+off])||0; u.totC=cv(r[COLS.totC+off])||0; u.pct=String(r[COLS.pct+off]||'').trim();
    u.abs_t=cv(r[COLS.abs[1]+off])||0; u.abs=cv(r[COLS.abs[0]+off])||0;
    u.absv_t=cv(r[COLS.absv[1]+off])||0; u.absv=cv(r[COLS.absv[0]+off])||0;
    u.side_t=cv(r[COLS.side[1]+off])||0; u.side=cv(r[COLS.side[0]+off])||0;
    u.open_prev=cv(r[COLS.open+off])||0;
    u.recv_t=cv(r[COLS.recv[1]+off])||0; u.recvC=cv(r[COLS.recv[0]+off])||0;
    u.used_t=cv(r[COLS.used[1]+off])||0; u.usedC=cv(r[COLS.used[0]+off])||0;
    u.recv=u.recv_t; u.used=u.used_t;
    u.remaining=cv(r[COLS.remaining+off])||0;
    u.rate_t=String(r[COLS.rateT+off]==null?'':r[COLS.rateT+off]).trim();
    u.rate_c=String(r[COLS.rateC+off]==null?'':r[COLS.rateC+off]).trim();
    u.schTotal=cv(r[COLS.schTotal+off])||0; u.schTarget=cv(r[COLS.schTarget+off])||0;
    u.schVisited=cv(r[COLS.schVisited+off])||0; u.schVaccT=cv(r[COLS.schVaccT+off])||0; u.schVacc=cv(r[COLS.schVacc+off])||0;
    u.schPct=String(r[COLS.schPct+off]||'').trim();
    u.nurTotal=cv(r[COLS.nurTotal+off])||0; u.nurTarget=cv(r[COLS.nurTarget+off])||0;
    u.nurVisited=cv(r[COLS.nurVisited+off])||0; u.nurVaccT=cv(r[COLS.nurVaccT+off])||0; u.nurVacc=cv(r[COLS.nurVacc+off])||0;
    u.nurPct=String(r[COLS.nurPct+off]||'').trim();
    u.open=u.remaining;

    const canon=matchUnitName(rawName);
    if(canon){ u.__canon=canon; units[canon]=u; }
    else     { unmatched.push(rawName); units[rawName]=u; }
    rowsInfo.push(u.__row);
  }
  return { units, unmatched, sheetDate: sheetDateFrom(rows, hdr),
           firstRow:rowsInfo[0]||0, lastRow:rowsInfo[rowsInfo.length-1]||0 };
}

/* توافق: استدعاء قديم للـ CSV */
function parseDailyCsv(text){ return parseRows(parseCsvText(text)); }

/* ---------- تحميل مكتبة الإكسيل عند الحاجة بس ---------- */
async function ensureXlsxLib(){
  if(window.XLSX) return true;
  await new Promise(function(resolve,reject){
    const s=document.createElement("script");
    s.src = new URL("xlsx.full.min.js", location.href).href;
    s.onload = resolve;
    s.onerror = function(){ reject(new Error("مكتبة قراءة الإكسيل (xlsx.full.min.js) مش موجودة جنب الصفحة")); };
    document.head.appendChild(s);
  });
  return !!window.XLSX;
}

/* =====================================================================
   قراءة ملف إكسيل مقسّم على كذا ورقة (Sheet)
   ---------------------------------------------------------------------
   القاعدة: كل ورقة = بلاغ يوم مستقل. بنقراهم كلهم بالترتيب، وبناخد لكل
   وحدة **آخر ورقة متسجل فيها متطعمين في اليوم** (totT > 0).
   الورقة اللي فاتت أو فاضية أو ملهاش بيانات — ببنسى قيمها ونستخدم اللي قبلها.
   ===================================================================== */
function readAllSheets(wb){
  const names = wb.SheetNames || [];
  const perSheet = [];        // {name, parsed, day}
  const skipped  = [];        // أوراق اتخطيناها (فاضية / مش شيت بلاغ)

  names.forEach(function(name, idx){
    let rows;
    try{
      const ws = wb.Sheets[name];
      if(!ws) { skipped.push({sheet:name, reason:"مفيش ورقة"}); return; }
      rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:""});
    }catch(e){
      skipped.push({sheet:name, reason:"مقروءة غلط: "+e.message}); return;
    }
    if(!rows || !rows.length){ skipped.push({sheet:name, reason:"فاضية"}); return; }

    const pb = parseRows(rows);
    if(!pb.units || !Object.keys(pb.units).length){
      skipped.push({sheet:name, reason: pb.error || "مفيش وحدات"}); return;
    }
    perSheet.push({name:name, order:idx, parsed:pb, rows:rows});
  });

  /* دمج: نبدأ من آخر ورقة ونمشي بالعكس — أول وحدة نلاقيها بـ«متطعمين اليوم > 0» هي الأحدث */
  const units = {};           // اسم الوحدة → {u, fromSheet, order}
  const unmatched = [];
  const usedSheets = [];

  for(let k = perSheet.length - 1; k >= 0; k--){
    const item = perSheet[k];
    let usedHere = 0;
    Object.keys(item.parsed.units).forEach(function(uname){
      if(units[uname]) return;              // عندنا ورقة أحدث بالفعل
      const u = item.parsed.units[uname];
      // «متسجل فيها متطعم في اليوم» = totT > 0
      if(!(u.totT > 0)) return;             // الورقة دي مش مسجّلة تطعيم لليوم → نسيبها ونكمّل
      units[uname] = {u:u, sheet:item.name, order:item.order};
      usedHere++;
    });
    if(usedHere) usedSheets.push({sheet:item.name, order:item.order, units:usedHere});
  }

  /* لو مفيش أي ورقة فيها totT > 0 (شيت جديد/صفر) → نرجع لآخر ورقة فيها بيانات */
  if(!Object.keys(units).length){
    for(let k = perSheet.length - 1; k >= 0; k--){
      const item = perSheet[k];
      Object.keys(item.parsed.units).forEach(function(uname){
        if(!units[uname]) units[uname] = {u:item.parsed.units[uname], sheet:item.name, order:item.order};
      });
      if(usedSheets.length===0) usedSheets.push({sheet:item.name, order:item.order, units:Object.keys(item.parsed.units).length});
    }
  }

  /* ترتيب الوحدات على ترتيب أول ورقة (عشان الجدول يطلع ثابت) */
  const firstOrder = {};
  perSheet.forEach(function(it){
    Object.keys(it.parsed.units).forEach(function(n){
      if(!(n in firstOrder)) firstOrder[n] = it.parsed.units[n].__row || 0;
    });
  });
  const orderedUnits = {};
  Object.keys(units)
    .sort(function(a,b){ return (firstOrder[a]||9999) - (firstOrder[b]||9999); })
    .forEach(function(n){ orderedUnits[n] = units[n].u; });

  /* التواريخ: من الأوراق اللي فيها تاريخ، الأحدث هو تاريخ البلاغ */
  const dates = perSheet.map(function(it){ return it.parsed.sheetDate; })
                        .filter(function(d){ return !!d; });
  const latestDate = dates.length ? dates.slice().sort().pop() : "";

  /* الورقة المرجعية = أحدث ورقة استُخدمت */
  usedSheets.sort(function(a,b){ return b.order - a.order; });
  const sourceSheet = usedSheets.length ? usedSheets[0].sheet : "";

  return {
    units: orderedUnits,
    unmatched: unmatched,
    sheetDate: latestDate,
    firstRow: 0, lastRow: 0,
    sheetCount: names.length,
    usedSheets: usedSheets,
    skipped: skipped,
    sourceSheet: sourceSheet,
    perSheet: perSheet.map(function(it){
      let tt = 0, n = 0;
      Object.keys(it.parsed.units).forEach(function(k){ tt += it.parsed.units[k].totT || 0; n++; });
      return {sheet: it.name, order: it.order, units: n, todaysTotal: tt, date: it.parsed.sheetDate || ""};
    })
  };
}

/* ---------- قراءة ملف واحد وتحويله لشكل شيت ---------- */
async function readSheetBuffer(buf, ext){
  if(ext === "json"){
    let j = null;
    try{ j = JSON.parse(new TextDecoder("utf-8").decode(buf)); }catch(e){ j = null; }
    if(j && j.units && typeof j.units === "object") return j;
    if(j && typeof j === "object" && !Array.isArray(j)) return {date:"", units:j};
    return {units:{}, error:"ملف JSON مش بصيغة شيت"};
  }
  if(ext === "csv"){
    const text = new TextDecoder("utf-8").decode(buf).replace(/^\ufeff/,"");
    return parseRows(parseCsvText(text));
  }
  await ensureXlsxLib();
  const wb = XLSX.read(buf, {type:"array", cellDates:true});
  const names = wb.SheetNames || [];
  if(names.length <= 1){
    // ملف بورقة واحدة — السلوك القديم
    const ws = wb.Sheets[names[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:""});
    const pb = parseRows(rows);
    pb.sheetCount = 1; pb.usedSheets = [{sheet:names[0], order:0, units:Object.keys(pb.units||{}).length}];
    pb.sourceSheet = names[0] || "";
    return pb;
  }
  // ملف مقسّم على كذا ورقة → دمج
  return readAllSheets(wb);
}

/* ---------- الدالة الرئيسية: تنزيل الشيت من الفولدر ---------- */
/* بترجع {date, units, file, ...} أو {__none:true, tried:[...]} */
async function loadSheetFromFolder(){
  SHEET_DIAG.length = 0;
  SHEET_DISCOVERED = null;
  SHEET_NET_BLOCKED = false;

  /* جرّب ملف واحد — بترجع نتيجة أو null */
  async function tryOne(name){
    const rec = {name: name, status: "?", note: ""};
    try{
      const url = new URL(name, location.href).href + "?v=" + Date.now();
      const r = await fetch(url, {cache:"no-store"});
      rec.status = r.status;
      if(!r.ok){ SHEET_DIAG.push(rec); return null; }

      const buf = await r.arrayBuffer();
      if(buf.byteLength < 64){ rec.status = "فاضي"; SHEET_DIAG.push(rec); return null; }

      const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
      const pb  = await readSheetBuffer(buf, ext);
      const units = (pb && pb.units) || {};

      if(!Object.keys(units).length){
        rec.note = (pb && pb.error) ? pb.error : "مفيش وحدات مفهومة جوه الملف";
        SHEET_DIAG.push(rec); return null;
      }
      rec.note = Object.keys(units).length + " وحدة" + (pb.sheetCount > 1 ? ` (من ${pb.sheetCount} ورقة)` : "");
      SHEET_DIAG.push(rec);
      setLastSheet(name);
      return {
        date: pb.date || pb.sheetDate || "", units: units,
        unmatched: pb.unmatched || [], error: pb.error || "",
        sheetDate: pb.sheetDate || "", firstRow: pb.firstRow || 0,
        lastRow: pb.lastRow || 0, file: name,
        sheetCount: pb.sheetCount || 1,
        usedSheets: pb.usedSheets || [],
        skipped: pb.skipped || [],
        perSheet: pb.perSheet || []
      };
    }catch(e){
      const msg = String((e && e.message) || e);
      rec.note = msg.slice(0, 80);
      // TypeError = المشكلة في الشبكة/البروتوكول، مش إن الملف مش موجود
      if(e && (e.name === "TypeError" || /Failed to fetch|NetworkError|not supported/i.test(msg))){
        rec.status = "شبكة";
        SHEET_NET_BLOCKED = true;
      }
      SHEET_DIAG.push(rec); return null;
    }
  }

  /* ① الأسماء المعروفة — من غير أي انتظار للشبكة */
  const base = baseSheetNames();
  for(const name of base){
    const found = await tryOne(name);
    if(found) return found;
  }

  /* ② لو ملقيناش: نسأل GitHub عن أي ملف إكسيل في الريبو (مرة واحدة) */
  let found2 = null;
  try{ found2 = await ghListFiles(); }catch(e){}
  SHEET_DISCOVERED = found2;
  if(found2 && found2.length){
    for(const name of rankSheetNames(found2)){
      if(base.indexOf(name) >= 0) continue;          // اتجرّب فوق خلاص
      const found = await tryOne(name);
      if(found) return found;
    }
  }

  return {__none: true, tried: base.concat(found2 || []), discovered: found2 || null,
          networkBlocked: SHEET_NET_BLOCKED, protocol: location.protocol};
}

/* ---------- تشخيص: كل المحاولات ---------- */
function sheetDiagnostics(){ return SHEET_DIAG.slice(); }
function sheetDiscovered(){ return SHEET_DISCOVERED; }

/* هل الصفحة مفتوحة من جهازك مباشرة؟ (file://) — المتصفح بيمنع قراءة أي ملف جنبها */
function isLocalFileMode(){ return location.protocol === "file:"; }

/* قراءة شيت من ملف اختاره المستخدم بنفسه (File API — بيشتغل حتى في file://) */
async function loadSheetFromFileObject(file){
  const buf = await file.arrayBuffer();
  if(!buf || buf.byteLength < 64) throw new Error("الملف فاضي أو تالف");
  const ext = ((file.name.split(".").pop()) || "").toLowerCase();
  const pb = await readSheetBuffer(buf, ext === "xlsm" ? "xlsx" : ext);
  const units = (pb && pb.units) || {};
  if(!Object.keys(units).length) throw new Error((pb && pb.error) || "مفيش وحدات مفهومة جوه الملف");
  return {
    date: pb.date || pb.sheetDate || "", units: units,
    unmatched: pb.unmatched || [], error: pb.error || "",
    sheetDate: pb.sheetDate || "", firstRow: pb.firstRow || 0,
    lastRow: pb.lastRow || 0, file: file.name
  };
}
