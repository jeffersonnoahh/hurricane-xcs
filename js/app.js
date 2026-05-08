// ══ CONSTANTS ══
const P={
  'XCSR V2':550000,'XCSR V3':775000,'XCSR TURBO':1750000,'XCSR SUPERFAST':3850000,
  'ECOPOWER':1750000,'ECOTURBO':2780000,'ULTRABOOST':1850000,'EV':3150000,
  'EV POWER':5250000,'XCS 5':2595000,'XCS 7':3990000,'TWIN TURBO':5775000,
  'SUPERFAST':9555000,'COMPETITION':15750000,'SPRING BUFFER':2500000
};
let TM={
  'Christ A':{m:['Arfin','Erica','Nathan'],c:'#3b9eff',bg:'#0d1e30',e:'✝️'},
  'Christ B':{m:['Labib','Rico'],c:'#7b6fff',bg:'#150d30',e:'✝️'},
  'Livia':   {m:['Shifa','Livia','Sales 1'],c:'#cc44cc',bg:'#2a1230',e:'🌸'},
  'Valen':   {m:['Valen','Melda','Maryam','Amel'],c:'#f5c518',bg:'#1a1400',e:'🔥'},
  'Agung':   {m:['Agung','Rei','Koko','Luthfi'],c:'#2eccc8',bg:'#0d2020',e:'🦁'},
  'Ivan':    {m:['Ivan','Hendri'],c:'#ff6b1a',bg:'#2a1200',e:'⚡'},
  'Noah':    {m:['Stanley'],c:'#2ecc71',bg:'#0d2015',e:'⚓'},
};
// Keep a backup of default teams for recovery
const TM_DEFAULT=JSON.parse(JSON.stringify(TM));
let TC=160,TR=70000000;
// Load saved targets on startup
try{
  const _savedCfg=JSON.parse(localStorage.getItem('hxcs_config')||'{}');
  if(_savedCfg.chatTarget)TC=_savedCfg.chatTarget;
  if(_savedCfg.revTarget)TR=_savedCfg.revTarget;
}catch(e){}

// ══ STATE (must be before window.onload) ══
let vOff=0,allData={},allActs={};

// ══ INIT — wait for DOM + Firebase ══
window.onload = function(){
  try {
    firebase.initializeApp({
      apiKey:"AIzaSyDfWkhwB3flykNloLRKaXwkNWfxbY22H2g",
      authDomain:"hurricane-scorecard.firebaseapp.com",
      databaseURL:"https://hurricane-scorecard-default-rtdb.firebaseio.com",
      projectId:"hurricane-scorecard",
      storageBucket:"hurricane-scorecard.firebasestorage.app",
      messagingSenderId:"13981949757",
      appId:"1:13981949759:web:356458e60883bf36ab3d8a"
    });
    window.db = firebase.database();

    db.ref('scores').on('value', snap=>{
      const data=snap.val()||{};
      allData={};
      Object.keys(data).forEach(k=>{
        const v=data[k];
        allData[k]=Array.isArray(v)?v:Object.values(v);
      });
      renderAll();
      if(adminUnlocked&&document.getElementById('page-admin')&&document.getElementById('page-admin').classList.contains('active')){
        if(typeof renderEditRecords==='function')renderEditRecords();
      }
    });
    db.ref('activities').on('value', snap=>{
      const data=snap.val()||{};
      allActs={};
      Object.keys(data).forEach(k=>{
        const v=data[k];
        allActs[k]=Array.isArray(v)?v:Object.values(v);
      });
      renderAll();
      if(adminUnlocked&&document.getElementById('page-admin')&&document.getElementById('page-admin').classList.contains('active')){
        if(typeof renderEditRecords==='function')renderEditRecords();
      }
    });
  } catch(err){
    console.warn('Firebase failed, using localStorage fallback:', err);
    // Fallback to localStorage if Firebase blocked
    try {
      const saved = JSON.parse(localStorage.getItem('hxcs')||'{}');
      allData = saved.s||{};
      allActs = saved.a||{};
    } catch(e){}
    // Override sE/sA to use localStorage
    window.sE = function(arr){ allData[gvk()]=arr; try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){} };
    window.sA = function(arr){ allActs[gvk()]=arr; try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){} };
    renderAll();
  }

  // FORCE populate SP dropdowns multiple times to be safe
  updateSPList();
  updateActSP();
  setTimeout(()=>{updateSPList();updateActSP();},50);
  setTimeout(()=>{updateSPList();updateActSP();},500);
  setTimeout(()=>{updateSPList();updateActSP();},1500);
  initActDate();
  document.getElementById('monthLabel').textContent=fMonthName(mYear,mMonth);
  renderAll();
  if(typeof loadGlobalConfig==='function')loadGlobalConfig();
  if(typeof updateGoalCardText==='function')updateGoalCardText(TC,TR);

  // ══ MIDNIGHT AUTO-REFRESH ══
  // Schedule first refresh at next 00:00, then every 24 hours
  setupMidnightRefresh();
};

function setupMidnightRefresh(){
  const now=new Date();
  const tomorrow=new Date(now);
  tomorrow.setDate(now.getDate()+1);
  tomorrow.setHours(0,0,0,500); // 00:00:00.500 to ensure we're past midnight
  const msUntilMidnight=tomorrow.getTime()-now.getTime();

  console.log('Next auto-refresh at midnight in '+Math.round(msUntilMidnight/60000)+' minutes');

  setTimeout(()=>{
    // At midnight: refresh everything
    midnightRefresh();
    // Then schedule every 24 hours
    setInterval(midnightRefresh,24*60*60*1000);
  },msUntilMidnight);
}

function midnightRefresh(){
  console.log('🌅 Midnight auto-refresh triggered');
  // Update active date keys
  if(typeof initActDate==='function')initActDate();
  // Re-render everything for new day
  renderAll();
  if(typeof renderNotReported==='function')renderNotReported();
  // Show a friendly toast
  if(typeof showToast==='function'){
    const today=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
    showToast('🌅 Hari baru! '+today,'info');
  }
}

// ══ SAVE ══
function sE(arr){
  allData[gvk()]=arr;
  if(window.db){if(!arr.length)window.db.ref('scores/'+gvk()).remove();else window.db.ref('scores/'+gvk()).set(arr);}
  else try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
}
function sA(arr){
  allActs[gvk()]=arr;
  if(window.db){if(!arr.length)window.db.ref('activities/'+gvk()).remove();else window.db.ref('activities/'+gvk()).set(arr);}
  else try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
}

