/* ===== توليد البلاغ على النموذج الرسمي «بلاغ حملة الحصبة» — بدون إنترنت =====
   الطريقة: خلفية القالب (3 صفحات 250dpi) + كتابة الأرقام فوقها بخط عربي عريض
   كل الإحداثيات بالـ pt من الـPDF الأصلي (A4 أفقي 841.92 × 595.32). */

/* ---------- بناء PDF من صفحات JPEG ---------- */
function jpegsToPdfBlob(pages, pageW, pageH){
  const enc = str => { const a=new Uint8Array(str.length); for(let i=0;i<str.length;i++) a[i]=str.charCodeAt(i)&0xff; return a; };
  const parts=[]; let offset=0; const offsets=[];
  const pushBytes=b=>{parts.push(b); offset+=b.length;};
  const pushStr=s=>pushBytes(enc(s));
  const startObj=id=>{offsets[id]=offset; pushStr(`${id} 0 obj\n`);};
  const endObj=()=>pushStr("endobj\n");

  pushStr("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  startObj(1); pushStr("<< /Type /Catalog /Pages 2 0 R >>\n"); endObj();

  const N=pages.length;
  const kids=[]; for(let i=0;i<N;i++) kids.push((3+i*3)+" 0 R");
  startObj(2); pushStr(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${N} >>\n`); endObj();

  for(let i=0;i<N;i++){
    const pId=3+i*3, imId=pId+1, cId=pId+2;
    startObj(pId);
    pushStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /XObject << /Im${i} ${imId} 0 R >> >> /Contents ${cId} 0 R >>\n`);
    endObj();

    const b64=pages[i].dataUrl.split(",")[1];
    const bin=atob(b64);
    const img=new Uint8Array(bin.length);
    for(let j=0;j<bin.length;j++) img[j]=bin.charCodeAt(j);

    startObj(imId);
    pushStr(`<< /Type /XObject /Subtype /Image /Width ${pages[i].w} /Height ${pages[i].h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`);
    pushBytes(img); pushStr("\nendstream\n"); endObj();

    const cs=`q\n${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm\n/Im${i} Do\nQ\n`;
    startObj(cId);
    pushStr(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\n`); endObj();
  }

  const xref=offset;
  pushStr("xref\n0 "+(N*3+3)+"\n0000000000 65535 f \n");
  for(let i=1;i<N*3+3;i++) pushStr(String(offsets[i]).padStart(10,"0")+" 00000 n \n");
  pushStr(`trailer\n<< /Size ${N*3+3} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, {type:"application/pdf"});
}

function triggerDownload(blob, filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}

/* ---------- الخط ---------- */
let __rptFontFamily = null;
async function ensureReportFont(){
  if(__rptFontFamily!==null) return __rptFontFamily;
  const tryLoad = async (family, src) => {
    const f=new FontFace(family, src, {weight:"700", style:"normal"});
    await f.load(); document.fonts.add(f); return family;
  };
  let fam="Tahoma, Arial, sans-serif";
  for(const file of ["Almarai-Bold.ttf","Almarai-Bold.TTF","Almarai-Regular.ttf"]){
    try{ fam = await tryLoad("ReportArabic", `url('${file}')`); break; }catch(e){}
  }
  __rptFontFamily=fam;
  return fam;
}

/* ---------- أدوات رسم ---------- */
const RPT = { W:841.92, H:595.32, DPI:300 };

function rptCanvas(){
  const s=RPT.DPI/72;
  const c=document.createElement("canvas");
  c.width=Math.round(RPT.W*s); c.height=Math.round(RPT.H*s);
  return c;
}

function loadImg(src){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>res(im); im.onerror=rej; im.src=src;
  });
}