// ══ DATE ══
function dk(d){
  // Use LOCAL timezone, not UTC — fixes Indonesia timezone date bug
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function od(n){const d=new Date();d.setDate(d.getDate()+n);return d;}
function gvk(){return dk(od(vOff));}
function isT(){return vOff===0;}
function gE(){return allData[gvk()]||[];}
function gA(){return allActs[gvk()]||[];}
function fShort(d){return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function fDay(d){return d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase();}
function fFull(n){return'Rp '+n.toLocaleString('id-ID');}
function fRp(n){if(n>=1000000)return(n/1000000).toFixed(n%1000000===0?0:2)+'M';if(n>=1000)return(n/1000).toFixed(0)+'k';return n.toString();}
function rc(r){return r>=10?'great':r>=7?'good':'low';}
function mc(i){return['#f5c518','#aaa','#cd7f32'][i]||'#555';}
function md(i){return['🥇','🥈','🥉'][i]||(i+1);}
function rcl(i){return['r1','r2','r3'][i]||'rX';}

// ══ CALENDAR PICKER — iOS STYLE ══
let calYear=new Date().getFullYear();
let calMonth=new Date().getMonth();
let calMode='days'; // 'days' | 'yearmonth'

const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL=['January','February','March','April','May','June','July','August','September','October','November','December'];

function openCal(){
  const vd=od(vOff);
  calYear=vd.getFullYear();
  calMonth=vd.getMonth();
  calMode='days';
  renderCal();
  document.getElementById('calOverlay').style.display='flex';
}
function closeCal(){
  document.getElementById('calOverlay').style.display='none';
  calMode='days';
}
function handleCalOverlayClick(e){
  if(e.target===document.getElementById('calOverlay'))closeCal();
}

function toggleYearMonthPicker(){
  calMode=calMode==='days'?'yearmonth':'days';
  renderCal();
}

function renderCal(){
  const now=new Date();
  const topLabel=document.getElementById('calTopLabel');
  const topText=document.getElementById('calTopText');
  topText.textContent=MONTHS_FULL[calMonth].toUpperCase()+' '+calYear;
  topLabel.className='cal-topbar-label'+(calMode==='yearmonth'?' open':'');

  const yearPicker=document.getElementById('calYearPicker');
  const monthPicker=document.getElementById('calMonthPicker');
  const monthNav=document.getElementById('calMonthNav');
  const dayView=document.getElementById('calDayView');

  if(calMode==='yearmonth'){
    yearPicker.className='cal-year-picker show';
    monthPicker.className='cal-month-picker show';
    monthNav.style.display='none';
    dayView.style.display='none';

    // Build year list: from 2024 to current year
    const startYear=2024;
    let yearHtml='';
    for(let y=startYear;y<=now.getFullYear();y++){
      yearHtml+=`<div class="cal-year-item${y===calYear?' active':''}" onclick="selectYear(${y})">${y}</div>`;
    }
    document.getElementById('calYearList').innerHTML=yearHtml;

    // Scroll selected year into view
    setTimeout(()=>{
      const active=document.querySelector('.cal-year-item.active');
      if(active)active.scrollIntoView({inline:'center',behavior:'smooth'});
    },50);

    // Build month grid
    let monthHtml='';
    MONTHS.forEach((m,i)=>{
      const isFuture=calYear===now.getFullYear()&&i>now.getMonth();
      monthHtml+=`<div class="cal-month-item${i===calMonth?' active':''}${isFuture?' future':''}" 
        onclick="${isFuture?'':` selectMonth(${i})`}">${m}</div>`;
    });
    monthPicker.innerHTML=monthHtml;

  } else {
    yearPicker.className='cal-year-picker';
    monthPicker.className='cal-month-picker';
    monthNav.style.display='flex';
    dayView.style.display='block';
    renderDays();
  }

  document.getElementById('calMonthDisplay').textContent=MONTHS_FULL[calMonth]+' '+calYear;
}

function selectYear(y){
  calYear=y;
  const now=new Date();
  // If selected year+month is in future, clamp to current month
  if(calYear===now.getFullYear()&&calMonth>now.getMonth())calMonth=now.getMonth();
  renderCal();
}

function selectMonth(m){
  calMonth=m;
  calMode='days';
  renderCal();
}

function calPrevMonth(){
  calMonth--;
  if(calMonth<0){calMonth=11;calYear--;}
  renderCal();
}
function calNextMonth(){
  const now=new Date();
  if(calYear===now.getFullYear()&&calMonth>=now.getMonth())return;
  calMonth++;
  if(calMonth>11){calMonth=0;calYear++;}
  renderCal();
}

function renderDays(){
  const today=new Date();today.setHours(0,0,0,0);
  const todayKey=dk(today);
  const selectedKey=dk(od(vOff));
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();

  let html='';
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(calYear,calMonth,d);date.setHours(0,0,0,0);
    const key=dk(date);
    const hasData=(allData[key]&&allData[key].length>0)||(allActs[key]&&allActs[key].length>0);
    const isToday_=key===todayKey;
    const isSelected=key===selectedKey;
    const isFuture=date>today;
    let cls='cal-day';
    if(hasData)cls+=' has-data';
    if(isToday_)cls+=' today';
    if(isSelected)cls+=' selected';
    if(isFuture)cls+=' future';
    const onclick=isFuture?'':` onclick="pickDate('${key}')"`;
    html+=`<div class="${cls}"${onclick}>${d}<span class="dot"></span></div>`;
  }
  document.getElementById('calDays').innerHTML=html;
}

function pickDate(key){
  const today=new Date();today.setHours(0,0,0,0);
  const picked=new Date(key+'T00:00:00');picked.setHours(0,0,0,0);
  vOff=Math.round((picked-today)/(1000*60*60*24));
  updateDayUI();
  closeCal();
}
function jumpToToday(){
  vOff=0;calYear=new Date().getFullYear();calMonth=new Date().getMonth();
  updateDayUI();closeCal();
}

// ══ PAGES ══
function showPage(p,el){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  el.classList.add('active');
  if(p==='monthly')renderMonthly();
  else if(p==='trend')renderTrend();
  else if(p==='activity'){renderAll();renderNotReported();}
  else if(p==='omset')initOmset();
  else if(p==='admin'){if(adminUnlocked){loadAdminSettings();renderEditRecords();}}
  else renderAll();
}

// ══ SALE TYPE — multiple allowed ══
const activeSaleTypes=new Set();
function toggleSaleType(type){
  if(activeSaleTypes.has(type)) activeSaleTypes.delete(type);
  else activeSaleTypes.add(type);
  ['upsell','cross','repeat'].forEach(t=>{
    const btn=document.getElementById('stb_'+t);
    if(btn) btn.className='sale-type-btn'+(activeSaleTypes.has(t)?' active-'+t:'');
  });
}

// ══ ENTRY DATE ══
let entryDateKey=dk(new Date());
let entryCalYear=new Date().getFullYear();
let entryCalMonth=new Date().getMonth();
let entryCalMode='days';

function getEntryDateKey(){return entryDateKey;}

function updateEntryDateLabel(){
  const sel=document.getElementById('inDateSel').value;
  if(sel==='today'){entryDateKey=dk(new Date());}
  else{const d=new Date();d.setDate(d.getDate()-1);entryDateKey=dk(d);}
  const d=new Date(entryDateKey+'T00:00:00');
  const label=document.getElementById('entryDateLabel');
  if(label)label.textContent=d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function openEntryCal(){
  const d=new Date(entryDateKey+'T00:00:00');
  entryCalYear=d.getFullYear();entryCalMonth=d.getMonth();entryCalMode='days';
  renderEntryCal();
  document.getElementById('entryCalOverlay').style.display='flex';
}
function toggleEntryYearMonth(){entryCalMode=entryCalMode==='days'?'yearmonth':'days';renderEntryCal();}
function entryCalPrevMonth(){entryCalMonth--;if(entryCalMonth<0){entryCalMonth=11;entryCalYear--;}renderEntryCal();}
function entryCalNextMonth(){const n=new Date();if(entryCalYear===n.getFullYear()&&entryCalMonth>=n.getMonth())return;entryCalMonth++;if(entryCalMonth>11){entryCalMonth=0;entryCalYear++;}renderEntryCal();}
function entryJumpToday(){entryDateKey=dk(new Date());document.getElementById('entryCalOverlay').style.display='none';const l=document.getElementById('entryDateLabel');if(l)l.textContent='Today';}

function renderEntryCal(){
  document.getElementById('entryCalTopText').textContent=MONTHS_FULL[entryCalMonth].toUpperCase()+' '+entryCalYear;
  const lbl=document.getElementById('entryCalTopLabel');
  lbl.className='cal-topbar-label'+(entryCalMode==='yearmonth'?' open':'');
  const yp=document.getElementById('entryCalYearPicker');
  const mp=document.getElementById('entryCalMonthPicker');
  const mn=document.getElementById('entryCalMonthNav');
  const now=new Date();
  if(entryCalMode==='yearmonth'){
    yp.className='cal-year-picker show';mp.className='cal-month-picker show';mn.style.display='none';
    let yh='';for(let y=2024;y<=now.getFullYear();y++)yh+=`<div class="cal-year-item${y===entryCalYear?' active':''}" onclick="entrySelYear(${y})">${y}</div>`;
    document.getElementById('entryCalYearList').innerHTML=yh;
    setTimeout(()=>{const a=document.querySelector('#entryCalYearList .active');if(a)a.scrollIntoView({inline:'center',behavior:'smooth'});},50);
    let mh='';MONTHS.forEach((m,i)=>{const f=entryCalYear===now.getFullYear()&&i>now.getMonth();mh+=`<div class="cal-month-item${i===entryCalMonth?' active':''}${f?' future':''}" onclick="${f?'':` entrySelMonth(${i})`}">${m}</div>`;});
    mp.innerHTML=mh;
  } else {
    yp.className='cal-year-picker';mp.className='cal-month-picker';mn.style.display='flex';
    document.getElementById('entryCalMonthDisplay').textContent=MONTHS_FULL[entryCalMonth]+' '+entryCalYear;
    const today=new Date();today.setHours(0,0,0,0);
    const firstDay=new Date(entryCalYear,entryCalMonth,1).getDay();
    const daysInMonth=new Date(entryCalYear,entryCalMonth+1,0).getDate();
    let html='';
    for(let i=0;i<firstDay;i++)html+=`<div class="cal-day empty"></div>`;
    for(let d=1;d<=daysInMonth;d++){
      const date=new Date(entryCalYear,entryCalMonth,d);date.setHours(0,0,0,0);
      const key=dk(date);
      const isT=key===dk(today);
      const isSel=key===entryDateKey;
      const isFuture=date>today;
      let cls='cal-day';
      if(isT)cls+=' today';if(isSel)cls+=' selected';if(isFuture)cls+=' future';
      const onclick=isFuture?'':` onclick="entryPickDate('${key}')"`;
      html+=`<div class="${cls}"${onclick}>${d}<span class="dot"></span></div>`;
    }
    document.getElementById('entryCalDays').innerHTML=html;
  }
}
function entrySelYear(y){entryCalYear=y;const n=new Date();if(entryCalYear===n.getFullYear()&&entryCalMonth>n.getMonth())entryCalMonth=n.getMonth();renderEntryCal();}
function entrySelMonth(m){entryCalMonth=m;entryCalMode='days';renderEntryCal();}
function entryPickDate(key){
  entryDateKey=key;
  const d=new Date(key+'T00:00:00');
  const l=document.getElementById('entryDateLabel');
  if(l)l.textContent=d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  document.getElementById('entryCalOverlay').style.display='none';
}
function prevDay(){if(vOff>-365)vOff--;updateDayUI();}
function nextDay(){if(vOff<0)vOff++;updateDayUI();}
function updateDayUI(){
  const isT_=isT();const vd=od(vOff);
  document.getElementById('dayLabel').textContent=isT_?'TODAY':fShort(vd);
  const badge=document.getElementById('liveBadge');
  badge.className=isT_?'live-badge':'past-badge';
  badge.innerHTML=isT_?'<span class="live-dot"></span>LIVE':'📅 PAST';
  document.getElementById('roBanner').style.display=isT_?'none':'block';
  document.getElementById('roDate').textContent=vd.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  document.getElementById('inputArea').style.opacity=isT_?'1':'0.4';
  document.getElementById('inputArea').style.pointerEvents=isT_?'auto':'none';
  document.getElementById('goalTitle').textContent=isT_?"Today's Target":fShort(vd);
  renderAll();
}

// ══ HISTORY ══
function renderHist(){
  const strip=document.getElementById('histStrip');strip.innerHTML='';
  for(let i=-29;i<=0;i++){
    const d=od(i),k=dk(d);
    const entries=allData[k]||[];
    const rev=entries.reduce((a,e)=>a+e.revenue,0);
    const hasD=entries.length>0,isT_=i===0,isAct=i===vOff;
    const div=document.createElement('div');
    div.className='hday'+(isAct?' active-day':'')+(hasD?' has-data':'')+(isT_?' today-day':'');
    div.onclick=(()=>{const off=i;return()=>{vOff=off;updateDayUI();};})();
    div.innerHTML=`<div class="hd-date">${fShort(d)}</div><div class="hd-day">${fDay(d)}</div><div class="hd-dot ${hasD?'g':''}${isT_&&!hasD?' b':''}"></div><div class="hd-rev">${hasD?fRp(rev):'—'}</div>`;
    strip.appendChild(div);
  }
}

// ══ DROPDOWNS ══
function updateSPList(){
  const teamSel=document.getElementById('inTeam');
  const spSel=document.getElementById('inSP');
  if(!teamSel||!spSel)return;
  const t=teamSel.value;
  // If team doesn't exist in TM, default to first team
  if(!TM[t]||!TM[t].m||TM[t].m.length===0){
    // Find first team that has members
    const firstValid=Object.keys(TM).find(k=>TM[k]&&TM[k].m&&TM[k].m.length>0);
    if(firstValid){
      teamSel.value=firstValid;
      spSel.innerHTML=TM[firstValid].m.map(x=>`<option>${x}</option>`).join('');
    } else {
      spSel.innerHTML='<option value="">No salespeople — add in Admin</option>';
    }
    return;
  }
  spSel.innerHTML=TM[t].m.map(x=>`<option>${x}</option>`).join('');
}
function updateActSP(){
  const teamSel=document.getElementById('aTeam');
  const spSel=document.getElementById('aSP');
  if(!teamSel||!spSel)return;
  const t=teamSel.value;
  if(!TM[t]||!TM[t].m||TM[t].m.length===0){
    const firstValid=Object.keys(TM).find(k=>TM[k]&&TM[k].m&&TM[k].m.length>0);
    if(firstValid){
      teamSel.value=firstValid;
      spSel.innerHTML=TM[firstValid].m.map(x=>`<option>${x}</option>`).join('');
    } else {
      spSel.innerHTML='<option value="">No salespeople — add in Admin</option>';
    }
    return;
  }
  spSel.innerHTML=TM[t].m.map(x=>`<option>${x}</option>`).join('');
}

function getActDateKey(){
  const d=new Date();d.setDate(d.getDate()-1);return dk(d);
}

function initActDate(){
  const y=new Date();y.setDate(y.getDate()-1);
  document.getElementById('aDateLabel').textContent=y.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
// ══ PRICE MODE ══
let currentPriceMode='normal';

function updatePriceMode(){
  const prod=document.getElementById('inProd').value;
  const section=document.getElementById('priceSection');
  if(!section)return;
  if(!prod){section.style.display='none';return;}
  section.style.display='block';
  currentPriceMode='normal';
  setPriceMode('normal');
}

function setPriceMode(mode){
  currentPriceMode=mode;
  const prod=document.getElementById('inProd').value;
  const normalDisplay=document.getElementById('normalPriceDisplay');
  const customInput=document.getElementById('customPriceInput');
  const btnNormal=document.getElementById('ptb_normal');
  const btnCustom=document.getElementById('ptb_custom');
  if(!normalDisplay)return;
  if(mode==='normal'){
    normalDisplay.style.display='flex';customInput.style.display='none';
    if(btnNormal)btnNormal.className='price-toggle-btn active-normal';
    if(btnCustom)btnCustom.className='price-toggle-btn';
    if(prod&&P[prod])document.getElementById('normalPriceVal').textContent=fFull(P[prod]);
  } else {
    normalDisplay.style.display='none';customInput.style.display='block';
    if(btnNormal)btnNormal.className='price-toggle-btn';
    if(btnCustom)btnCustom.className='price-toggle-btn active-custom';
    const ci=document.getElementById('inCustom');if(ci)ci.focus();
  }
}

function updateCustomPreview(){
  const custom=parseFloat(document.getElementById('inCustom')?.value)||0;
  const units=parseInt(document.getElementById('inUnits')?.value)||1;
  const preview=document.getElementById('customPreview');
  if(preview)preview.textContent=custom>0?'Total: '+fFull(custom*units):'';
}

function updatePP(){updatePriceMode();}

// ══ ADD ENTRY ══
function addEntry(){
  const team=document.getElementById('inTeam').value;
  const sp=document.getElementById('inSP').value;
  const prod=document.getElementById('inProd').value;
  const units=parseInt(document.getElementById('inUnits').value)||1;
  const notes=document.getElementById('inNotes')?document.getElementById('inNotes').value.trim():'';
  const saleType=[...activeSaleTypes];
  const targetKey=getEntryDateKey();

  if(!prod){alert('Pilih produk dulu!');return;}

  // Get price based on mode
  let price=0;
  if(currentPriceMode==='normal'){
    price=P[prod]||0;
  } else {
    price=parseFloat(document.getElementById('inCustom')?.value)||0;
    if(!price){alert('Masukkan custom price!');return;}
  }

  const existing=allData[targetKey]||[];
  existing.push({team,sp,prod,chats:0,units,price,revenue:price*units,saleType,notes,priceMode:currentPriceMode,ts:Date.now()});
  allData[targetKey]=existing;
  sE2(targetKey,existing);

  // Reset form
  document.getElementById('inUnits').value='1';
  document.getElementById('inProd').value='';
  if(document.getElementById('inCustom'))document.getElementById('inCustom').value='';
  if(document.getElementById('inNotes'))document.getElementById('inNotes').value='';
  if(document.getElementById('priceSection'))document.getElementById('priceSection').style.display='none';
  if(document.getElementById('customPreview'))document.getElementById('customPreview').textContent='';
  currentPriceMode='normal';
  activeSaleTypes.clear();
  ['upsell','cross','repeat'].forEach(t=>{const b=document.getElementById('stb_'+t);if(b)b.className='sale-type-btn';});
  renderAll();
}
function removeEntry(i){
  if(!isT())return;
  const arr=gE();arr.splice(i,1);sE(arr);renderAll();
}
async function clearToday(){
  if(!isT())return;
  const okClr=await showConfirm('Clear Entries','Clear ALL entries for today?','Clear',true);if(!okClr)return;
  sE([]);sA([]);renderAll();
}

// ══ SAVE TO SPECIFIC KEY ══
function sE2(key,arr){
  allData[key]=arr;
  if(window.db){if(!arr.length)window.db.ref('scores/'+key).remove();else window.db.ref('scores/'+key).set(arr);}
  else try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
}

// ══ ADD ACTIVITY ══
function addActivity(){
  const team=document.getElementById('aTeam').value;
  const sp=document.getElementById('aSP').value;
  const chats=parseInt(document.getElementById('aChats')?.value)||0;
  const calls=parseInt(document.getElementById('aCalls').value)||0;
  const fups=parseInt(document.getElementById('aFups').value)||0;
  const notes=document.getElementById('aNotes').value.trim();
  if(!chats&&!calls&&!fups){alert('Enter chats, calls or follow ups!');return;}

  const targetKey=getActDateKey();
  const now=new Date();
  const hour=now.getHours();
  const minute=now.getMinutes();
  const isLate=(hour>14)||(hour===14&&minute>0); // after 2:00 PM

  const arr=allActs[targetKey]||[];
  arr.push({team,sp,chats,calls,fups,notes,ts:Date.now(),isLate});

  allActs[targetKey]=arr;
  if(window.db){
    if(!arr.length)window.db.ref('activities/'+targetKey).remove();
    else window.db.ref('activities/'+targetKey).set(arr);
  } else {
    try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
  }

  if(document.getElementById('aChats'))document.getElementById('aChats').value='';
  document.getElementById('aCalls').value='';
  document.getElementById('aFups').value='';
  document.getElementById('aNotes').value='';
  renderAll();
  const msg=isLate?'⚠️ Activity logged — marked as LATE SUBMISSION (after 2 PM)':'✅ Activity logged for '+new Date(targetKey+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'!';
  alert(msg);
}
function removeActivityByDate(dateKey,ts){
  const arr=allActs[dateKey]||[];
  const newArr=arr.filter(a=>a.ts!==ts);
  allActs[dateKey]=newArr;
  if(window.db){
    if(!newArr.length)window.db.ref('activities/'+dateKey).remove();
    else window.db.ref('activities/'+dateKey).set(newArr);
  } else {
    try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
  }
  renderAll();
}
function removeActivity(i){
  if(!isT())return;
  const arr=gA();arr.splice(i,1);sA(arr);renderAll();
}

// ══ AGGREGATORS ══
function aggTeams(entries,acts){
  const t={};
  Object.keys(TM).forEach(k=>t[k]={chats:0,closes:0,revenue:0,calls:0,fups:0});
  entries.forEach(e=>{if(t[e.team]){t[e.team].chats+=e.chats;t[e.team].closes+=e.units;t[e.team].revenue+=e.revenue;}});
  acts.forEach(a=>{if(t[a.team]){t[a.team].calls+=a.calls;t[a.team].fups+=a.fups;t[a.team].chats+=a.chats;}});
  return Object.entries(t).map(([n,d])=>({n,...d,rate:d.chats>0?d.closes/d.chats*100:0})).sort((a,b)=>b.revenue-a.revenue);
}
function aggSP(entries,acts){
  const s={};
  // Pre-fill with ALL salespeople from all teams
  Object.entries(TM).forEach(([team,tc])=>{
    tc.m.forEach(sp=>{
      const k=sp+'|'+team;
      s[k]={sp,team,chats:0,closes:0,revenue:0,calls:0,fups:0,prods:{}};
    });
  });
  entries.forEach(e=>{
    const k=e.sp+'|'+e.team;
    if(!s[k])s[k]={sp:e.sp,team:e.team,chats:0,closes:0,revenue:0,calls:0,fups:0,prods:{}};
    s[k].chats+=e.chats;s[k].closes+=e.units;s[k].revenue+=e.revenue;
    if(e.prod)s[k].prods[e.prod]=(s[k].prods[e.prod]||0)+e.units;
  });
  acts.forEach(a=>{
    const k=a.sp+'|'+a.team;
    if(!s[k])s[k]={sp:a.sp,team:a.team,chats:0,closes:0,revenue:0,calls:0,fups:0,prods:{}};
    s[k].calls+=a.calls;s[k].fups+=a.fups;s[k].chats+=a.chats;
  });
  return Object.values(s).map(d=>({...d,rate:d.chats>0?d.closes/d.chats*100:0})).sort((a,b)=>b.revenue-a.revenue||b.chats-a.chats);
}
function aggProds(entries){
  const p={};Object.keys(P).forEach(k=>p[k]={count:0,revenue:0});
  entries.forEach(e=>{if(e.prod){p[e.prod].count+=e.units;p[e.prod].revenue+=e.revenue;}});
  return p;
}
function tots(entries,acts){
  const e=entries.reduce((a,x)=>({chats:a.chats+x.chats,closes:a.closes+x.units,revenue:a.revenue+x.revenue}),{chats:0,closes:0,revenue:0});
  const a=acts.reduce((a,x)=>({calls:a.calls+x.calls,fups:a.fups+x.fups}),{calls:0,fups:0});
  return{...e,...a};
}

// ══ RENDER ALL ══
function renderAll(){
  const entries=gE(),acts=gA();
  const T=tots(entries,acts);
  const rate=T.chats>0?(T.closes/T.chats*100).toFixed(1):0;
  const spCnt=new Set(entries.map(e=>e.sp+'|'+e.team)).size||1;

  // KPIs — Closes | Revenue | Rate | Calls | Followups
  document.getElementById('K1').textContent=T.closes;
  document.getElementById('K2').textContent=fRp(T.revenue);
  document.getElementById('K3').innerHTML=rate+'<span class="u">%</span>';
  document.getElementById('K4').textContent=T.calls;
  document.getElementById('K5').textContent=T.fups;
  document.getElementById('K1c').textContent=T.closes+' unit'+(T.closes!==1?'s':'')+' sold';
  document.getElementById('K2c').textContent=fFull(T.revenue);
  document.getElementById('K5c').textContent='follow ups';

  // Goal
  const pct=Math.min(100,Math.round(T.revenue/TR*100));
  document.getElementById('goalFill').style.width=pct+'%';
  document.getElementById('goalPct').textContent=pct+'%';
  document.getElementById('totalRev').textContent=fFull(T.revenue);

  // History
  renderHist();

  // TEAM TABLE
  const teams=aggTeams(entries,acts);
  document.getElementById('tTeam').innerHTML=teams.length===0
    ?'<tr class="erow"><td colspan="9">No data yet — log entries below ↓</td></tr>'
    :teams.map((t,i)=>{
      const tc=TM[t.n]||{c:'#888',bg:'#111',e:'👤',m:[]};
      return`<tr>
        <td><span class="rnk ${rcl(i)}">${md(i)}</span></td>
        <td><div class="tcell"><div class="tav" style="background:${tc.bg};color:${tc.c}">${tc.e}</div><div class="tn">${t.n}</div></div></td>
        <td><span style="font-size:9px;color:#6060a0;font-family:'DM Mono',monospace">${tc.m.join(' · ')}</span></td>
        <td><span class="nb">${t.chats}</span></td>
        <td><span class="nb">${t.calls}</span></td>
        <td><span class="nb">${t.fups}</span></td>
        <td><span class="nb">${t.closes}</span></td>
        <td><span class="rb ${rc(t.rate)}">${t.rate.toFixed(1)}%</span></td>
        <td><span class="rc">${fFull(t.revenue)}</span></td>
      </tr>`;
    }).join('');

  // SP TABLE — show all SPs always (sorted by revenue)
  const sps=aggSP(entries,acts);
  document.getElementById('tSP').innerHTML=sps.length===0
    ?'<tr class="erow"><td colspan="8">No salespeople configured</td></tr>'
    :sps.map((s,i)=>{
      const tc=TM[s.team]||{c:'#888'};
      const isEmpty=s.chats===0&&s.closes===0&&s.calls===0&&s.fups===0;
      return`<tr onclick="openSPModal('${s.sp}','${s.team}')" style="${isEmpty?'opacity:0.5':''}">
        <td><span class="rnk ${rcl(i)}">${md(i)}</span></td>
        <td><div class="tcell"><div class="tav" style="background:rgba(0,0,0,0.4);color:${tc.c};font-size:13px">${s.sp[0].toUpperCase()}</div><div><div class="tn">${s.sp}</div><div class="tm">Team ${s.team}</div></div></div></td>
        <td><span class="nb">${s.chats}</span></td>
        <td><span class="nb">${s.calls}</span></td>
        <td><span class="nb">${s.fups}</span></td>
        <td><span class="nb">${s.closes}</span></td>
        <td><span class="rb ${rc(s.rate)}">${s.rate.toFixed(1)}%</span></td>
        <td><span class="rc">${fFull(s.revenue)}</span></td>
      </tr>`;
    }).join('');

  // PRODUCT GRID
  const prods=aggProds(entries);
  document.getElementById('prodGrid').innerHTML=Object.entries(prods).map(([name,d])=>`
    <div class="pi ${d.count>0?'hs':''}">
      <div class="pi-n">${name}</div>
      <div class="pi-c">${d.count}</div>
      <div class="pi-r">${d.revenue>0?fFull(d.revenue):'—'}</div>
    </div>`).join('');

  // ENTRY LOG
  const log=document.getElementById('entryLog');
  if(!entries.length){log.innerHTML='<div style="color:#333350;font-size:11px;font-family:\'DM Mono\',monospace;padding:5px 0;">No entries yet.</div>';}
  else{log.innerHTML=[...entries].reverse().map((e,ri)=>{
    const i=entries.length-1-ri;
    const tc=TM[e.team]||{c:'#888'};
    return`<div class="ei">
      <span class="en" style="color:${tc.c}">${e.sp}</span>
      <span class="et">${e.team}</span>
      ${e.chats?`<span class="et" style="color:#448aff">💬${e.chats}</span>`:''}
      ${e.prod?`<span class="et" style="color:#00e676">✅${e.units}×${e.prod}</span>`:''}
      ${e.priceMode==='custom'?'<span class="et" style="color:#ff6b1a">✏️ Custom</span>':''}
      ${(Array.isArray(e.saleType)?e.saleType:e.saleType?[e.saleType]:[]).map(t=>t==='upsell'?'<span class="sale-type-tag tag-upsell">⬆️ Upsell</span>':t==='cross'?'<span class="sale-type-tag tag-cross">🔀 Cross</span>':t==='repeat'?'<span class="sale-type-tag tag-repeat">🔁 Repeat</span>':'').join('')}
      ${e.revenue?`<span class="et" style="color:#f5c518">${fFull(e.revenue)}</span>`:''}
      ${isT()?`<span class="ed" onclick="removeEntry(${i})">✕</span>`:''}
    </div>`;
  }).join('');}

  // LEADERBOARD
  const top6=aggSP(entries,acts).slice(0,6);
  document.getElementById('lb').innerHTML=top6.length===0
    ?'<div style="color:#333350;font-size:11px;font-family:\'DM Mono\',monospace;">Log entries to see rankings.</div>'
    :top6.map((s,i)=>`
      <div class="lbi" onclick="openSPModal('${s.sp}','${s.team}')">
        <div class="lbr" style="color:${mc(i)}">${md(i)}</div>
        <div class="lbin">
          <div class="lbn">${s.sp}</div>
          <div class="lbt">Team ${s.team} · ${s.closes}x · ${s.chats} chats</div>
        </div>
        <div>
          <div class="lbs">${fFull(s.revenue)}</div>
          <div class="lbr2">${s.rate.toFixed(1)}% rate</div>
        </div>
      </div>`).join('');

  // ACTIVITY LOG
  renderActLog(acts);

  // SP GRID
  renderSPGrid(entries,acts);

  // NOT REPORTED (if on activity page)
  renderNotReported();
}

// ══ ACTIVITY LOG ══
function renderActLog(acts){
  const log=document.getElementById('actLog');

  // Gather last 7 days of activity for display
  const allActEntries=[];
  for(let i=-6;i<=0;i++){
    const k=dk(od(i));
    const dayActs=allActs[k]||[];
    dayActs.forEach(a=>allActEntries.push({...a,dateKey:k}));
  }
  allActEntries.sort((a,b)=>b.ts-a.ts);

  if(!allActEntries.length){
    log.innerHTML='<div style="color:#333350;font-size:11px;font-family:\'DM Mono\',monospace;padding:16px;text-align:center;">No activity in last 7 days.</div>';
    return;
  }
  log.innerHTML=allActEntries.map((a,ri)=>{
    const tc=TM[a.team]||{c:'#888'};
    const dateD=new Date(a.dateKey+'T00:00:00');
    const dateStr=dateD.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    const lateBadge=a.isLate?'<span style="font-family:\'DM Mono\',monospace;font-size:9px;background:rgba(255,107,26,0.15);color:#ff6b1a;border:1px solid rgba(255,107,26,0.3);padding:1px 5px;border-radius:4px;letter-spacing:1px;flex-shrink:0">LATE</span>':'';
    const i=allActEntries.length-1-ri;
    return`<div class="ar" style="grid-template-columns:1fr .6fr .6fr .6fr .6fr .8fr auto">
      <div><span class="asn" style="color:${tc.c}">${a.sp}</span><span class="att">${a.team}</span></div>
      <div style="text-align:center;font-family:'Space Mono',monospace;font-size:9px;color:#6060a0">${dateStr}</div>
      <div class="av" style="color:#f5c518">${a.chats||0}</div>
      <div class="av" style="color:#448aff">${a.calls}</div>
      <div class="av" style="color:#ff6b1a">${a.fups}</div>
      <div style="font-size:10px;color:#6060a0;font-family:'Space Mono',monospace;display:flex;align-items:center;gap:4px;">${a.notes||'—'} ${lateBadge}</div>
      <div><span class="ed" onclick="removeActivityByDate('${a.dateKey}',${a.ts})">✕</span></div>
    </div>`;
  }).join('');
}

// ══ SP GRID ══
function renderSPGrid(entries,acts){
  const spMap={};
  aggSP(entries,acts).forEach(s=>spMap[s.sp+'|'+s.team]=s);
  const html=Object.entries(TM).flatMap(([tn,tc])=>
    tc.m.map(sp=>{
      const k=sp+'|'+tn;
      const s=spMap[k]||{chats:0,closes:0,revenue:0,calls:0,fups:0};
      return`<div class="spc" onclick="openSPModal('${sp}','${tn}')">
        <div class="spc-bar" style="background:${tc.c}"></div>
        <div class="spc-av" style="background:${tc.bg};color:${tc.c}">${sp[0].toUpperCase()}</div>
        <div class="spc-name">${sp}</div>
        <div class="spc-team">Team ${tn} ${tc.e}</div>
        <div class="spc-row"><span class="spc-rl">💬 Chat Masuk</span><span class="spc-rv">${s.chats}</span></div>
        <div class="spc-row"><span class="spc-rl">📞 Calls</span><span class="spc-rv">${s.calls}</span></div>
        <div class="spc-row"><span class="spc-rl">🔄 Follow Up</span><span class="spc-rv">${s.fups}</span></div>
        <div class="spc-row"><span class="spc-rl">✅ Closes</span><span class="spc-rv">${s.closes}</span></div>
        <div class="spc-rev">${fFull(s.revenue)}</div>
      </div>`;
    })
  ).join('');
  document.getElementById('spGrid').innerHTML=html;
}

// ══ SP MODAL ══
function openSPModal(sp,team){
  const entries=gE(),acts=gA();
  const spList=aggSP(entries,acts);
  const s=spList.find(x=>x.sp===sp&&x.team===team)||{sp,team,chats:0,closes:0,revenue:0,calls:0,fups:0,prods:{}};
  const tc=TM[team]||{c:'#888',bg:'#111',e:'',m:[]};

  document.getElementById('mAv').textContent=sp[0].toUpperCase();
  document.getElementById('mAv').style.background=tc.bg;
  document.getElementById('mAv').style.color=tc.c;
  document.getElementById('mName').textContent=sp;
  document.getElementById('mTeam').textContent='Team '+team+' '+tc.e;

  document.getElementById('mKPIs').innerHTML=`
    <div class="mk"><div class="mkl">Omset / Revenue</div><div class="mkv go" style="font-size:20px">${fFull(s.revenue)}</div></div>
    <div class="mk"><div class="mkl">Chat Masuk</div><div class="mkv">${s.chats}</div></div>
    <div class="mk"><div class="mkl">Calls / Telepon</div><div class="mkv bl">${s.calls}</div></div>
    <div class="mk"><div class="mkl">Follow Up</div><div class="mkv or">${s.fups}</div></div>
    <div class="mk"><div class="mkl">Closes</div><div class="mkv gr">${s.closes}</div></div>
    <div class="mk"><div class="mkl">Close Rate</div><div class="mkv">${s.chats>0?(s.closes/s.chats*100).toFixed(1):0}%</div></div>`;

  const prods=Object.entries(s.prods||{}).sort((a,b)=>b[1]-a[1]);
  document.getElementById('mProds').innerHTML=prods.length===0
    ?'<div style="color:#333350;font-size:11px;font-family:\'DM Mono\',monospace;padding:6px 0;">No closes yet.</div>'
    :prods.map(([prod,qty])=>`
      <div class="mpr">
        <div><div class="mpn">${prod}</div><div class="mpd">${qty} unit × Rp ${fRp(P[prod]||0)}</div></div>
        <div class="mpr-r">${fFull((P[prod]||0)*qty)}</div>
      </div>`).join('');

  document.getElementById('spMo').style.display='flex';
}
function closeSPMo(e){if(!e||e.target===document.getElementById('spMo'))document.getElementById('spMo').style.display='none';}

// ══ TABS ══
function switchTab(tab,el){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('vTeam').style.display=tab==='team'?'':'none';
  document.getElementById('vSP').style.display=tab==='sp'?'':'none';
  document.getElementById('vProd').style.display=tab==='product'?'':'none';
}

// ══ WHATSAPP ══
function buildWA(){
  const entries=gE(),acts=gA();
  const T=tots(entries,acts);
  const vd=od(vOff);
  const ds=vd.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const rate=T.chats>0?(T.closes/T.chats*100).toFixed(1):0;
  const cp=Math.round(T.chats/TC*100);
  let txt='🌀 *HURRICANE XCS — DAILY REPORT*\n━━━━━━━━━━━━━━━━━━━━━━\n';
  txt+=`📅 ${ds}\n\n📊 *SUMMARY*\n`;
  txt+=`💬 Chats : ${T.chats}/160 (${cp}%)\n✅ Closes : ${T.closes} units\n📞 Calls : ${T.calls}\n🔄 Follow Up : ${T.fups}\n📈 Close Rate : ${rate}%\n💰 Revenue : ${fFull(T.revenue)}\n\n`;
  txt+='🏆 *TEAM RANKING*\n';
  const teams=aggTeams(entries,acts).filter(t=>t.chats>0||t.closes>0||t.calls>0);
  if(!teams.length)txt+='No data.\n';
  else teams.forEach((t,i)=>{txt+=`${['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣'][i]||'▪️'} *${t.n}* — ${t.chats}c · ${t.calls} calls · ${t.closes}x · ${fFull(t.revenue)}\n`;});
  txt+='\n👤 *TOP 5 SALESPEOPLE*\n';
  const sps=aggSP(entries,acts).slice(0,5);
  if(!sps.length)txt+='No data.\n';
  else sps.forEach((s,i)=>{txt+=`${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${s.sp} (${s.team}) — ${s.closes}x · ${fFull(s.revenue)}\n`;});
  txt+='\n━━━━━━━━━━━━━━━━━━━━━━\n';
  txt+=cp>=100?'🔥 TARGET REACHED! Great work team!':'💪 Keep pushing — '+(160-T.chats)+' chats to go!';
  txt+='\n_Hurricane XCS Performance System_';
  return txt;
}
function openWA(){document.getElementById('waPre').textContent=buildWA();document.getElementById('waMo').style.display='flex';}
function closeWAMo(e){if(!e||e.target===document.getElementById('waMo'))document.getElementById('waMo').style.display='none';}
function copyWAText(){
  const txt=buildWA();
  if(navigator.clipboard){navigator.clipboard.writeText(txt).then(()=>alert('✅ Copied!'));}
  else{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('✅ Copied!');}
}
function sendWA(){window.open('https://wa.me/?text='+encodeURIComponent(buildWA()),'_blank');}

// ══ MONTHLY RECAP ══
let mYear=new Date().getFullYear();
let mMonth=new Date().getMonth(); // 0-indexed

function prevMonth(){
  mMonth--;
  if(mMonth<0){mMonth=11;mYear--;}
  renderMonthly();
}
function nextMonth(){
  const now=new Date();
  if(mYear>now.getFullYear()||(mYear===now.getFullYear()&&mMonth>=now.getMonth()))return;
  mMonth++;
  if(mMonth>11){mMonth=0;mYear++;}
  renderMonthly();
}

function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function fMonthName(y,m){return new Date(y,m,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});}
function fDateLabel(d){return new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}

function renderMonthly(){
  document.getElementById('monthLabel').textContent=fMonthName(mYear,mMonth);

  // Build list of all days in month
  const days=getDaysInMonth(mYear,mMonth);
  const dayKeys=[];
  for(let d=1;d<=days;d++){
    const dt=new Date(mYear,mMonth,d);
    dayKeys.push(dk(dt));
  }

  // Aggregate all data for the month
  let totalChats=0,totalCloses=0,totalRev=0,totalCalls=0,totalFups=0;
  const teamTotals={};
  const spTotals={};
  const prodTotals={};
  const dayData=[];
  let bestRev=0,bestDate='';
  let activeDays=0;

  Object.keys(TM).forEach(k=>teamTotals[k]={chats:0,closes:0,revenue:0,calls:0,fups:0});
  Object.keys(P).forEach(k=>prodTotals[k]={count:0,revenue:0});

  dayKeys.forEach(k=>{
    const entries=allData[k]||[];
    const acts=allActs[k]||[];
    if(!entries.length&&!acts.length){dayData.push({k,chats:0,closes:0,rev:0,topSP:'—'});return;}

    activeDays++;
    let dayChats=0,dayCloses=0,dayRev=0;
    const daySPMap={};

    entries.forEach(e=>{
      dayChats+=e.chats; dayCloses+=e.units; dayRev+=e.revenue;
      totalChats+=e.chats; totalCloses+=e.units; totalRev+=e.revenue;
      if(teamTotals[e.team]){teamTotals[e.team].chats+=e.chats;teamTotals[e.team].closes+=e.units;teamTotals[e.team].revenue+=e.revenue;}
      const sk=e.sp+'|'+e.team;
      if(!spTotals[sk])spTotals[sk]={sp:e.sp,team:e.team,chats:0,closes:0,revenue:0,calls:0,fups:0,prods:{}};
      spTotals[sk].chats+=e.chats;spTotals[sk].closes+=e.units;spTotals[sk].revenue+=e.revenue;
      if(e.prod){prodTotals[e.prod].count+=e.units;prodTotals[e.prod].revenue+=e.revenue;}
      if(!daySPMap[sk])daySPMap[sk]={sp:e.sp,rev:0};
      daySPMap[sk].rev+=e.revenue;
    });
    acts.forEach(a=>{
      totalCalls+=a.calls;totalFups+=a.fups;totalChats+=a.chats;
      dayChats+=a.chats;
      if(teamTotals[a.team]){teamTotals[a.team].calls+=a.calls;teamTotals[a.team].fups+=a.fups;teamTotals[a.team].chats+=a.chats;}
      const sk=a.sp+'|'+a.team;
      if(!spTotals[sk])spTotals[sk]={sp:a.sp,team:a.team,chats:0,closes:0,revenue:0,calls:0,fups:0,prods:{}};
      spTotals[sk].calls+=a.calls;spTotals[sk].fups+=a.fups;spTotals[sk].chats+=a.chats;
    });

    if(dayRev>bestRev){bestRev=dayRev;bestDate=k;}
    const topSP=Object.values(daySPMap).sort((a,b)=>b.rev-a.rev)[0];
    dayData.push({k,chats:dayChats,closes:dayCloses,rev:dayRev,topSP:topSP?topSP.sp:'—'});
  });

  // KPIs
  const rate=totalChats>0?(totalCloses/totalChats*100).toFixed(1):0;
  document.getElementById('mK1').textContent=totalChats;
  document.getElementById('mK1c').textContent=Math.round(totalChats/Math.max(1,activeDays))+' avg/day';
  document.getElementById('mK2').textContent=totalCloses;
  document.getElementById('mK3').innerHTML=rate+'<span class="u">%</span>';
  document.getElementById('mK4').textContent=totalCalls;
  document.getElementById('mK5').textContent=fRp(totalRev);
  document.getElementById('mK5c').textContent=fFull(totalRev);
  document.getElementById('mActiveDays').textContent=activeDays;
  document.getElementById('mAvgRev').textContent=fFull(activeDays>0?Math.round(totalRev/activeDays):0);
  document.getElementById('mBestDay').textContent=bestDate?fFull(bestRev):'Rp 0';
  document.getElementById('mBestDate').textContent=bestDate?fDateLabel(bestDate):'—';

  // Team table
  const sortedTeams=Object.entries(teamTotals).map(([n,d])=>({n,...d,rate:d.chats>0?d.closes/d.chats*100:0})).sort((a,b)=>b.revenue-a.revenue);
  const maxTeamRev=Math.max(1,...sortedTeams.map(t=>t.revenue));
  document.getElementById('mTeamBody').innerHTML=sortedTeams.every(t=>t.revenue===0)
    ?'<tr class="erow"><td colspan="9">No data for this month</td></tr>'
    :sortedTeams.map((t,i)=>{
      const tc=TM[t.n]||{c:'#888',bg:'#111',e:'👤'};
      const barW=Math.round(t.revenue/maxTeamRev*100);
      return`<tr>
        <td><span class="rnk ${rcl(i)}">${md(i)}</span></td>
        <td><div class="tcell"><div class="tav" style="background:${tc.bg};color:${tc.c}">${tc.e}</div><div class="tn">${t.n}</div></div></td>
        <td><span class="nb">${t.chats}</span></td>
        <td><span class="nb">${t.calls}</span></td>
        <td><span class="nb">${t.fups}</span></td>
        <td><span class="nb">${t.closes}</span></td>
        <td><span class="rb ${rc(t.rate)}">${t.rate.toFixed(1)}%</span></td>
        <td><span class="rc">${fFull(t.revenue)}</span></td>
        <td><div style="display:flex;align-items:center;gap:6px"><div style="width:50px;height:4px;background:#1e1e32;border-radius:3px;overflow:hidden"><div style="width:${barW}%;height:100%;background:${tc.c};border-radius:3px"></div></div><span style="font-size:9px;color:#6060a0;font-family:'DM Mono',monospace">${barW}%</span></div></td>
      </tr>`;
    }).join('');

  // SP table
  const sortedSPs=Object.values(spTotals).map(d=>({...d,rate:d.chats>0?d.closes/d.chats*100:0})).sort((a,b)=>b.revenue-a.revenue);
  document.getElementById('mSPBody').innerHTML=sortedSPs.length===0
    ?'<tr class="erow"><td colspan="7">No data for this month</td></tr>'
    :sortedSPs.map((s,i)=>{
      const tc=TM[s.team]||{c:'#888'};
      return`<tr onclick="openSPMonthly('${s.sp}','${s.team}')">
        <td><span class="rnk ${rcl(i)}">${md(i)}</span></td>
        <td><div class="tcell"><div class="tav" style="background:rgba(0,0,0,0.4);color:${tc.c};font-size:13px">${s.sp[0].toUpperCase()}</div><div><div class="tn">${s.sp}</div><div class="tm">Team ${s.team}</div></div></div></td>
        <td><span class="nb">${s.chats}</span></td>
        <td><span class="nb">${s.calls}</span></td>
        <td><span class="nb">${s.closes}</span></td>
        <td><span class="rb ${rc(s.rate)}">${s.rate.toFixed(1)}%</span></td>
        <td><span class="rc">${fFull(s.revenue)}</span></td>
      </tr>`;
    }).join('');

  // Product grid
  document.getElementById('mProdGrid').innerHTML=Object.entries(prodTotals).map(([name,d])=>`
    <div class="pi ${d.count>0?'hs':''}">
      <div class="pi-n">${name}</div>
      <div class="pi-c">${d.count}</div>
      <div class="pi-r">${d.revenue>0?fFull(d.revenue):'—'}</div>
    </div>`).join('');

  // Day breakdown — only show days with data
  const activeDayData=dayData.filter(d=>d.chats>0||d.closes>0||d.rev>0);
  document.getElementById('mDayBody').innerHTML=activeDayData.length===0
    ?'<tr class="erow"><td colspan="6">No data recorded this month</td></tr>'
    :activeDayData.sort((a,b)=>b.rev-a.rev).map((d,i)=>{
      const dt=new Date(d.k+'T00:00:00');
      return`<tr>
        <td style="text-align:left"><span style="font-family:'DM Mono',monospace;font-size:11px;color:#6060a0">${d.k}</span></td>
        <td><span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:white">${dt.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</span></td>
        <td><span class="nb">${d.chats}</span></td>
        <td><span class="nb">${d.closes}</span></td>
        <td><span class="rc">${fFull(d.rev)}</span></td>
        <td><span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#f5c518">${d.topSP}</span></td>
      </tr>`;
    }).join('');
}

function openSPMonthly(sp,team){
  // reuse existing SP modal but with monthly data
  const dayKeys=[];
  const days=getDaysInMonth(mYear,mMonth);
  for(let d=1;d<=days;d++) dayKeys.push(dk(new Date(mYear,mMonth,d)));
  const entries=dayKeys.flatMap(k=>allData[k]||[]);
  const acts=dayKeys.flatMap(k=>allActs[k]||[]);
  const spList=aggSP(entries,acts);
  const s=spList.find(x=>x.sp===sp&&x.team===team)||{sp,team,chats:0,closes:0,revenue:0,calls:0,fups:0,prods:{}};
  const tc=TM[team]||{c:'#888',bg:'#111',e:''};
  document.getElementById('mAv').textContent=sp[0].toUpperCase();
  document.getElementById('mAv').style.background=tc.bg;
  document.getElementById('mAv').style.color=tc.c;
  document.getElementById('mName').textContent=sp;
  document.getElementById('mTeam').textContent='Team '+team+' '+tc.e+' · '+fMonthName(mYear,mMonth);
  document.getElementById('mKPIs').innerHTML=`
    <div class="mk"><div class="mkl">Revenue This Month</div><div class="mkv go" style="font-size:18px">${fFull(s.revenue)}</div></div>
    <div class="mk"><div class="mkl">Total Chats</div><div class="mkv">${s.chats}</div></div>
    <div class="mk"><div class="mkl">Total Calls</div><div class="mkv bl">${s.calls}</div></div>
    <div class="mk"><div class="mkl">Follow Ups</div><div class="mkv or">${s.fups}</div></div>
    <div class="mk"><div class="mkl">Total Closes</div><div class="mkv gr">${s.closes}</div></div>
    <div class="mk"><div class="mkl">Close Rate</div><div class="mkv">${s.chats>0?(s.closes/s.chats*100).toFixed(1):0}%</div></div>`;
  const prods=Object.entries(s.prods||{}).sort((a,b)=>b[1]-a[1]);
  document.getElementById('mProds').innerHTML=prods.length===0
    ?'<div style="color:#333350;font-size:11px;padding:6px 0;">No closes this month.</div>'
    :prods.map(([prod,qty])=>`
      <div class="mpr">
        <div><div class="mpn">${prod}</div><div class="mpd">${qty} unit × Rp ${fRp(P[prod]||0)}</div></div>
        <div class="mpr-r">${fFull((P[prod]||0)*qty)}</div>
      </div>`).join('');
  document.getElementById('spMo').style.display='flex';
}

// ══ AI DAILY BRIEFING ══
function buildDataSummaryForAI(){
  // Gather yesterday + today + last 7 days data
  const yd=new Date();yd.setDate(yd.getDate()-1);
  const ydKey=dk(yd);
  const todayKey=dk(new Date());

  const last7Keys=[];
  for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);last7Keys.push(dk(d));}

  const ydEntries=allData[ydKey]||[];
  const ydActs=allActs[ydKey]||[];
  const todayEntries=allData[todayKey]||[];

  // Yesterday totals
  const ydTots=totals(ydEntries,ydActs);
  const ydRate=ydTots.chats>0?(ydTots.closes/ydTots.chats*100).toFixed(1):0;

  // SP breakdown yesterday
  const ydSPs=aggSP(ydEntries,ydActs).slice(0,5);

  // Who hasn't reported calls yesterday
  const reportedYd=new Set((allActs[ydKey]||[]).map(a=>a.sp+'|'+a.team));
  const allSPsList=[];
  Object.entries(TM).forEach(([tn,tc])=>tc.m.forEach(sp=>allSPsList.push({sp,team:tn})));
  const notReported=allSPsList.filter(s=>!reportedYd.has(s.sp+'|'+s.team)).map(s=>s.sp);

  // 7-day trend
  const w7entries=last7Keys.flatMap(k=>allData[k]||[]);
  const w7acts=last7Keys.flatMap(k=>allActs[k]||[]);
  const w7tots=totals(w7entries,w7acts);

  // Best/worst team yesterday
  const ydTeams=aggTeams(ydEntries,ydActs).filter(t=>t.chats>0||t.closes>0);

  // Top product yesterday
  const ydProds=aggProds(ydEntries);
  const topProd=Object.entries(ydProds).sort((a,b)=>b[1].count-a[1].count).find(([,d])=>d.count>0);

  return{
    date:yd.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}),
    yesterday:{
      chats:ydTots.chats,closes:ydTots.closes,revenue:ydTots.revenue,
      calls:ydTots.calls,followups:ydTots.fups,closeRate:ydRate,
      target:160,hitTarget:ydTots.chats>=160
    },
    todayChats:todayEntries.reduce((a,e)=>a+e.chats,0),
    topSPs:ydSPs.map(s=>({name:s.sp,team:s.team,chats:s.chats,closes:s.closes,revenue:s.revenue})),
    bestTeam:ydTeams[0]?{name:ydTeams[0].n,revenue:ydTeams[0].revenue,closes:ydTeams[0].closes}:null,
    worstTeam:ydTeams[ydTeams.length-1]&&ydTeams.length>1?{name:ydTeams[ydTeams.length-1].n,chats:ydTeams[ydTeams.length-1].chats}:null,
    notReportedCalls:notReported,
    topProduct:topProd?{name:topProd[0],units:topProd[1].count,revenue:topProd[1].revenue}:null,
    week7:{chats:w7tots.chats,closes:w7tots.closes,revenue:w7tots.revenue,avgDaily:Math.round(w7tots.chats/7)},
    totalSPs:allSPsList.length
  };
}

async function generateBriefing(){
  const btn=document.getElementById('aiBriefBtn');
  const body=document.getElementById('aiBriefBody');
  const footer=document.getElementById('aiBriefFooter');

  btn.disabled=true;
  btn.textContent='Generating...';
  body.innerHTML='<div class="ai-loading"><div class="ai-spinner"></div>AI sedang menganalisis data tim Hurricane kamu...</div>';
  footer.style.display='none';

  const data=buildDataSummaryForAI();
  const todayStr=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.getElementById('aiBriefDate').textContent=todayStr;

  const prompt=`Kamu adalah AI business analyst untuk Hurricane XCS, sebuah brand otomotif performa yang menjual voltage stabilizer (seri XCS). Kamu menganalisis performa sales team setiap hari dan memberikan briefing kepada owner (Jefferson, 20 tahun, entrepreneur).

Data performa tim kemarin (${data.date}):
- Total Chat Masuk: ${data.yesterday.chats} (target: ${data.yesterday.target}) ${data.yesterday.hitTarget?'✅ TARGET TERCAPAI':'❌ TIDAK MENCAPAI TARGET'}
- Total Closes: ${data.yesterday.closes} unit
- Total Revenue: Rp ${data.yesterday.revenue.toLocaleString('id-ID')}
- Close Rate: ${data.yesterday.closeRate}%
- Total Calls: ${data.yesterday.calls}
- Total Follow Up: ${data.yesterday.followups}

Top 5 Salesperson kemarin:
${data.topSPs.map((s,i)=>`${i+1}. ${s.name} (Team ${s.team}): ${s.chats} chats, ${s.closes} closes, Rp ${s.revenue.toLocaleString('id-ID')}`).join('\n')||'Belum ada data'}

${data.bestTeam?`Tim terbaik: ${data.bestTeam.name} (${data.bestTeam.closes} closes, Rp ${data.bestTeam.revenue.toLocaleString('id-ID')})`:''}
${data.topProduct?`Produk terlaris: ${data.topProduct.name} (${data.topProduct.units} unit terjual)`:''}
${data.notReportedCalls.length>0?`SP yang BELUM laporan calls/followup: ${data.notReportedCalls.join(', ')}`:'Semua SP sudah laporan ✅'}

Performa 7 hari terakhir:
- Total Chat: ${data.week7.chats} (rata-rata ${data.week7.avgDaily}/hari)
- Total Closes: ${data.week7.closes} unit
- Total Revenue: Rp ${data.week7.revenue.toLocaleString('id-ID')}

Buat briefing harian dalam Bahasa Indonesia yang:
1. Singkat, padat, dan actionable (tidak bertele-tele)
2. Highlight pencapaian yang bagus dengan pujian singkat
3. Identifikasi masalah yang perlu diperhatikan
4. Berikan 2-3 rekomendasi konkret untuk hari ini
5. Motivasi tim dengan gaya yang energetik tapi profesional
6. Format dengan sections yang jelas: 📊 Ringkasan, ⭐ Highlight, ⚠️ Perhatian, 🎯 Action Today

Gunakan data nyata di atas. Jangan terlalu panjang, maksimal 250 kata.`;

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1000,
        messages:[{role:'user',content:prompt}]
      })
    });
    const json=await res.json();
    const text=json.content?.[0]?.text||'Gagal generate briefing.';

    // Format the text nicely
    const formatted=text
      .replace(/📊[^\n]*/g,m=>`<div class="ai-section"><div class="ai-section-title">📊 Ringkasan</div><div class="ai-section-body">${m.replace('📊','').replace(/\*\*(.*?)\*\*/g,'<span class="ai-highlight">$1</span>').trim()}`)
      .replace(/⭐[^\n]*/g,m=>`</div></div><div class="ai-section"><div class="ai-section-title">⭐ Highlight</div><div class="ai-section-body">${m.replace('⭐','').trim()}`)
      .replace(/⚠️[^\n]*/g,m=>`</div></div><div class="ai-section"><div class="ai-section-title">⚠️ Perhatian</div><div class="ai-section-body">${m.replace('⚠️','').trim()}`)
      .replace(/🎯[^\n]*/g,m=>`</div></div><div class="ai-section"><div class="ai-section-title">🎯 Action Today</div><div class="ai-section-body">${m.replace('🎯','').trim()}</div></div>`);

    // Clean display
    const cleanText=text
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n\n/g,'</p><p>')
      .replace(/\n/g,'<br>');

    body.innerHTML=`<div class="ai-content"><p>${cleanText}</p></div>`;
    footer.style.display='flex';

    const now=new Date();
    document.getElementById('aiBriefMeta').textContent=`Generated ${now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} · Powered by Claude AI`;

    // Save to Firebase so everyone sees the same briefing
    const briefKey=dk(new Date());
    if(window.db){
      window.db.ref('briefing/'+briefKey).set({
        text:text,
        generatedAt:Date.now(),
        generatedBy:'AI'
      });
    } else {
      try{localStorage.setItem('hxcs_brief',JSON.stringify({key:briefKey,text,ts:Date.now()}));}catch(e){}
    }

  }catch(err){
    body.innerHTML=`<div class="ai-empty" style="color:#ff3b5c">⚠️ Gagal generate briefing. Pastikan koneksi internet aktif.<br><span style="font-size:10px;color:#6060a0">${err.message}</span></div>`;
  }

  btn.disabled=false;
  btn.textContent='✨ Generate';
}