/* كتابة نص داخل خلية مع تصغير تلقائي لو مش داخل */
function cell(ctx, txt, x0, y0, x1, y1, opt){
  opt=opt||{};
  const s=RPT.DPI/72;
  const cx=(x0+x1)/2*s, cy=(y0+y1)/2*s;
  // تنظيف الخلية قبل الكتابة (بيخلي الأرقام واضحة فوق أي خطوط في الخلفية)
  if(opt.clear!==false && txt!==""){
    ctx.save(); ctx.fillStyle="#fff"; ctx.direction="ltr";
    ctx.fillRect((x0+1.1)*s, (y0+1.1)*s, (x1-x0-2.2)*s, (y1-y0-2.2)*s); ctx.restore();
  }
  const maxW=(x1-x0-3.0)*s;              // 3pt هامش داخلي
  const maxH=(y1-y0)*s;
  let size=(opt.size || Math.min(16, maxH*0.55*(72/RPT.DPI)*3 )) ; // احتياطي
  size=opt.size||14;
  const fam=opt.fam||"Tahoma";
  const setFont=(sz)=>{ ctx.font=`700 ${(sz*s).toFixed(2)}px ${fam}`; };
  setFont(size);
  let w=ctx.measureText(txt).width;
  while(w>maxW && size>6.5){ size-=0.5; setFont(size); w=ctx.measureText(txt).width; }
  ctx.textAlign=opt.align||"center";
  ctx.textBaseline="middle";
  const X = opt.align==="left" ? (x0+2)*s : (opt.align==="right" ? (x1-2)*s : cx);
  ctx.fillText(txt, X, cy);
}

/* كتابة نص رأسي (عمود ضيق): يمسح الخانة ويرسم النص بزاوية 90° */
function vcell(ctx, txt, x0, y0, x1, y1, opt){
  opt=opt||{};
  const s=RPT.DPI/72;
  ctx.save();
  ctx.fillStyle="#fff"; ctx.direction="ltr";
  ctx.fillRect((x0+1.1)*s,(y0+1.1)*s,(x1-x0-2.2)*s,(y1-y0-2.2)*s);
  const cx=(x0+x1)/2*s, cy=(y0+y1)/2*s;
  const maxLen=(y1-y0-6)*s, maxW=(x1-x0)*s;
  let size=opt.size||13;
  const fam=opt.fam||"Tahoma";
  const setF=sz=>{ ctx.font=`700 ${(sz*s).toFixed(2)}px ${fam}`; };
  setF(size);
  let w=ctx.measureText(txt).width;
  while((w>maxLen || size*s>maxW) && size>7){ size-=0.5; setF(size); w=ctx.measureText(txt).width; }
  ctx.translate(cx,cy); ctx.rotate(-Math.PI/2);
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillStyle="#000";
  ctx.fillText(txt,0,0);
  ctx.restore();
}

/* ---------- تنسيقات ---------- */
const fmtNum = n => (n===0||n) ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,"") : "";
const fmtPct = (num,den) => (den>0 ? ((num/den*100).toFixed(1)+"%") : "");
function fmtDate(d){
  if(!d) return "";
  const p=String(d).split("-");
  return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : String(d);
}

/* ---------- خريطة خلايا النموذج (pt) ---------- */
const ROWS_A   = [[217.44,247.56],[247.56,276.84],[276.84,306.72],[306.72,348.96]]; // 1 · 2 · 3 · اجمالى
const ROWS_D   = [[418.3,447.2],[447.2,475.3],[475.3,504.2],[504.2,522.5]];
const ROWS_E   = [[288.0,331.8],[331.8,374.8],[374.8,418.8],[418.8,463.4]];

/* عناوين سطر (اليوم / التاريخ / الوحدة) لكل صفحة/قسم */
const HDRS = {
  p1top:  {y:[84,99],     day:[18,90],    date:[118,208],  unit:[240,322]},
  p1mid:  {y:[431,443],   day:[18,78],    date:[108,190],  unit:[229,314]},
  p2mid:  {y:[305,317],   day:[18,88],    date:[116,205],  unit:[248,330]},
  p3top:  {y:[126,138],   day:[20,89],    date:[122,188],  unit:[245,321]}
};