function loadExistingBriefing(){
  // Load today's briefing from Firebase if exists
  const todayKey=dk(new Date());
  if(window.db){
    window.db.ref('briefing/'+todayKey).once('value',snap=>{
      if(snap.exists()){
        const b=snap.val();
        const body=document.getElementById('aiBriefBody');
        const footer=document.getElementById('aiBriefFooter');
        const cleanText=b.text
          .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
          .replace(/\n\n/g,'</p><p>')
          .replace(/\n/g,'<br>');
        body.innerHTML=`<div class="ai-content"><p>${cleanText}</p></div>`;
        footer.style.display='flex';
        const t=new Date(b.generatedAt);
        document.getElementById('aiBriefMeta').textContent=`Generated ${t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} · Powered by Claude AI`;
        document.getElementById('aiBriefDate').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
      }
    });
  } else {
    try{
      const saved=JSON.parse(localStorage.getItem('hxcs_brief')||'{}');
      if(saved.key===dk(new Date())&&saved.text){
        const body=document.getElementById('aiBriefBody');
        const footer=document.getElementById('aiBriefFooter');
        const cleanText=saved.text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
        body.innerHTML=`<div class="ai-content"><p>${cleanText}</p></div>`;
        footer.style.display='flex';
        document.getElementById('aiBriefMeta').textContent='Loaded from cache · Powered by Claude AI';
      }
    }catch(e){}
  }
}
let _notReportedDateMode='yesterday'; // 'yesterday' | 'today'

function setNotReportedMode(mode){
  _notReportedDateMode=mode;
  renderNotReported();
}

function renderNotReported(){
  const panel=document.getElementById('notReportedPanel');
  if(!panel)return;

  // Determine which date to check
  const targetDate=new Date();
  if(_notReportedDateMode==='yesterday')targetDate.setDate(targetDate.getDate()-1);
  const tKey=dk(targetDate);
  const tLabel=targetDate.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});

  const reportedSPs=new Set();
  const lateSubmissions=new Set();
  (allActs[tKey]||[]).forEach(a=>{
    reportedSPs.add(a.sp+'|'+a.team);
    if(a.isLate)lateSubmissions.add(a.sp+'|'+a.team);
  });
  const allSPs=[];
  Object.entries(TM).forEach(([tn,tc])=>tc.m.forEach(sp=>allSPs.push({sp,team:tn,tc})));
  const missing=allSPs.filter(s=>!reportedSPs.has(s.sp+'|'+s.team));
  const done=allSPs.filter(s=>reportedSPs.has(s.sp+'|'+s.team));

  panel.innerHTML=`
    <div class="nr-panel">
      <div class="nr-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div>
          <div class="nr-title" style="color:${missing.length>0?'var(--red)':'var(--green)'}">
            ${missing.length>0?`⚠️ ${missing.length} SP belum laporan`:'✅ Semua sudah laporan'}
            ${lateSubmissions.size>0?`<span style="margin-left:8px;font-size:11px;color:#ff6b1a">· ${lateSubmissions.size} LATE</span>`:''}
          </div>
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#6060a0;margin-top:2px;letter-spacing:1px;">Untuk ${tLabel}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="display:flex;background:#0e0e1a;border:1px solid #252540;border-radius:8px;padding:2px;">
            <button onclick="setNotReportedMode('yesterday')" style="background:${_notReportedDateMode==='yesterday'?'#f5c518':'transparent'};color:${_notReportedDateMode==='yesterday'?'#000':'#6060a0'};border:none;border-radius:6px;padding:5px 10px;font-family:'Space Grotesk',sans-serif;font-size:10px;font-weight:700;cursor:pointer;">Yesterday</button>
            <button onclick="setNotReportedMode('today')" style="background:${_notReportedDateMode==='today'?'#f5c518':'transparent'};color:${_notReportedDateMode==='today'?'#000':'#6060a0'};border:none;border-radius:6px;padding:5px 10px;font-family:'Space Grotesk',sans-serif;font-size:10px;font-weight:700;cursor:pointer;">Today</button>
          </div>
          <div class="nr-count" style="color:${missing.length>0?'var(--red)':'var(--green)'};font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;">
            ${done.length}/${allSPs.length}
          </div>
        </div>
      </div>
      <div class="nr-grid">
        ${missing.map(s=>`
          <div class="nr-item missing">
            <div class="nr-av" style="background:${s.tc.bg};color:${s.tc.c}">${s.sp[0]}</div>
            <div style="flex:1;min-width:0">
              <div class="nr-name">${s.sp}</div>
              <div class="nr-team">${s.team}</div>
            </div>
            <div class="nr-status">❌</div>
          </div>`).join('')}
        ${done.map(s=>`
          <div class="nr-item done">
            <div class="nr-av" style="background:${s.tc.bg};color:${s.tc.c}">${s.sp[0]}</div>
            <div style="flex:1;min-width:0">
              <div class="nr-name">${s.sp}</div>
              <div class="nr-team">${s.team}</div>
            </div>
            <div class="nr-status">${lateSubmissions.has(s.sp+'|'+s.team)?'<span style="font-family:\'DM Mono\',monospace;font-size:8px;background:rgba(255,107,26,0.15);color:#ff6b1a;border:1px solid rgba(255,107,26,0.3);padding:1px 4px;border-radius:3px">LATE</span>':'✅'}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ══ SP PERFORMANCE TREND ══