/* ---------- محرك التقرير ---------- */
async function renderUnitReport(unit, date, day, d){
  const fam = await ensureReportFont();
  const s = RPT.DPI/72;
  const pages=[];
  const bgs = await Promise.all([0,1,2].map(i=>loadImg(
    PDF_BG[i].startsWith("data:") ? PDF_BG[i] : "data:image/png;base64,"+PDF_BG[i]
  )));

  /* --- أدوات مساعدة لكل صفحة --- */
  // يكتب نفس القيم في أكتر من صف (صف الفريق 1 + صف الإجمالي)
  function fillRows(ctx, rows, cells, opt){
    rows.forEach(r=>{
      cells.forEach(c=>{
        if(c[2]===""||c[2]===null||c[2]===undefined) return;
        cell(ctx, c[2], c[0], r[0], c[1], r[1], opt);
      });
    });
  }
  function newPage(idx){
    const c=rptCanvas(); const ctx=c.getContext("2d");
    ctx.drawImage(bgs[idx],0,0,c.width,c.height);
    ctx.fillStyle="#000"; ctx.direction="ltr";
    return {c,ctx};
  }
  function header(ctx, h, dayVal, dateVal, unitVal){
    const y0=h.y[0], y1=h.y[1];
    cell(ctx, String(dayVal||""), h.day[0], y0, h.day[1], y1, {size:12, fam});
    cell(ctx, fmtDate(dateVal), h.date[0], y0, h.date[1], y1, {size:12, fam});
    cell(ctx, unitVal||"", h.unit[0], y0, h.unit[1], y1, {size:11, fam});
  }
  const N = (v)=> (v===0||v) ? fmtNum(v) : "";
  const pct = (n,dn)=> dn>0 ? fmtPct(n,dn) : "";

  /* ================= صفحة 1 ================= */
  {
    const {c,ctx}=newPage(0);
    header(ctx, HDRS.p1top, day, date, unit);

    // الأعمدة (النموذج RTL): [x0,x1,القيمة]
    const cellsA = [
      [ 14.28, 47.52, pct(d.totC,d.target)],   // النسبة
      [105.48,163.56, N(d.totT)],              // الإجمالى — اليوم
      [ 47.52,105.48, N(d.totC)],              // الإجمالى — حتى اليوم
      [679.56,726.48, N(d.e0t)], [632.64,679.56, N(d.e0C)],   // م 9شهور
      [585.72,632.64, N(d.e1t)], [538.80,585.72, N(d.e1C)],   // م من عام
      [491.88,538.80, N(d.e2t)], [444.96,491.88, N(d.e2C)],   // م 5-10
      [398.04,444.96, N(d.n0t)], [351.12,398.04, N(d.n0C)],   // ن 9شهور
      [304.20,351.12, N(d.n1t)], [257.28,304.20, N(d.n1C)],   // ن من عام
      [210.48,257.28, N(d.n2t)], [163.56,210.48, N(d.n2C)]    // ن 5-10
    ];
    fillRows(ctx, [ROWS_A[0], ROWS_A[3]], cellsA, {size:13.5, fam});
    // عمودا المستهدف وعدد الفرق (أعمدة رأسية ضيقة)
    [[726.48,762.60,N(d.teams)],[762.60,798.48,N(d.target)]].forEach(c=>{
      // صفوف الفرق 1..3 فقط — صف «اجمالى الوحدة» فيه عنوان مش خانة أرقام
      ROWS_A.slice(0,3).forEach(r=>{ if(c[2]!=='') cell(ctx,c[2],c[0],r[0],c[1],r[1],{size:12,fam,clear:false}); });
    });
    // إعادة كتابة العناوين الرأسية بخط واضح بدل المتداخلة في الأصل
    vcell(ctx,"رقم الفريق",798.48,125.3,826.32,217.44,{size:12,fam});
    vcell(ctx,"المستهدف",  762.60,125.3,798.48,217.44,{size:12,fam});
    vcell(ctx,"عدد الفرق", 726.48,125.3,762.60,217.44,{size:12,fam});
    vcell(ctx,"النسبة",     14.28,125.3, 47.52,217.44,{size:12,fam});

    // جدول المتغيبين والآثار (صف واحد)
    const yB=[534.0,558.0];
    const putB=(txt,x0,x1)=> cell(ctx, txt, x0, yB[0], x1, yB[1], {size:13, fam});
    putB(N(d.abst), 683.28,815.64);  putB(N(d.absC), 550.80,683.28);   // المتغيبين
    putB(N(d.absvt),418.56,550.80);  putB(N(d.absvC),286.08,418.56);   // المطعمين من المتغيبين
    putB(N(d.sidet),153.72,286.08);  putB(N(d.sideC), 21.36,153.72);   // الآثار الجانبية

    header(ctx, HDRS.p1mid, day, date, unit);
    pages.push({dataUrl:c.toDataURL("image/jpeg",0.93), w:c.width, h:c.height});
  }

  /* ================= صفحة 2 ================= */
  {
    const {c,ctx}=newPage(1);

    // جدول المدارس والحضانات (صف واحد)
    const yC=[179.3,224.6];
    const putC=(txt,x0,x1)=> cell(ctx, txt, x0, yC[0], x1, yC[1], {size:12.5, fam});
    putC(N(d.schTotal), 766.1,815.8); putC(N(d.schTarget),690.5,766.1);
    putC(N(d.schVisited),627.8,690.5); putC(N(d.schVaccT),562.6,627.8);
    putC(N(d.schVacc),  477.6,562.6); putC(pct(d.schVacc,d.schTarget),418.8,477.6);
    putC(N(d.nurTotal), 364.1,418.8); putC(N(d.nurTarget),288.5,364.1);
    putC(N(d.nurVisited),227.3,288.5); putC(N(d.nurVaccT),162.2,227.3);
    putC(N(d.nurVacc),   73.0,162.2); putC(pct(d.nurVacc,d.nurTarget),21.4,73.0);

    header(ctx, HDRS.p2mid, day, date, unit);

    // جدول حركة الطعوم — صف «اجمالى الفرق»
    const cellsD = [
      [553.0,723.1, N(d.recv)],
      [382.8,553.0, N(d.used)],
      [212.9,382.8, N(d.remaining)],
      [ 42.7,212.9, (d.rate!==undefined&&d.rate!==null&&d.rate!=="") ? String(d.rate) : ""]
    ];
    fillRows(ctx, [ROWS_D[0], ROWS_D[3]], cellsD, {size:13.5, fam});

    pages.push({dataUrl:c.toDataURL("image/jpeg",0.93), w:c.width, h:c.height});
  }

  /* ================= صفحة 3 ================= */
  {
    const {c,ctx}=newPage(2);
    header(ctx, HDRS.p3top, day, date, unit);

    const cellsE = [
      [ 21.7, 99.2, d.rateUntil?String(d.rateUntil):""],  // معدل الزجاجة حتى اليوم
      [ 99.2,184.3, N(d.remaining)],                      // المتبقية
      [184.3,276.5, N(d.used)],                           // المستهلكة — اليوم
      [276.5,368.9, N(d.usedC)],                          // المستهلكة — حتى اليوم
      [368.9,468.0, N(d.recv)],                           // الواردة — اليوم
      [468.0,567.1, N(d.recvC)],                          // الواردة — حتى اليوم
      [567.1,659.5, N(d.open)],                           // الرصيد أول اليوم
      [659.5,780.1, "1"]                                  // التشغيلة
    ];
    fillRows(ctx, [ROWS_E[0], ROWS_E[3]], cellsE, {size:13.5, fam});
    vcell(ctx,"ثلاجة الوحدة",780.10,158.6,822.70,418.8,{size:13,fam});

    pages.push({dataUrl:c.toDataURL("image/jpeg",0.93), w:c.width, h:c.height});
  }

  return pages;
}