function renderTrend(){
  const thisWeekKeys=[],lastWeekKeys=[];
  for(let i=0;i<7;i++){
    const d1=new Date();d1.setDate(d1.getDate()-i);thisWeekKeys.push(dk(d1));
    const d2=new Date();d2.setDate(d2.getDate()-i-7);lastWeekKeys.push(dk(d2));
  }
  function weekData(keys){
    const sp={};
    keys.flatMap(k=>allData[k]||[]).forEach(e=>{
      const k=e.sp+'|'+e.team;
      if(!sp[k])sp[k]={sp:e.sp,team:e.team,chats:0,closes:0,revenue:0,calls:0,fups:0};
      sp[k].chats+=e.chats;sp[k].closes+=e.units;sp[k].revenue+=e.revenue;
    });
    keys.flatMap(k=>allActs[k]||[]).forEach(a=>{
      const k=a.sp+'|'+a.team;
      if(!sp[k])sp[k]={sp:a.sp,team:a.team,chats:0,closes:0,revenue:0,calls:0,fups:0};
      sp[k].calls+=a.calls;sp[k].fups+=a.fups;
    });
    return sp;
  }
  const thisW=weekData(thisWeekKeys);
  const lastW=weekData(lastWeekKeys);

  function diffTxt(curr,prev,isRev){
    const diff=curr-prev;
    if(diff===0)return{cls:'tdiff-fl',txt:'='};
    const pct=prev>0?Math.round(Math.abs(diff)/prev*100):100;
    const arrow=diff>0?'↑':'↓';
    return{cls:diff>0?'tdiff-up':'tdiff-dn',txt:`${arrow}${pct}%`};
  }
  function overallBadge(tw,lw){
    if(!lw||(!lw.revenue&&!lw.chats))return{cls:'fl',txt:'— No prev'};
    const d=tw.revenue-lw.revenue;
    if(d>0)return{cls:'up',txt:'↑ Naik'};
    if(d<0)return{cls:'dn',txt:'↓ Turun'};
    return{cls:'fl',txt:'= Stabil'};
  }

  const allSPs=[];
  Object.entries(TM).forEach(([tn,tc])=>tc.m.forEach(sp=>allSPs.push({sp,team:tn,tc})));
  const maxChats=Math.max(1,...allSPs.map(({sp,team})=>(thisW[sp+'|'+team]||{}).chats||0));
  const maxRev=Math.max(1,...allSPs.map(({sp,team})=>(thisW[sp+'|'+team]||{}).revenue||0));

  document.getElementById('trendGrid').innerHTML=allSPs.map(({sp,team,tc})=>{
    const k=sp+'|'+team;
    const tw=thisW[k]||{chats:0,closes:0,revenue:0,calls:0,fups:0};
    const lw=lastW[k]||{chats:0,closes:0,revenue:0,calls:0,fups:0};
    const badge=overallBadge(tw,lw);
    const rows=[
      {label:'CHATS',curr:tw.chats,prev:lw.chats,max:maxChats,color:tc.c},
      {label:'CLOSES',curr:tw.closes,prev:lw.closes,max:Math.max(1,tw.closes,lw.closes),color:'var(--green)'},
      {label:'CALLS',curr:tw.calls,prev:lw.calls,max:Math.max(1,tw.calls,lw.calls),color:'var(--blue)'},
      {label:'F/UP',curr:tw.fups,prev:lw.fups,max:Math.max(1,tw.fups,lw.fups),color:'var(--orange)'},
      {label:'REVENUE',curr:tw.revenue,prev:lw.revenue,max:maxRev,color:'var(--gold)',isRev:true},
    ];
    return`<div class="trend-card">
      <div class="trend-card-header">
        <div class="trend-av" style="background:${tc.bg};color:${tc.c}">${sp[0]}</div>
        <div><div class="trend-name">${sp}</div><div class="trend-team">Team ${team} ${tc.e}</div></div>
        <div class="trend-badge ${badge.cls}">${badge.txt}</div>
      </div>
      <div class="trend-rows">
        ${rows.map(r=>{
          const d=diffTxt(r.curr,r.prev,r.isRev);
          const bw=r.max>0?Math.round(r.curr/r.max*100):0;
          return`<div class="trend-row">
            <div class="trend-lbl">${r.label}</div>
            <div class="trend-bar-track"><div class="trend-bar-fill" style="width:${bw}%;background:${r.color}"></div></div>
            <div class="trend-val">${r.isRev?fRp(r.curr):r.curr}</div>
            <div class="trend-diff ${d.cls}">${d.txt}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  // Team trend table
  document.getElementById('teamTrendBody').innerHTML=Object.entries(TM).map(([tn,tc])=>{
    const tw={chats:0,closes:0,revenue:0},lw={chats:0,closes:0,revenue:0};
    tc.m.forEach(sp=>{
      const k=sp+'|'+tn;
      const t=thisW[k]||{},l=lastW[k]||{};
      tw.chats+=t.chats||0;tw.closes+=t.closes||0;tw.revenue+=t.revenue||0;
      lw.chats+=l.chats||0;lw.closes+=l.closes||0;lw.revenue+=l.revenue||0;
    });
    function td(curr,prev,isRev){
      const diff=curr-prev;
      const cls=diff>0?'tt-up':diff<0?'tt-dn':'tt-fl';
      const arrow=diff>0?'↑':diff<0?'↓':'=';
      return diff===0?`<span class="tt-fl">—</span>`:`<span class="${cls}">${arrow}${isRev?fRp(Math.abs(diff)):Math.abs(diff)}</span>`;
    }
    return`<tr>
      <td><div class="tcell"><div class="tav" style="background:${tc.bg};color:${tc.c}">${tc.e}</div><div class="tn">${tn}</div></div></td>
      <td><span class="nb">${tw.chats}</span></td><td>${td(tw.chats,lw.chats,false)}</td>
      <td><span class="nb">${tw.closes}</span></td><td>${td(tw.closes,lw.closes,false)}</td>
      <td><span class="rc">${fFull(tw.revenue)}</span></td><td>${td(tw.revenue,lw.revenue,true)}</td>
    </tr>`;
  }).join('');
}

// ══ UPDATE OMSET ══
let omsetOffset=0;
let omsetCalYear=new Date().getFullYear();
let omsetCalMonth=new Date().getMonth();
let omsetCalMode='days';

const OMSET_FIELDS=[
  'christ_a','christ_b',
  'valen_meta','valen_shopee','maryam_meta',
  'livia_meta','livia_tokped','shifa_meta','live_tiktok',
  'stanley',
  'ivan_meta','hendri_meta',
  'agung','luthfi','rei','koko',
  'xcsr_tokped','xcsr_shopee','amel'
];

function getOmsetKey(){
  const d=new Date();d.setDate(d.getDate()+omsetOffset);return dk(d);
}

function omsetPrevDay(){omsetOffset--;updateOmsetUI();}
function omsetNextDay(){if(omsetOffset<0)omsetOffset++;updateOmsetUI();}

function updateOmsetUI(){
  const d=new Date();d.setDate(d.getDate()+omsetOffset);
  const isT=omsetOffset===0;
  document.getElementById('omsetDayLabel').textContent=isT?'TODAY':fShort(d);
  document.getElementById('omsetDateLabel').textContent=d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  loadOmsetData();
}

function loadOmsetData(){
  const key=getOmsetKey();
  const load=()=>{
    const data=(window.db?null:JSON.parse(localStorage.getItem('hxcs_omset')||'{}'))||{};
    const dayData=data[key]||{};
    OMSET_FIELDS.forEach(f=>{
      const el=document.getElementById('o_'+f);
      if(el)el.value=dayData[f]||'';
    });
    recalcOmset();
  };

  if(window.db){
    window.db.ref('omset/'+key).once('value',snap=>{
      const dayData=snap.val()||{};
      OMSET_FIELDS.forEach(f=>{
        const el=document.getElementById('o_'+f);
        if(el)el.value=dayData[f]||'';
      });
      recalcOmset();
    });
  } else {
    load();
  }
}

function recalcOmset(){
  let total=0;
  OMSET_FIELDS.forEach(f=>{
    const el=document.getElementById('o_'+f);
    total+=parseFloat(el?.value||0)||0;
  });
  const fmt=fFull(total);
  const el1=document.getElementById('omsetTotal');
  const el2=document.getElementById('omsetTotalBig');
  const el3=document.getElementById('omsetTotalSub');
  if(el1)el1.textContent=fmt;
  if(el2)el2.textContent=fmt;
  if(el3)el3.textContent=total>0?`${OMSET_FIELDS.filter(f=>parseFloat(document.getElementById('o_'+f)?.value||0)>0).length} channel diisi`:'Isi form di atas untuk melihat total';
}

function saveOmset(){
  const key=getOmsetKey();
  const data={};
  OMSET_FIELDS.forEach(f=>{
    const v=parseFloat(document.getElementById('o_'+f)?.value||0)||0;
    if(v>0)data[f]=v;
  });
  data.savedAt=Date.now();
  data.total=OMSET_FIELDS.reduce((a,f)=>a+(parseFloat(document.getElementById('o_'+f)?.value||0)||0),0);

  if(window.db){
    window.db.ref('omset/'+key).set(data).then(()=>{
      showOmsetSaved();
    }).catch(e=>alert('Gagal simpan: '+e.message));
  } else {
    try{
      const all=JSON.parse(localStorage.getItem('hxcs_omset')||'{}');
      all[key]=data;
      localStorage.setItem('hxcs_omset',JSON.stringify(all));
      showOmsetSaved();
    }catch(e){alert('Gagal simpan!');}
  }
}

function showOmsetSaved(){
  const btn=document.querySelector('#page-omset .btn.bg-gold');
  if(btn){
    const orig=btn.innerHTML;
    btn.innerHTML='✅ Tersimpan!';
    btn.style.background='#00e676';
    setTimeout(()=>{btn.innerHTML=orig;btn.style.background='';},2000);
  }
}

// OMSET CALENDAR
function openOmsetCal(){
  const d=new Date();d.setDate(d.getDate()+omsetOffset);
  omsetCalYear=d.getFullYear();omsetCalMonth=d.getMonth();
  omsetCalMode='days';
  renderOmsetCal();
  document.getElementById('omsetCalOverlay').style.display='flex';
}
function handleOmsetCalClick(e){if(e.target===document.getElementById('omsetCalOverlay'))document.getElementById('omsetCalOverlay').style.display='none';}
function toggleOmsetYearMonth(){omsetCalMode=omsetCalMode==='days'?'yearmonth':'days';renderOmsetCal();}
function omsetCalPrevMonth(){omsetCalMonth--;if(omsetCalMonth<0){omsetCalMonth=11;omsetCalYear--;}renderOmsetCal();}
function omsetCalNextMonth(){const n=new Date();if(omsetCalYear===n.getFullYear()&&omsetCalMonth>=n.getMonth())return;omsetCalMonth++;if(omsetCalMonth>11){omsetCalMonth=0;omsetCalYear++;}renderOmsetCal();}
function omsetJumpToday(){omsetOffset=0;document.getElementById('omsetCalOverlay').style.display='none';updateOmsetUI();}

function renderOmsetCal(){
  const now=new Date();
  document.getElementById('omsetCalTopText').textContent=MONTHS_FULL[omsetCalMonth].toUpperCase()+' '+omsetCalYear;
  const lbl=document.getElementById('omsetCalTopLabel');
  lbl.className='cal-topbar-label'+(omsetCalMode==='yearmonth'?' open':'');

  const yp=document.getElementById('omsetCalYearPicker');
  const mp=document.getElementById('omsetCalMonthPicker');
  const mn=document.getElementById('omsetCalMonthNav');

  if(omsetCalMode==='yearmonth'){
    yp.className='cal-year-picker show';mp.className='cal-month-picker show';mn.style.display='none';
    let yh='';for(let y=2024;y<=now.getFullYear();y++)yh+=`<div class="cal-year-item${y===omsetCalYear?' active':''}" onclick="omsetSelYear(${y})">${y}</div>`;
    document.getElementById('omsetCalYearList').innerHTML=yh;
    setTimeout(()=>{const a=document.querySelector('#omsetCalYearList .active');if(a)a.scrollIntoView({inline:'center',behavior:'smooth'});},50);
    let mh='';MONTHS.forEach((m,i)=>{const f=omsetCalYear===now.getFullYear()&&i>now.getMonth();mh+=`<div class="cal-month-item${i===omsetCalMonth?' active':''}${f?' future':''}" onclick="${f?'':` omsetSelMonth(${i})`}">${m}</div>`;});
    mp.innerHTML=mh;
  } else {
    yp.className='cal-year-picker';mp.className='cal-month-picker';mn.style.display='flex';
    document.getElementById('omsetCalMonthDisplay').textContent=MONTHS_FULL[omsetCalMonth]+' '+omsetCalYear;
    renderOmsetDays();
  }
}

function omsetSelYear(y){omsetCalYear=y;const n=new Date();if(omsetCalYear===n.getFullYear()&&omsetCalMonth>n.getMonth())omsetCalMonth=n.getMonth();renderOmsetCal();}
function omsetSelMonth(m){omsetCalMonth=m;omsetCalMode='days';renderOmsetCal();}

function renderOmsetDays(){
  const today=new Date();today.setHours(0,0,0,0);
  const selD=new Date();selD.setDate(selD.getDate()+omsetOffset);selD.setHours(0,0,0,0);
  const selectedKey=dk(selD);
  const firstDay=new Date(omsetCalYear,omsetCalMonth,1).getDay();
  const daysInMonth=new Date(omsetCalYear,omsetCalMonth+1,0).getDate();
  let html='';
  for(let i=0;i<firstDay;i++)html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(omsetCalYear,omsetCalMonth,d);date.setHours(0,0,0,0);
    const key=dk(date);
    const isToday_=dk(today)===key;
    const isSelected=key===selectedKey;
    const isFuture=date>today;
    let cls='cal-day';
    if(isToday_)cls+=' today';
    if(isSelected)cls+=' selected';
    if(isFuture)cls+=' future';
    const onclick=isFuture?'':` onclick="omsetPickDate('${key}')"`;
    html+=`<div class="${cls}"${onclick}>${d}<span class="dot"></span></div>`;
  }
  document.getElementById('omsetCalDays').innerHTML=html;
}

function omsetPickDate(key){
  const today=new Date();today.setHours(0,0,0,0);
  const picked=new Date(key+'T00:00:00');picked.setHours(0,0,0,0);
  omsetOffset=Math.round((picked-today)/(86400000));
  document.getElementById('omsetCalOverlay').style.display='none';
  updateOmsetUI();
}

// Init omset page on load
function initOmset(){
  updateOmsetUI();
}

// ══ CUSTOM CONFIRM MODAL (mobile-safe replacement for confirm()) ══
let _confirmResolve=null;
function showConfirm(title, message, okText, isDanger){
  return new Promise(resolve=>{
    _confirmResolve=resolve;
    document.getElementById('confirmTitle').textContent=title||'Confirm';
    document.getElementById('confirmMessage').textContent=message||'';
    const btn=document.getElementById('confirmOkBtn');
    btn.textContent=okText||'Confirm';
    btn.style.background=isDanger===false?'#f5c518':'#ff3b5c';
    btn.style.color=isDanger===false?'#000':'white';
    document.getElementById('confirmMo').style.display='flex';
  });
}
function closeConfirmMo(result){
  document.getElementById('confirmMo').style.display='none';
  if(_confirmResolve){_confirmResolve(result);_confirmResolve=null;}
}


// ══════════════════════════════════════
// ══ ADMIN PANEL (window-scoped for safety) ══
// ══════════════════════════════════════
let adminUnlocked=false;
const DEFAULT_ADMIN_PWD='hurricane2026';

function getAdminPwd(){
  return localStorage.getItem('hxcs_admin_pwd')||DEFAULT_ADMIN_PWD;
}

function checkAdminPwd(){
  const entered=document.getElementById('adminPwd').value;
  if(entered===getAdminPwd()){
    adminUnlocked=true;
    document.getElementById('adminLogin').style.display='none';
    document.getElementById('adminPanel').style.display='block';
    document.getElementById('adminPwdError').style.display='none';
    document.getElementById('adminPwd').value='';
    loadAdminSettings();
  } else {
    document.getElementById('adminPwdError').style.display='block';
    setTimeout(()=>document.getElementById('adminPwdError').style.display='none',3000);
  }
}

function adminLogout(){
  let adminUnlocked=false;
  document.getElementById('adminLogin').style.display='block';
  document.getElementById('adminPanel').style.display='none';
}

function loadAdminSettings(){
  // Load targets
  const cfg=JSON.parse(localStorage.getItem('hxcs_config')||'{}');
  document.getElementById('setChatTarget').value=cfg.chatTarget||TC;
  document.getElementById('setRevTarget').value=cfg.revTarget||TR;
  document.getElementById('setDeadline').value=cfg.deadlineHour||14;

  if(window.db){
    window.db.ref('config').once('value',snap=>{
      const c=snap.val()||{};
      if(c.chatTarget)document.getElementById('setChatTarget').value=c.chatTarget;
      if(c.revTarget)document.getElementById('setRevTarget').value=c.revTarget;
      if(c.deadlineHour)document.getElementById('setDeadline').value=c.deadlineHour;
    });
  }

  renderAdminProducts();
  renderAdminTeams();
  initEditRecords();
}

// ══ EDIT RECORDS ══
function initEditRecords(){
  // Default to today
  document.getElementById('editFilterDate').value=dk(new Date());

  // Build SP filter dropdown
  const sel=document.getElementById('editFilterSP');
  sel.innerHTML='<option value="">All Salespeople</option>';
  Object.entries(TM).forEach(([team,tc])=>{
    tc.m.forEach(sp=>{
      sel.innerHTML+=`<option value="${sp}|${team}">${sp} (${team})</option>`;
    });
  });

  renderEditRecords();
}

function renderEditRecords(){
  const date=document.getElementById('editFilterDate').value;
  const spFilter=document.getElementById('editFilterSP').value;
  const typeFilter=document.getElementById('editFilterType').value;
  const list=document.getElementById('editRecordsList');
  const empty=document.getElementById('editRecordsEmpty');

  if(!date){
    list.innerHTML='';
    empty.style.display='block';
    empty.textContent='Pick a date to see records';
    return;
  }

  const entries=allData[date]||[];
  const acts=allActs[date]||[];

  let records=[];
  if(typeFilter!=='activity'){
    entries.forEach((e,i)=>records.push({...e,_type:'sale',_idx:i,_date:date}));
  }
  if(typeFilter!=='sales'){
    acts.forEach((a,i)=>records.push({...a,_type:'activity',_idx:i,_date:date}));
  }

  if(spFilter){
    const [sp,team]=spFilter.split('|');
    records=records.filter(r=>r.sp===sp&&r.team===team);
  }

  records.sort((a,b)=>(b.ts||0)-(a.ts||0));

  if(!records.length){
    list.innerHTML='';
    empty.style.display='block';
    empty.textContent='No records for this filter';
    return;
  }

  empty.style.display='none';
  list.innerHTML=records.map(r=>{
    const tc=TM[r.team]||{c:'#888',bg:'#161624'};
    const time=r.ts?new Date(r.ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):'—';
    const lateBadge=r.isLate?'<span style="background:rgba(255,107,26,0.15);color:#ff6b1a;padding:2px 6px;border-radius:4px;font-size:8px;font-family:Space Mono,monospace;letter-spacing:1px;margin-left:6px;">LATE</span>':'';

    if(r._type==='sale'){
      return`<div style="background:#0e0e1a;border:1px solid #252540;border-radius:10px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <div style="width:24px;height:24px;border-radius:6px;background:${tc.bg};color:${tc.c};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;">${(r.sp||'?')[0]}</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:700;color:white;">${r.sp}</div>
          <span style="font-family:'Space Mono',monospace;font-size:9px;color:#6060a0;">${r.team} · ${time}</span>
          <span style="margin-left:auto;background:rgba(0,230,118,0.1);color:#00e676;padding:3px 8px;border-radius:5px;font-size:9px;font-family:'Space Mono',monospace;letter-spacing:1px;">💰 SALE</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px;font-family:'Space Mono',monospace;color:#e8e8f8;margin-bottom:10px;">
          <div><span style="color:#6060a0;">Product:</span><br/><b style="color:#f5c518;">${r.prod||'—'}</b></div>
          <div><span style="color:#6060a0;">Units:</span><br/><b>${r.units||0}</b></div>
          <div><span style="color:#6060a0;">Revenue:</span><br/><b style="color:#f5c518;">${fFull(r.revenue||0)}</b></div>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="editSaleRecord('${r._date}',${r._idx})" class="btn" style="flex:1;background:rgba(245,197,24,0.1);border:1px solid rgba(245,197,24,0.3);color:#f5c518;height:32px;font-size:11px;">✏️ Edit</button>
          <button onclick="deleteRecord('sale','${r._date}',${r._idx})" class="btn" style="background:rgba(255,59,92,0.1);border:1px solid rgba(255,59,92,0.3);color:#ff3b5c;height:32px;width:50px;">🗑</button>
        </div>
      </div>`;
    } else {
      return`<div style="background:#0e0e1a;border:1px solid #252540;border-radius:10px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <div style="width:24px;height:24px;border-radius:6px;background:${tc.bg};color:${tc.c};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;">${(r.sp||'?')[0]}</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:700;color:white;">${r.sp}</div>
          <span style="font-family:'Space Mono',monospace;font-size:9px;color:#6060a0;">${r.team} · ${time}</span>${lateBadge}
          <span style="margin-left:auto;background:rgba(68,138,255,0.1);color:#448aff;padding:3px 8px;border-radius:5px;font-size:9px;font-family:'Space Mono',monospace;letter-spacing:1px;">📞 ACTIVITY</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px;font-family:'Space Mono',monospace;color:#e8e8f8;margin-bottom:10px;">
          <div><span style="color:#6060a0;">Chats:</span><br/><b style="color:#f5c518;">${r.chats||0}</b></div>
          <div><span style="color:#6060a0;">Calls:</span><br/><b style="color:#448aff;">${r.calls||0}</b></div>
          <div><span style="color:#6060a0;">Followups:</span><br/><b style="color:#ff6b1a;">${r.fups||0}</b></div>
        </div>
        ${r.notes?`<div style="font-size:10px;color:#6060a0;font-family:'Space Mono',monospace;margin-bottom:10px;">📝 ${r.notes}</div>`:''}
        <div style="display:flex;gap:6px;">
          <button onclick="editActRecord('${r._date}',${r._idx})" class="btn" style="flex:1;background:rgba(245,197,24,0.1);border:1px solid rgba(245,197,24,0.3);color:#f5c518;height:32px;font-size:11px;">✏️ Edit</button>
          <button onclick="deleteRecord('activity','${r._date}',${r._idx})" class="btn" style="background:rgba(255,59,92,0.1);border:1px solid rgba(255,59,92,0.3);color:#ff3b5c;height:32px;width:50px;">🗑</button>
        </div>
      </div>`;
    }
  }).join('');
}

function editSaleRecord(date,idx){
  const r=allData[date][idx];
  const newProd=prompt('Product:',r.prod||'');
  if(newProd===null)return;
  const newUnits=prompt('Units:',r.units||1);
  if(newUnits===null)return;
  const newPrice=prompt('Price per unit (Rp):',r.price||0);
  if(newPrice===null)return;

  r.prod=newProd;
  r.units=parseInt(newUnits)||0;
  r.price=parseInt(newPrice)||0;
  r.revenue=r.price*r.units;
  r.editedAt=Date.now();

  if(window.db){
    window.db.ref('scores/'+date).set(allData[date]);
  } else {
    try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
  }
  renderEditRecords();
  renderAll();
  alert('✅ Sale record updated');
}

function editActRecord(date,idx){
  const r=allActs[date][idx];
  const newChats=prompt('Chats:',r.chats||0);
  if(newChats===null)return;
  const newCalls=prompt('Calls:',r.calls||0);
  if(newCalls===null)return;
  const newFups=prompt('Follow ups:',r.fups||0);
  if(newFups===null)return;
  const newNotes=prompt('Notes (leave blank to keep):',r.notes||'');

  r.chats=parseInt(newChats)||0;
  r.calls=parseInt(newCalls)||0;
  r.fups=parseInt(newFups)||0;
  if(newNotes!==null)r.notes=newNotes;
  r.editedAt=Date.now();

  if(window.db){
    window.db.ref('activities/'+date).set(allActs[date]);
  } else {
    try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
  }
  renderEditRecords();
  renderAll();
  alert('✅ Activity record updated');
}

async function deleteRecord(type,date,idx){
  const ok=await showConfirm('Delete Record','Delete this record? This cannot be undone.','Delete',true);
  if(!ok)return;
  if(type==='sale'){
    allData[date].splice(idx,1);
    if(window.db){
      if(allData[date].length)window.db.ref('scores/'+date).set(allData[date]);
      else window.db.ref('scores/'+date).remove();
    } else {
      try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
    }
  } else {
    allActs[date].splice(idx,1);
    if(window.db){
      if(allActs[date].length)window.db.ref('activities/'+date).set(allActs[date]);
      else window.db.ref('activities/'+date).remove();
    } else {
      try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
    }
  }
  renderEditRecords();
  renderAll();
  alert('🗑️ Record deleted');
}

// ══ TOAST NOTIFICATION ══
function showToast(message, type){
  let toast=document.getElementById('hxcsToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='hxcsToast';
    toast.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(150%);background:#161624;border:1px solid #252540;border-radius:12px;padding:14px 20px;color:white;font-family:Space Grotesk,sans-serif;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.5);transition:transform 0.3s;max-width:90vw;text-align:center;';
    document.body.appendChild(toast);
  }
  if(type==='error'){toast.style.borderColor='#ff3b5c';toast.style.color='#ff3b5c';}
  else if(type==='success'){toast.style.borderColor='#00e676';toast.style.color='#00e676';}
  else {toast.style.borderColor='#f5c518';toast.style.color='#f5c518';}
  toast.textContent=message;
  toast.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>{
    toast.style.transform='translateX(-50%) translateY(150%)';
  },3500);
}

function saveTargets(){
  try{
    const chatTarget=parseInt(document.getElementById('setChatTarget').value)||160;
    const revTarget=parseInt(document.getElementById('setRevTarget').value)||70000000;
    const deadlineHour=parseInt(document.getElementById('setDeadline').value)||14;
    const cfg={chatTarget,revTarget,deadlineHour,updatedAt:Date.now()};

    // Update global variables so dashboard sees new values
    TC=chatTarget;
    TR=revTarget;

    // Save locally always
    localStorage.setItem('hxcs_config',JSON.stringify(cfg));
    window._cfgChatTarget=chatTarget;
    window._cfgRevTarget=revTarget;

    showToast('💾 Saving targets...','info');

    // Update goal card text immediately
    updateGoalCardText(chatTarget,revTarget);

    if(window.db){
      window.db.ref('config').set(cfg).then(()=>{
        showToast('✅ Targets saved! Chat: '+chatTarget+' · Rp '+(revTarget/1000000).toFixed(1)+'M','success');
        renderAll();
      }).catch(err=>{
        showToast('⚠️ Local only: '+err.message,'error');
        renderAll();
      });
    } else {
      showToast('✅ Targets saved locally','success');
      renderAll();
    }
  } catch(e){
    showToast('❌ Error: '+e.message,'error');
  }
}

function updateGoalCardText(chatT,revT){
  const goalMain=document.querySelector('.goal-main');
  if(goalMain){
    goalMain.textContent=chatT+' Chats · Target Rp '+revT.toLocaleString('id-ID');
  }
}

function renderAdminProducts(){
  const list=document.getElementById('adminProductList');
  list.innerHTML=Object.entries(P).map(([name,price])=>`
    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;padding:8px 12px;background:#0e0e1a;border:1px solid #252540;border-radius:8px;">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:700;color:white;">${name}</div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-family:'Space Mono',monospace;font-size:10px;color:#6060a0;">Rp</span>
        <input type="number" value="${price}" id="prodPrice_${name.replace(/[^a-zA-Z0-9]/g,'_')}" style="background:transparent;border:none;color:white;font-family:'Space Grotesk',sans-serif;font-size:13px;width:100%;outline:none;" onchange="updateProductPrice('${name}',this.value)"/>
      </div>
      <button onclick="deleteProduct('${name}')" style="background:rgba(255,59,92,0.1);border:1px solid rgba(255,59,92,0.2);color:#ff3b5c;width:32px;height:32px;border-radius:6px;cursor:pointer;">🗑</button>
    </div>`).join('');
}

function updateProductPrice(name,newPrice){
  P[name]=parseInt(newPrice)||0;
  saveProductsToFirebase();
}

async function deleteProduct(name){
  const ok=await showConfirm('Delete Product',`Delete product "${name}"?`,'Delete',true);
  if(!ok)return;
  delete P[name];
  saveProductsToFirebase();
  renderAdminProducts();
  refreshProductDropdown();
}

function addNewProduct(){
  const name=document.getElementById('newProdName').value.trim().toUpperCase();
  const price=parseInt(document.getElementById('newProdPrice').value);
  if(!name||!price){alert('Enter both name and price');return;}
  if(P[name]){alert('Product already exists!');return;}
  P[name]=price;
  saveProductsToFirebase();
  document.getElementById('newProdName').value='';
  document.getElementById('newProdPrice').value='';
  renderAdminProducts();
  refreshProductDropdown();
  alert('✅ Product added: '+name);
}

function saveProductsToFirebase(){
  if(window.db){
    window.db.ref('config/products').set(P);
  } else {
    localStorage.setItem('hxcs_products',JSON.stringify(P));
  }
}

function refreshProductDropdown(){
  const sel=document.getElementById('inProd');
  if(!sel)return;
  const current=sel.value;
  sel.innerHTML='<option value="">— Pilih Produk —</option>'+
    Object.keys(P).map(p=>`<option value="${p}">${p}</option>`).join('');
  sel.value=current;
}

function renderAdminTeams(){
  const list=document.getElementById('adminTeamList');
  list.innerHTML=Object.entries(TM).map(([teamName,tc])=>`
    <div style="background:#0e0e1a;border:1px solid #252540;border-radius:10px;padding:14px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:34px;height:34px;border-radius:8px;background:${tc.bg};color:${tc.c};display:flex;align-items:center;justify-content:center;font-size:16px;">${tc.e}</div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:800;color:white;">${teamName}</div>
        <span style="margin-left:auto;font-family:'Space Mono',monospace;font-size:9px;color:#6060a0;">${tc.m.length} members</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
        ${tc.m.map(sp=>`
          <div style="display:flex;align-items:center;gap:6px;background:#161624;border:1px solid #252540;border-radius:20px;padding:5px 10px 5px 12px;">
            <span style="font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:700;color:white;">${sp}</span>
            <span onclick="removeMember('${teamName}','${sp}')" style="cursor:pointer;color:#ff3b5c;font-size:14px;">✕</span>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:6px;">
        <input type="text" id="newMember_${teamName.replace(/\s/g,'_')}" placeholder="New member name..." style="flex:1;background:#161624;border:1px solid #252540;border-radius:8px;padding:7px 10px;color:white;font-size:12px;outline:none;"/>
        <button onclick="addMember('${teamName}')" class="btn bg-gold" style="height:32px;font-size:11px;padding:0 14px;">+ Add</button>
      </div>
    </div>`).join('');
}

function addMember(teamName){
  const input=document.getElementById('newMember_'+teamName.replace(/\s/g,'_'));
  const name=input.value.trim();
  if(!name)return;
  if(TM[teamName].m.includes(name)){alert('Member already in this team');return;}
  TM[teamName].m.push(name);
  saveTeamsToFirebase();
  renderAdminTeams();
  refreshTeamDropdowns();
  input.value='';
}

async function removeMember(teamName,memberName){
  const ok=await showConfirm('Remove Member',`Remove ${memberName} from team ${teamName}?`,'Remove',true);
  if(!ok)return;
  TM[teamName].m=TM[teamName].m.filter(m=>m!==memberName);
  saveTeamsToFirebase();
  renderAdminTeams();
  refreshTeamDropdowns();
}

function saveTeamsToFirebase(){
  if(window.db){
    window.db.ref('config/teams').set(TM);
  } else {
    localStorage.setItem('hxcs_teams',JSON.stringify(TM));
  }
}

function refreshTeamDropdowns(){
  if(typeof updateSPList==='function')updateSPList();
  if(typeof updateActSP==='function')updateActSP();
}

function adminRefreshAll(){
  if(!window.db){
    renderEditRecords();
    alert('🔄 Refreshed (local data)');
    return;
  }
  // Force re-fetch from Firebase
  Promise.all([
    window.db.ref('scores').once('value'),
    window.db.ref('activities').once('value')
  ]).then(([sSnap,aSnap])=>{
    const sData=sSnap.val()||{};
    const aData=aSnap.val()||{};
    allData={};
    Object.keys(sData).forEach(k=>{const v=sData[k];allData[k]=Array.isArray(v)?v:Object.values(v);});
    allActs={};
    Object.keys(aData).forEach(k=>{const v=aData[k];allActs[k]=Array.isArray(v)?v:Object.values(v);});
    renderAll();
    renderEditRecords();
    alert('🔄 Data refreshed from Firebase!');
  }).catch(err=>{
    alert('⚠️ Refresh failed: '+err.message);
  });
}

function exportAllData(){
  try{
    const allEntries=[];
    Object.entries(allData).forEach(([date,entries])=>{
      entries.forEach(e=>{
        allEntries.push({date,team:e.team,sp:e.sp,product:e.prod||'',units:e.units||0,price:e.price||0,revenue:e.revenue||0,saleType:(Array.isArray(e.saleType)?e.saleType.join('+'):e.saleType||''),notes:e.notes||''});
      });
    });
    Object.entries(allActs).forEach(([date,acts])=>{
      acts.forEach(a=>{
        allEntries.push({date,team:a.team,sp:a.sp,product:'CALLS/FUPS',units:0,price:0,revenue:0,saleType:`chats:${a.chats||0}|calls:${a.calls}|fups:${a.fups}`,notes:a.notes||''});
      });
    });

    if(!allEntries.length){showToast('No data to export','error');return;}

    const headers=['Date','Team','Salesperson','Product','Units','Price','Revenue','SaleType','Notes'];
    const csv=[headers.join(',')].concat(
      allEntries.map(r=>[r.date,r.team,r.sp,r.product,r.units,r.price,r.revenue,r.saleType,(r.notes||'').replace(/,/g,';')].map(v=>`"${v}"`).join(','))
    ).join('\n');

    // Show modal with CSV inside dashboard (no popup needed)
    let modal=document.getElementById('csvExportMo');
    if(!modal){
      modal=document.createElement('div');
      modal.id='csvExportMo';
      modal.className='mo';
      modal.style.display='none';
      modal.innerHTML='<div style="background:#161624;border:1px solid #252540;border-radius:18px;padding:22px;max-width:500px;width:93%;max-height:85vh;overflow-y:auto;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-family:Space Grotesk,sans-serif;font-size:18px;font-weight:800;color:white;">📥 CSV Export</div><span onclick="document.getElementById(\'csvExportMo\').style.display=\'none\'" style="cursor:pointer;color:#6060a0;font-size:20px;">✕</span></div><div id="csvRowCount" style="font-family:Space Mono,monospace;font-size:11px;color:#6060a0;margin-bottom:10px;"></div><div style="display:flex;gap:8px;margin-bottom:12px;"><button onclick="copyCsvToClipboard()" class="btn bg-gold" style="flex:1;height:40px;font-size:13px;">📋 Copy All</button><button onclick="downloadCsvFile()" class="btn" style="flex:1;height:40px;font-size:13px;background:#00e676;color:#000;">💾 Download File</button></div><textarea id="csvOutput" readonly style="width:100%;height:300px;background:#0e0e1a;color:#e8e8f8;border:1px solid #252540;border-radius:8px;padding:10px;font-family:Space Mono,monospace;font-size:10px;resize:none;"></textarea><div style="font-family:Space Mono,monospace;font-size:9px;color:#6060a0;margin-top:10px;text-align:center;">💡 Tip: Tap inside textarea → Select All → Copy → paste into Excel</div></div>';
      document.body.appendChild(modal);
    }
    document.getElementById('csvOutput').value=csv;
    document.getElementById('csvRowCount').textContent=allEntries.length+' rows ready to export';
    modal.style.display='flex';
    window._csvData=csv;
  } catch(e){
    showToast('❌ Export error: '+e.message,'error');
  }
}

function copyCsvToClipboard(){
  const ta=document.getElementById('csvOutput');
  ta.select();
  ta.setSelectionRange(0,99999);
  try{
    document.execCommand('copy');
    showToast('📋 CSV copied to clipboard!','success');
  } catch(e){
    if(navigator.clipboard){
      navigator.clipboard.writeText(window._csvData).then(()=>{
        showToast('📋 CSV copied to clipboard!','success');
      });
    }
  }
}

function downloadCsvFile(){
  try{
    const blob=new Blob([window._csvData],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='hurricane-data-'+dk(new Date())+'.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showToast('💾 Downloaded!','success');
  } catch(e){
    showToast('❌ Download failed. Use Copy instead.','error');
  }
}

async function resetTodayData(){
  const ok=await showConfirm('Reset Today','Reset TODAY\'s entries and activities? This cannot be undone.','Reset',true);
  if(!ok)return;
  const k=dk(new Date());

  // Clear local data immediately
  delete allData[k];
  delete allActs[k];

  if(window.db){
    Promise.all([
      window.db.ref('scores/'+k).remove(),
      window.db.ref('activities/'+k).remove(),
      window.db.ref('omset/'+k).remove()
    ]).then(()=>{
      renderAll();
      if(typeof renderEditRecords==='function')renderEditRecords();
      alert('✅ Today\'s data cleared from Firebase.');
    }).catch(err=>{
      console.error('Firebase delete error:',err);
      alert('⚠️ Firebase delete failed:\n\n'+err.message+'\n\nLikely cause: Firebase rules expired. Go to Firebase Console → Realtime Database → Rules → set both .read and .write to true → Publish.');
    });
  } else {
    try{localStorage.setItem('hxcs',JSON.stringify({s:allData,a:allActs}));}catch(e){}
    renderAll();
    if(typeof renderEditRecords==='function')renderEditRecords();
    alert('✅ Today\'s data cleared (local).');
  }
}

async function resetAllData(){
  const ok1=await showConfirm('⚠️ DELETE ALL DATA?','This will erase EVERY entry and activity from EVERY day. This cannot be undone!','Delete All',true);
  if(!ok1)return;
  const ok2=await showConfirm('Final Confirmation','Are you absolutely sure? This is your last chance to cancel.','Yes Delete Everything',true);
  if(!ok2)return;

  // Clear local immediately
  allData={};
  allActs={};

  if(window.db){
    Promise.all([
      window.db.ref('scores').remove(),
      window.db.ref('activities').remove(),
      window.db.ref('omset').remove()
    ]).then(()=>{
      renderAll();
      if(typeof renderEditRecords==='function')renderEditRecords();
      alert('🗑️ All data deleted from Firebase.');
    }).catch(err=>{
      console.error('Firebase delete error:',err);
      alert('⚠️ Firebase delete failed:\n\n'+err.message+'\n\nLikely cause: Firebase rules expired or blocked.\n\nFix:\n1. Go to console.firebase.google.com\n2. Realtime Database → Rules\n3. Set both .read and .write to true\n4. Publish');
    });
  } else {
    try{localStorage.setItem('hxcs',JSON.stringify({s:{},a:{}}));}catch(e){}
    renderAll();
    if(typeof renderEditRecords==='function')renderEditRecords();
    alert('🗑️ All data deleted (local).');
  }
}

function changePassword(){
  const current=document.getElementById('currentPwd').value;
  const newP=document.getElementById('newPwd').value;
  if(current!==getAdminPwd()){alert('❌ Current password is wrong');return;}
  if(newP.length<6){alert('New password must be at least 6 characters');return;}
  localStorage.setItem('hxcs_admin_pwd',newP);
  document.getElementById('currentPwd').value='';
  document.getElementById('newPwd').value='';
  alert('✅ Password updated! Default password '+DEFAULT_ADMIN_PWD+' will not work anymore.');
}

// Load admin config on page load (for everyone, applies settings)
function loadGlobalConfig(){
  if(window.db){
    window.db.ref('config').once('value',snap=>{
      const c=snap.val()||{};
      if(c.products&&typeof c.products==='object')Object.assign(P,c.products);

      // Safe team merge — only accept valid team structures
      if(c.teams&&typeof c.teams==='object'){
        Object.entries(c.teams).forEach(([teamName,teamData])=>{
          if(teamData&&typeof teamData==='object'&&Array.isArray(teamData.m)&&teamData.m.length>0){
            // Valid structure with members
            TM[teamName]={
              m:teamData.m.filter(x=>typeof x==='string'&&x.trim().length>0),
              c:teamData.c||'#888',
              bg:teamData.bg||'#161624',
              e:teamData.e||'⭐'
            };
          }
        });
      }

      // Restore any team that got wiped to default
      Object.keys(TM_DEFAULT).forEach(k=>{
        if(!TM[k]||!TM[k].m||TM[k].m.length===0){
          TM[k]=JSON.parse(JSON.stringify(TM_DEFAULT[k]));
        }
      });

      // Apply targets to global vars
      if(c.chatTarget){TC=c.chatTarget;window._cfgChatTarget=c.chatTarget;}
      if(c.revTarget){TR=c.revTarget;window._cfgRevTarget=c.revTarget;}
      if(c.chatTarget||c.revTarget){updateGoalCardText(TC,TR);}

      refreshProductDropdown();
      updateSPList();
      updateActSP();
      renderAll();
    });
  }
  setTimeout(()=>{
    updateSPList();
    updateActSP();
  },100);
}
