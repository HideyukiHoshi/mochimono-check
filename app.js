const STORAGE_KEY = 'mochimochi-mochimono-v15';
const APP_VERSION = 'v1.7.1';
const qrPrefix = 'MCM:';
const weekdayNames = ['日','月','火','水','木','金','土'];
const presetKinds = [
  {key:'pencilcase', label:'ふでばこ', className:'kind-bag', tone:'#f6dfd4', glyph:'ふ'},
  {key:'bottle', label:'すいとう', className:'kind-bottle', tone:'#d9efe8', glyph:'す'},
  {key:'notebook', label:'れんらくちょう', className:'kind-notebook', tone:'#fff1d7', glyph:'れ'},
  {key:'shoes', label:'うわばき', className:'kind-shoes', tone:'#e8e6ff', glyph:'う'},
  {key:'gym', label:'たいそうふく', className:'kind-bag', tone:'#ffe3ea', glyph:'体'},
  {key:'lunch', label:'きゅうしょくセット', className:'kind-bag', tone:'#fff0da', glyph:'給'},
  {key:'bag', label:'れんらくぶくろ', className:'kind-bag', tone:'#f8dfd8', glyph:'袋'},
  {key:'board', label:'したじき', className:'kind-notebook', tone:'#dff1eb', glyph:'し'},
  {key:'ipad', label:'iPad', className:'kind-ipad', tone:'#ebeff5', glyph:'i'},
  {key:'handkerchief', label:'ハンカチ', className:'kind-custom', tone:'#f9e4ef', glyph:'ハ'},
  {key:'tissue', label:'ティッシュ', className:'kind-custom', tone:'#eef0ff', glyph:'テ'},
  {key:'hat', label:'ぼうし', className:'kind-custom', tone:'#ffe8d4', glyph:'ぼ'},
  {key:'umbrella', label:'かさ', className:'kind-custom', tone:'#e2eef7', glyph:'か'},
  {key:'mask', label:'マスク', className:'kind-custom', tone:'#e9f1f3', glyph:'マ'},
  {key:'textbook', label:'きょうかしょ', className:'kind-notebook', tone:'#f6e7d6', glyph:'教'},
  {key:'print', label:'プリント', className:'kind-notebook', tone:'#fff1df', glyph:'プ'},
  {key:'art', label:'えのぐセット', className:'kind-bag', tone:'#e7dafa', glyph:'絵'},
  {key:'scissors', label:'はさみ', className:'kind-custom', tone:'#e1f1fa', glyph:'は'},
  {key:'coat', label:'うわぎ', className:'kind-bag', tone:'#e7e8f8', glyph:'上'},
  {key:'towel', label:'タオル', className:'kind-custom', tone:'#deefe2', glyph:'タ'},
  {key:'library', label:'としょバッグ', className:'kind-bag', tone:'#f3e2d2', glyph:'図'},
  {key:'badge', label:'なふだ', className:'kind-custom', tone:'#fff2d3', glyph:'名'},
  {key:'swim', label:'すいえいセット', className:'kind-bag', tone:'#d9edf6', glyph:'水'},
  {key:'key', label:'かぎ', className:'kind-custom', tone:'#f0e8d6', glyph:'か'},
  {key:'backpack', label:'ランドセル', className:'kind-bag', tone:'#f3d8d8', glyph:'ラ'},
  {key:'custom', label:'そのほか（文字キャラ）', className:'kind-custom', tone:'#f2e7dd', glyph:'文'}
];
const defaultPresets = [
  {name:'ふでばこ', kind:'pencilcase', days:[false,true,true,true,true,true,false]},
  {name:'すいとう', kind:'bottle', days:[false,true,true,true,true,true,false]},
  {name:'れんらくちょう', kind:'notebook', days:[false,true,true,true,true,true,false]},
  {name:'うわばき', kind:'shoes', days:[false,false,false,false,false,true,false]},
  {name:'iPad', kind:'ipad', days:[false,true,true,true,true,true,false]}
];

let state = loadState();
let currentView = 'homeView';
let calendarCursor = new Date();
let scan = {stream:null, raf:null, lastSeen:'', lastAt:0, noCode:0, lastFrame:0, requestId:0};
const scanCanvas = document.createElement('canvas');
const scanCtx = scanCanvas.getContext('2d',{willReadFrequently:true});
let roomSlotOrder = [];
let roomMoveCount = 0;
let pinFailures = 0;
let pinLockedUntil = 0;
let lastRenderedDay = ''; 
let friendMotionTimer = null;
let celebrateTimer = null;
let currentAdminPage = 'items';
let qrSelectedIds = new Set();
let qrSelectionInitialized = false;

const el = {};

document.addEventListener('DOMContentLoaded', init);

function init(){
  cacheEls();
  if(!state.items.length && !localStorage.getItem(STORAGE_KEY)) seedDefaultItems();
  bindEvents();
  fillKindSelects();
  ensureTodayHistory();
  registerSW();
  updateOnlineBadge();
  renderAll();
  lastRenderedDay = todayKey();
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.setInterval(refreshForNewDay, 60000);
  window.addEventListener('online', updateOnlineBadge);
  window.addEventListener('offline', updateOnlineBadge);
}

function cacheEls(){
  ['offlineBadge','dateLabel','friendsLayer','friendsMiniStatus','friendsMessage','progressGauge','gaugePercent','progressCount','progressFill','progressMessage','homeList','remainingText','cameraVideo','scanStatus','scanLog','calendarGrid','calendarTitle','calendarDetail','adminAuth','adminPanel','weekdayEditor','itemKindSelect','itemNameInput','adminItemsList','qrDialog','qrDialogTitle','qrCanvas','qrDialogText','celebratePopup','celebrateChar','celebrateTitle','celebrateBody'].forEach(id=>el[id]=document.getElementById(id));
}

function bindEvents(){
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  document.getElementById('startScanButton').addEventListener('click',()=>switchView('scannerView'));
  document.getElementById('stopScanButton').addEventListener('click',()=>switchView('homeView'));
  document.getElementById('switchCameraButton').addEventListener('click',restartScan);
  document.getElementById('prevMonthButton').addEventListener('click',()=>{calendarCursor.setDate(1);calendarCursor.setMonth(calendarCursor.getMonth()-1);state.selectedDate=todayKey(calendarCursor);renderCalendar();});
  document.getElementById('nextMonthButton').addEventListener('click',()=>{calendarCursor.setDate(1);calendarCursor.setMonth(calendarCursor.getMonth()+1);state.selectedDate=todayKey(calendarCursor);renderCalendar();});
  document.getElementById('settingsButton').addEventListener('click',()=>switchView('adminView'));
  document.getElementById('lockAdminButton').addEventListener('click',lockAdmin);
  document.getElementById('addItemForm').addEventListener('submit',onAddItem);
  document.getElementById('exportButton').addEventListener('click',exportBackup);
  document.getElementById('importInput').addEventListener('change',importBackup);
  document.getElementById('printQrButton').addEventListener('click',printCurrentQr);
  document.querySelectorAll('[data-admin-target]').forEach(btn => btn.addEventListener('click',()=>switchAdminPage(btn.dataset.adminTarget)));
  document.getElementById('selectAllQrButton').addEventListener('click',()=>setQrSelection(state.items.map(i=>i.id)));
  document.getElementById('selectTodayQrButton').addEventListener('click',()=>setQrSelection(requiredItems().map(i=>i.id)));
  document.getElementById('clearQrButton').addEventListener('click',()=>setQrSelection([]));
  document.getElementById('previewBulkQrButton').addEventListener('click',showBulkPrintPreview);
  document.getElementById('closeBulkPrintButton').addEventListener('click',closeBulkPrintPreview);
  document.getElementById('runBulkPrintButton').addEventListener('click',()=>{if(typeof window.print==='function')window.print();else alert('Safariの共有メニューから「プリント」を選んでね。');});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape' && !document.getElementById('bulkPrintOverlay').hidden)closeBulkPrintPreview();});
  const dateControl=document.getElementById('overrideDate');
  if(dateControl){dateControl.value=todayKey();dateControl.addEventListener('change',renderOverrideEditor);}
  document.getElementById('saveOverrideButton')?.addEventListener('click',saveOverrideDate);
}

function seedDefaultItems(){
  state.items = defaultPresets.map(p=>makeItem(p.name,p.kind,p.days));
  saveState();
}

function makeItem(name, kind, days){
  return {id:uid(), name, kind, days:days||[false,true,true,true,true,true,false], qrId:uid(), createdAt:Date.now()};
}

// v1.5.1: import previous versions without changing the IDs printed on QR stickers.
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return normalizeState(JSON.parse(raw));
    const legacy = localStorage.getItem('mochimono-check-v1');
    if(legacy){
      const parsed = JSON.parse(legacy);
      if(parsed && Array.isArray(parsed.items)) return migrateV14(parsed);
    }
  }catch(e){ console.warn('Could not read previous data:',e); }
  return normalizeState({items:[], daily:{}, history:{}, admin:{pin:'', unlocked:false}});
}
function migrateV14(old){
  const legacyKinds = {pencil:'pencilcase',bottle:'bottle',book:'notebook',shoe:'shoes',bag:'bag',cloth:'handkerchief',gym:'gym',lunch:'lunch',folder:'bag',mat:'board',tablet:'ipad',tissue:'tissue',umbrella:'umbrella',cap:'hat',letter:'custom'};
  const items = old.items.map(i=>({
    id:i.id, qrId:i.id, qrPrefix:'MCHK:', name:i.name,
    kind:legacyKinds[i.type] || 'custom',
    days:Array.from({length:7},(_,d)=>(i.weekdays||[1,2,3,4,5]).includes(d)),
    createdAt:i.addedOn ? new Date(i.addedOn+'T12:00:00').getTime() : Date.now()
  }));
  const data = {items,daily:{},history:{},admin:{pin:'',unlocked:false},scheduleOverrides:{}};
  try{ data.scheduleOverrides = JSON.parse(localStorage.getItem('mochimono-schedule-v1') || '{}') || {}; }catch(e){}
  try{
    const hist=JSON.parse(localStorage.getItem('mochimono-history-v1') || '{}') || {};
    for(const [date,day] of Object.entries(hist)){
      if(!day || !Array.isArray(day.expected)) continue;
      const checked=new Set(day.checked || []), scanned=new Set(day.scanned || []);
      const converted=day.expected.map(entry=>({
        id:entry.id,name:entry.name,kind:items.find(it=>it.id===entry.id)?.kind || 'custom',
        status:scanned.has(entry.id)?'qr':checked.has(entry.id)?'manual':'missing'
      }));
      data.history[date]={date,items:converted,rest:!!day.rest,updatedAt:Date.now()};
      data.daily[date]=Object.fromEntries(converted.map(x=>[x.id,x.status]));
    }
  }catch(e){ console.warn('History migration skipped:',e); }
  const today=todayKey();
  for(const oldItem of old.items){
    if(oldItem.checkedOn===today && !data.daily[today]?.[oldItem.id]){
      if(!data.daily[today]) data.daily[today]={};
      data.daily[today][oldItem.id]='manual';
    }
  }
  try{
    const pin=JSON.parse(localStorage.getItem('mochimono-parent-pin-v1')||'null');
    if(pin && /^[a-f0-9]{32}$/.test(pin.salt) && /^[a-f0-9]{64}$/.test(pin.hash)){
      data.admin.legacySalt=pin.salt;data.admin.legacyHash=pin.hash;
    }
  }catch(e){}
  return normalizeState(data);
}
function normalizeState(s){
  return {
    items:(Array.isArray(s.items)?s.items:[]).map(i=>({
      ...i,
      qrId:i.qrId || i.id || uid(),
      qrPrefix:i.qrPrefix || (i.weekdays ? 'MCHK:' : qrPrefix),
      kind:i.kind || 'custom',
      days:Array.isArray(i.days) && i.days.length===7 ? i.days : Array.from({length:7},(_,d)=>Array.isArray(i.weekdays)?i.weekdays.includes(d):d>=1&&d<=5)
    })),
    daily:s.daily||{},
    history:s.history||{},
    scheduleOverrides:s.scheduleOverrides||{},
    admin:{pin:(s.admin&&s.admin.pin)||'',legacySalt:s.admin?.legacySalt||'',legacyHash:s.admin?.legacyHash||'',unlocked:false},
    lastQrValue:s.lastQrValue||'',
    currentQrItemId:s.currentQrItemId||'',
    selectedDate:s.selectedDate || todayKey()
  };
}

function saveState(){
  const snapshot = JSON.parse(JSON.stringify(state));
  if(snapshot.admin) snapshot.admin.unlocked = false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js?v=171',{updateViaCache:'none'})
      .then(reg=>{reg.update().catch(()=>{});})
      .catch(err=>console.warn('オフライン準備:',err));
  }
}
function onVisibilityChange(){
  if(document.hidden){
    if(friendMotionTimer){clearInterval(friendMotionTimer); friendMotionTimer=null;}
    if(currentView==='scannerView')stopScan();
    return;
  }
  refreshForNewDay();
  if(currentView==='scannerView')startScan(); else if(currentView==='homeView')startFriendMotion();
}
function refreshForNewDay(){
  if(todayKey()!==lastRenderedDay){
    lastRenderedDay = todayKey();
    ensureTodayHistory();
    calendarCursor = new Date();
    renderAll();
  }
}


function updateOnlineBadge(){
  const ready = navigator.onLine ? 'オンライン' : 'オフライン';
  el.offlineBadge.textContent = ready;
}

function switchView(viewId){
  closeBulkPrintPreview();
  currentView = viewId;
  document.querySelectorAll('.view').forEach(v=>v.hidden = v.id !== viewId);
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('is-active', b.dataset.view === viewId));
  if(viewId === 'scannerView') startScan(); else stopScan();
  if(viewId!=='homeView' && friendMotionTimer){clearInterval(friendMotionTimer);friendMotionTimer=null;}
  if(viewId === 'calendarView') renderCalendar();
  if(viewId === 'adminView') renderAdmin(); else { if(state.admin) state.admin.unlocked = false; renderAdmin(); }
}

function todayKey(date = new Date()){
  const y = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,'0'); const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function formatJPDate(key){ const d = new Date(key+'T00:00:00'); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${weekdayNames[d.getDay()]}）`; }
function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function getKindDef(kind){ return presetKinds.find(k=>k.key===kind) || presetKinds[presetKinds.length-1]; }
function itemGlyph(item){ return item.kind==='custom' ? (Array.from((item.name||'').trim())[0]||'?') : (getKindDef(item.kind).glyph || '?'); }
function itemColor(item){ return getKindDef(item.kind).tone || '#f2e7dd'; }
function isSchoolday(dateKey){ const d = new Date(dateKey+'T00:00:00'); const day = d.getDay(); return day !== 0 && day !== 6; }
function currentDayStatuses(dateKey = todayKey()){ if(!state.daily[dateKey]) state.daily[dateKey] = {}; return state.daily[dateKey]; }
function statusFor(itemId, dateKey = todayKey()){ return state.daily[dateKey]?.[itemId] || 'missing'; }
function setStatus(itemId, status, dateKey = todayKey()){
  currentDayStatuses(dateKey)[itemId] = status;
  syncHistory(dateKey);
  saveState();
  renderAll();
}
function requiredItems(dateKey = todayKey()){
  if(state.history?.[dateKey]?.rest)return [];
  const d = new Date(dateKey+'T00:00:00'); const w = d.getDay();
  return state.items.filter(item => {
    const overridden=state.scheduleOverrides?.[dateKey]?.[item.id];
    return typeof overridden==='boolean' ? overridden : (item.days && item.days[w]) !== false;
  });
}
function checkedCount(dateKey = todayKey()){
  const req = requiredItems(dateKey);
  let done = 0; req.forEach(item=>{ const st = statusFor(item.id,dateKey); if(st === 'qr' || st === 'manual' || st === 'notneeded') done++; });
  return {done,total:req.length};
}
function syncHistory(dateKey = todayKey()){
  const req = requiredItems(dateKey);
  const old = state.history[dateKey] || {};
  state.history[dateKey] = {
    date: dateKey,
    items: req.map(item=>({id:item.id,name:item.name,kind:item.kind,status:statusFor(item.id,dateKey)})),
    rest:!!old.rest,
    updatedAt: Date.now()
  };
}
function ensureTodayHistory(){ syncHistory(todayKey()); saveState(); }

function renderAll(){
  el.dateLabel.textContent = formatJPDate(todayKey());
  renderProgress();
  renderHomeList();
  renderFriends();
  renderCalendar();
  renderAdmin();
  updateVersionBadge();
}

function updateVersionBadge(){
  document.querySelectorAll('[data-app-version]').forEach(el=>el.textContent=`Version ${APP_VERSION}`);
}

function renderProgress(){
  const {done,total} = checkedCount();
  const pct = total ? Math.round(done/total*100) : 0;
  el.progressCount.textContent = `${done} / ${total}`;
  el.gaugePercent.textContent = `${pct}%`;
  el.progressFill.style.width = `${pct}%`;
  el.progressGauge.style.setProperty('--angle', `${pct*3.6}deg`);
  el.progressGauge.setAttribute('aria-valuenow', String(pct));
  const rem = Math.max(total-done,0);
  el.remainingText.textContent = total ? `あと ${rem} こ` : '登録なし';
  el.progressMessage.textContent = total ? (rem===0 ? 'きょうの持ち物は ばっちり！' : `${rem}こ 見つけると みんながよろこぶよ`) : 'きょうはチェックするものがないよ';
}

function buildFriendMarkup(item, extra=''){
  const kind = getKindDef(item.kind);
  const isCustom = item.kind === 'custom';
  return `<div class="friend ${kind.className} ${isCustom?'custom-letter':''} ${extra}" data-item-id="${item.id}" style="--tone:${itemColor(item)}"><div class="blob"></div><div class="tone"></div>${isCustom?`<div class="letter">${escapeHtml(itemGlyph(item))}</div>`:''}<div class="face"><div class="cheeks"></div><div class="mouth"></div></div><div class="arms"></div><div class="legs"></div><div class="label">${escapeHtml(shorten(item.name,8))}</div></div>`;
}

function renderHomeList(){
  const items = requiredItems();
  if(!items.length){ el.homeList.innerHTML = '<div class="soft-card">きょう必要な持ち物はありません。</div>'; return; }
  el.homeList.innerHTML = items.map(item=>{
    const st = statusFor(item.id);
    const statusLabel = st==='qr' ? 'QRでチェック済み' : st==='manual' ? '手動でチェック済み' : st==='notneeded' ? '今日はもって帰らなくてOK' : 'まだ確認していない';
    const statusClass = st==='qr'?'status-qr':st==='manual'?'status-manual':st==='notneeded'?'status-notneeded':'status-missing';
    const toggleLabel = (st==='qr' || st==='manual') ? 'チェックを戻す' : '手でチェックする';
    const noNeedLabel = st==='notneeded' ? '設定をもどす' : '今日はもって帰らなくてOK';
    return `<div class="item-card">
      <div class="item-top">
        <div class="item-main"><div class="item-avatar">${buildFriendMarkup(item,'small happy').replace('class="friend','class="mini-friend friend')}</div><div><div class="item-name">${escapeHtml(item.name)}</div><div class="item-sub">${weekdaySummary(item.days)}</div></div></div>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
      </div>
      <div class="item-actions">
        <button type="button" class="pill-button ${st==='manual' || st==='qr' ? 'active':''}" data-action="toggle-manual" data-id="${item.id}">${toggleLabel}</button>
        <button type="button" class="pill-button ${st==='notneeded' ? 'active':''}" data-action="toggle-noneed" data-id="${item.id}">${noNeedLabel}</button>
      </div>
    </div>`;
  }).join('');
  el.homeList.querySelectorAll('[data-action="toggle-manual"]').forEach(btn=>btn.addEventListener('click',()=>toggleManual(btn.dataset.id)));
  el.homeList.querySelectorAll('[data-action="toggle-noneed"]').forEach(btn=>btn.addEventListener('click',()=>toggleNoNeed(btn.dataset.id)));
}

function toggleManual(id){
  const st = statusFor(id);
  setStatus(id, (st==='manual' || st==='qr') ? 'missing' : 'manual');
}
function toggleNoNeed(id){
  const st = statusFor(id);
  setStatus(id, st==='notneeded' ? 'missing' : 'notneeded');
}

function activityScore(item){
  // An actual seven-school-day moving window. Unused days after registration
  // count gradually; weekends/holidays and "not needed" days do not.
  const today=new Date();
  const historyDates=Object.entries(state.history).filter(([,h])=>h.items?.some(i=>i.id===item.id)).map(([day])=>day).sort();
  const registered=Number.isFinite(item.createdAt) ? todayKey(new Date(item.createdAt)) : todayKey();
  const started=historyDates.length ? [registered,historyDates[0]].sort()[0] : registered;
  let sum=0,weight=0,eligible=0;
  for(let offset=0;offset<32 && eligible<7;offset++){
    const date=new Date(today.getFullYear(),today.getMonth(),today.getDate()-offset);
    const key=todayKey(date);
    if(key<started)break;
    if(state.history[key]?.rest)continue;
    const weekday=date.getDay();
    const dayRecord=state.history[key];
    const wasExpected=dayRecord?.items?.some(i=>i.id===item.id);
    const override=state.scheduleOverrides?.[key]?.[item.id];
    const scheduled=typeof override==='boolean' ? override : !!item.days?.[weekday];
    if(!scheduled && !wasExpected)continue;
    eligible++;
    const record=dayRecord?.items?.find(i=>i.id===item.id);
    const status=record?.status || state.daily[key]?.[item.id] || 'missing';
    if(status==='notneeded')continue;
    if(status==='qr'){sum+=1;weight++;}
    else if(status==='manual'){sum+=.8;weight++;}
    else if(key!==todayKey()){weight++;}
  }
  // Prior equivalent to 3 neutral days keeps a single missed day gentle.
  return Math.max(.12,Math.min(1,(sum+3*.55)/(weight+3)));
}

function roomMessageFromAvg(avg){
  if(avg >= .78) return ['みんなが もちもちっと元気！','にこにこしながら近くまで来ているよ'];
  if(avg >= .55) return ['みんな ごきげん','おへやの中を たくさん歩き回っているよ'];
  if(avg >= .32) return ['のんびり しているよ','見つけてもらえると もっと元気になるよ'];
  return ['ちょっぴり さみしそう','見つけてもらえるのを待っているよ'];
}

function renderFriends(){
  const source=state.items;
  if(!source.length){ el.friendsLayer.innerHTML=''; return; }
  const scores=source.map(activityScore);
  const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
  const [mini,msg]=roomMessageFromAvg(avg);
  el.friendsMiniStatus.textContent=mini;
  el.friendsMessage.textContent=msg;
  el.friendsLayer.innerHTML=source.map(item=>{
    const a=activityScore(item);
    return buildFriendMarkup(item,moodClass(a));
  }).join('');
  roomSlotOrder=[];
  roomMoveCount=0;
  startFriendMotion();
}
function moodClass(a){
  return a<.28?'back small':a<.5?'side':a<.75?'happy':'happy big';
}
function startFriendMotion(){
  if(friendMotionTimer)clearInterval(friendMotionTimer);
  if(currentView!=='homeView' || document.hidden)return;
  moveFriendsOnce();
  friendMotionTimer=setInterval(moveFriendsOnce,2900);
}
function moveFriendsOnce(){
  const friends=Array.from(el.friendsLayer.querySelectorAll('.friend'));
  const n=friends.length;
  if(!n)return;
  const room=el.friendsLayer.parentElement;
  const W=room.clientWidth||320;
  // Keep all character artwork at its original 76px coordinate system and
  // scale just the *room* characters. Avatars and celebration remain readable.
  const baseSize=76, sprite=60;
  const colGap=24, rowGap=26;
  const sideMargin=13, topMargin=28, bottomMargin=24;
  const cols=Math.min(n,Math.max(1,Math.floor((W-2*sideMargin+colGap)/(sprite+colGap))));
  const rows=Math.ceil(n/cols);
  const desiredH=Math.max(300,topMargin+rows*sprite+(rows-1)*rowGap+bottomMargin);
  if(room.style.height!==desiredH+'px')room.style.height=desiredH+'px';
  const H=room.clientHeight||desiredH;
  const leftPad=Math.max(sideMargin,(W-(cols*sprite+(cols-1)*colGap))/2);
  const usedRowsH=rows*sprite+(rows-1)*rowGap;
  const topPad=Math.max(topMargin,(H-usedRowsH)/2);
  const slots=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    if(slots.length<n)slots.push({x:leftPad+col*(sprite+colGap),y:topPad+row*(sprite+rowGap)});
  }
  if(roomSlotOrder.length!==n)roomSlotOrder=Array.from({length:n},(_,i)=>i);
  roomMoveCount++;
  const byId=new Map(state.items.map(item=>[String(item.id),item]));
  const average=friends.reduce((sum,f)=>{
    const item=byId.get(f.dataset.itemId);
    return sum+(item?activityScore(item):.5);
  },0)/n;
  if(average>.5 && roomMoveCount%3===0 && n>1){
    const a=Math.floor(rand(0,n)),b=(a+1+Math.floor(rand(0,n-1)))%n;
    [roomSlotOrder[a],roomSlotOrder[b]]=[roomSlotOrder[b],roomSlotOrder[a]];
  }
  friends.forEach((friendEl,i)=>{
    const item=byId.get(friendEl.dataset.itemId);
    if(!item)return;
    const energy=activityScore(item),slot=slots[roomSlotOrder[i]];
    // The slot is 60px across; max visible width is approx 60px.
    const scale=energy<.28?.67:energy<.75?.74:.79;
    const visibleSize=baseSize*scale;
    const movement=energy<.3?2:energy<.6?6:10;
    const x=Math.min(W-visibleSize-7,Math.max(7,slot.x+rand(-movement,movement)));
    const y=Math.min(H-visibleSize-7,Math.max(7,slot.y+rand(-movement,movement)));
    friendEl.style.left=`${x}px`;
    friendEl.style.top=`${y}px`;
    friendEl.style.setProperty('--room-character-scale',scale.toFixed(3));
    friendEl.style.transitionDuration=energy<.3?'2.9s':energy<.6?'2.5s':'2.1s';
    friendEl.classList.toggle('back',energy<.28);
    friendEl.classList.toggle('side',energy>=.28&&energy<.5);
    friendEl.classList.toggle('happy',energy>=.5);
    friendEl.classList.toggle('small',energy<.28);
    friendEl.classList.toggle('big',energy>=.75);
  });
}

async function startScan(){
  const id=++scan.requestId;
  stopScan(false);
  el.scanStatus.textContent='カメラを起動しています…';
  if(!navigator.mediaDevices?.getUserMedia){
    el.scanStatus.textContent='この環境ではカメラを起動できないよ。HTTPSで開いてね。';
    return;
  }
  if(typeof window.jsQR!=='function'){
    el.scanStatus.textContent='QR読み取りの準備ができていないよ。オンラインで一度開き直してね。';
    return;
  }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(id!==scan.requestId || currentView!=='scannerView'){
      stream.getTracks().forEach(t=>t.stop()); return;
    }
    scan.stream=stream;
    el.cameraVideo.srcObject=stream;
    await el.cameraVideo.play();
    if(id!==scan.requestId)return;
    el.scanStatus.textContent='QRコードを枠の中に入れてね。';
    scan.raf=requestAnimationFrame(scanLoop);
  }catch(err){
    el.scanStatus.textContent='カメラを使えなかったよ。Safariのカメラ許可を確認してね。';
    console.warn('Camera:',err);
  }
}
function stopScan(invalidate=true){
  if(invalidate)scan.requestId++;
  if(scan.raf)cancelAnimationFrame(scan.raf);
  scan.raf=null;
  const stream=scan.stream;
  scan.stream=null;
  if(stream)stream.getTracks().forEach(t=>t.stop());
  if(el.cameraVideo){el.cameraVideo.pause();el.cameraVideo.srcObject=null;}
  scan.lastSeen='';scan.noCode=0;
}
function restartScan(){if(currentView==='scannerView')startScan();}
function scanLoop(timestamp){
  if(!scan.stream || currentView!=='scannerView')return;
  scan.raf=requestAnimationFrame(scanLoop);
  if(timestamp-scan.lastFrame<180)return; // 5-6 fps is plenty on iPhone 8.
  scan.lastFrame=timestamp;
  const video=el.cameraVideo;
  if(video.readyState<2 || !video.videoWidth)return;
  const w=Math.min(480,video.videoWidth), h=Math.max(1,Math.round(w*video.videoHeight/video.videoWidth));
  if(scanCanvas.width!==w||scanCanvas.height!==h){scanCanvas.width=w;scanCanvas.height=h;}
  try{
    scanCtx.drawImage(video,0,0,w,h);
    const img=scanCtx.getImageData(0,0,w,h);
    const code=window.jsQR(img.data,w,h,{inversionAttempts:'dontInvert'});
    const text=code?.data?.trim()||'';
    if(!text){
      if(++scan.noCode>=3)scan.lastSeen='';
      return;
    }
    scan.noCode=0;
    if(text===scan.lastSeen)return;
    scan.lastSeen=text;
    scan.lastAt=Date.now();
    onScanValue(text);
  }catch(err){console.warn('QR decode:',err);}
}

function onScanValue(val){
  const item = state.items.find(it => `${it.qrPrefix || qrPrefix}${it.qrId}` === val);
  if(item){
    if(statusFor(item.id)==='qr'){prependLog(`「${item.name}」はチェック済みだよ。`);return;}
    setStatus(item.id,'qr');
    prependLog(`「${item.name}」を見つけたよ！`);
    showCelebrate(item);
  }else prependLog('登録されていないQRだったよ。');
}
function prependLog(text){
  const div = document.createElement('div'); div.className = 'scan-log-item'; div.textContent = `${timeNow()}  ${text}`;
  el.scanLog.prepend(div); while(el.scanLog.children.length > 6) el.scanLog.lastElementChild.remove();
}
function timeNow(){ const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

function showCelebrate(item){
  clearTimeout(celebrateTimer);
  el.celebrateChar.innerHTML = buildFriendMarkup(item,'happy big mochi');
  el.celebrateTitle.textContent = `${item.name} を みつけたよ！`;
  el.celebrateBody.innerHTML = `<span class="mochi-burst">みつけてもらえて うれしい！ もちもち〜！</span>`;
  el.celebratePopup.hidden = false;
  el.celebratePopup.setAttribute('role','status');
  const roomFriend = el.friendsLayer.querySelector(`[data-item-id="${item.id}"]`);
  if(roomFriend){ roomFriend.classList.add('jump','mochi','happy','big'); setTimeout(()=>roomFriend.classList.remove('jump','mochi'),1400); }
  celebrateTimer = setTimeout(()=>{ el.celebratePopup.hidden = true; }, 2600);
}

function renderCalendar(){
  const y = calendarCursor.getFullYear(), m = calendarCursor.getMonth();
  el.calendarTitle.textContent = `${y}年${m+1}月`;
  const first = new Date(y,m,1), startDay = first.getDay(), last = new Date(y,m+1,0).getDate();
  const selectedKey = state.selectedDate || todayKey();
  const cells = [];
  for(let i=0;i<startDay;i++) cells.push('<button class="day-cell empty" type="button" disabled></button>');
  for(let day=1; day<=last; day++){
    const d = new Date(y,m,day); const key = todayKey(d);
    const dayRecord=state.history[key];
    const counts=dayRecord ? {total:dayRecord.items.length,done:dayRecord.items.filter(x=>['qr','manual','notneeded'].includes(x.status)).length} : {done:0,total:0};
    const pct = counts.total ? counts.done / counts.total : 0;
    let chip = state.history[key]?.rest ? '休' : counts.total ? `${counts.done}/${counts.total}` : '—';
    let chipClass = pct===1 ? 'good' : pct>0 ? 'some' : '';
    const flags = ['day-cell', key===todayKey()?'today':'', key===selectedKey?'selected':''].join(' ');
    cells.push(`<button type="button" class="${flags}" data-date="${key}"><strong>${day}</strong><small>${weekdayNames[d.getDay()]}</small><span class="day-chip ${chipClass}">${chip}</span></button>`);
  }
  el.calendarGrid.innerHTML = cells.join('');
  el.calendarGrid.querySelectorAll('[data-date]').forEach(btn=>btn.addEventListener('click',()=>{ state.selectedDate = btn.dataset.date; saveState(); renderCalendar(); }));
  renderCalendarDetail(selectedKey);
}

function renderCalendarDetail(dateKey){
  const hist = state.history[dateKey];
  if(!hist){el.calendarDetail.innerHTML=`<h2>${formatJPDate(dateKey)}</h2><p class="micro-note">この日の記録はまだないよ。</p>`;return;}
  if(hist.rest){el.calendarDetail.innerHTML=`<h2>${formatJPDate(dateKey)}</h2><p class="micro-note">おやすみの日だよ。</p>`;return;}
  const groups = {ok:[], noneed:[], missing:[]};
  hist.items.forEach(it=>{ if(it.status==='qr' || it.status==='manual') groups.ok.push(it.name); else if(it.status==='notneeded') groups.noneed.push(it.name); else groups.missing.push(it.name); });
  el.calendarDetail.innerHTML = `<div class="section-title"><h1 style="font-size:20px;margin:0">${formatJPDate(dateKey)}</h1><p>その日の確認状況</p></div>
  <div class="detail-cols">
    <div class="detail-block"><h3>あったもの</h3><div class="detail-list">${(groups.ok.length?groups.ok:['なし']).map(x=>`<span class="detail-tag">${escapeHtml(x)}</span>`).join('')}</div></div>
    <div class="detail-block"><h3>もって帰らなくてよかったもの</h3><div class="detail-list">${(groups.noneed.length?groups.noneed:['なし']).map(x=>`<span class="detail-tag">${escapeHtml(x)}</span>`).join('')}</div></div>
    <div class="detail-block"><h3>まだ確認できていないもの</h3><div class="detail-list">${(groups.missing.length?groups.missing:['なし']).map(x=>`<span class="detail-tag">${escapeHtml(x)}</span>`).join('')}</div></div>
  </div>`;
}

function fillKindSelects(){
  el.itemKindSelect.innerHTML = presetKinds.map(k=>`<option value="${k.key}">${k.label}</option>`).join('');
  renderWeekdayEditor();
}
function renderWeekdayEditor(values=[false,true,true,true,true,true,false], container=el.weekdayEditor, prefix='new'){
  container.innerHTML = weekdayNames.map((name,idx)=>`<button type="button" class="weekday-toggle ${values[idx]?'on':''}" data-prefix="${prefix}" data-index="${idx}">${name}</button>`).join('');
  container.querySelectorAll('.weekday-toggle').forEach(btn=>btn.addEventListener('click',()=>btn.classList.toggle('on')));
}
function readWeekdays(container=el.weekdayEditor){ return Array.from(container.querySelectorAll('.weekday-toggle')).map(btn=>btn.classList.contains('on')); }
function weekdaySummary(days){ const arr = weekdayNames.filter((_,i)=>days[i]); return arr.length ? arr.join('・') : '必要日なし'; }

function renderAdmin(){
  if(currentView !== 'adminView') return;
  el.adminAuth.hidden=false;
  const pinSet = !!(state.admin.pin || state.admin.legacyHash);
  if(!pinSet){
    el.adminAuth.innerHTML = `<div><strong>保護者用PINを作る</strong><p class="micro-note">4〜8桁の数字で、管理画面に入るためのPINを決めてね。</p></div><div class="pin-row"><input id="setPinInput" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"></div><div class="pin-row"><input id="confirmPinInput" type="password" inputmode="numeric" maxlength="8" placeholder="もう一度PIN"><button type="button" class="primary-button" id="setPinButton">設定する</button></div>`;
    el.adminPanel.hidden = true;
    document.getElementById('setPinButton').onclick = async ()=>{
      const pin=document.getElementById('setPinInput').value.trim();
      const confirmPin=document.getElementById('confirmPinInput').value.trim();
      if(!/^\d{4,8}$/.test(pin))return alert('4〜8桁の数字にしてね');
      if(pin!==confirmPin)return alert('確認のPINが一致しないよ');
      const hash=await securePin(pin);
      state.admin.pin=hash;
      state.admin.unlocked=true;
      saveState();renderAdmin();
    };
    return;
  }
  if(!state.admin.unlocked){
    el.adminAuth.innerHTML = `<div><strong>保護者PINを入力</strong><p class="micro-note">もちもの一覧の追加・削除・曜日設定をするときに使うよ。</p></div><div class="pin-row"><input id="enterPinInput" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"><button type="button" class="primary-button" id="enterPinButton">入る</button></div>`;
    el.adminPanel.hidden = true;
    document.getElementById('enterPinButton').onclick = async ()=>{
      const pin = document.getElementById('enterPinInput').value.trim();
      if(Date.now()<pinLockedUntil){alert('少し時間をおいてから試してね');return;}
      let ok=state.admin.pin ? await verifyPin(pin,state.admin.pin) : false;
      if(!ok && state.admin.legacyHash) ok = await verifyLegacyPin(pin, state.admin.legacySalt, state.admin.legacyHash);
      if(!ok){
        pinFailures++;if(pinFailures>=5){pinLockedUntil=Date.now()+30000;pinFailures=0;}
        alert('PINがちがうようです'); return;
      }
      pinFailures=0;
      if(!String(state.admin.pin).startsWith('pbkdf2:')){
        state.admin.pin=await securePin(pin);
        delete state.admin.legacyHash; delete state.admin.legacySalt;
        saveState();
      }
      state.admin.unlocked = true; renderAdmin();
    };
    return;
  }
  el.adminAuth.innerHTML = '';
  el.adminAuth.hidden = true;
  el.adminPanel.hidden = false;
  showAdminPage();
  renderAdminItems();
  renderOverrideEditor();
  renderQrManageList();
}
function lockAdmin(){ closeBulkPrintPreview(); state.admin.unlocked = false; renderAdmin(); }
function simpleHash(s){ return btoa('pin:'+s); } // Legacy v1.5 compatibility only.
async function securePin(pin){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256));
  return 'pbkdf2:'+toHex(salt)+':'+toHex(bits);
}
function toHex(a){return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}
async function verifyPin(pin,stored){
  if(!stored.startsWith('pbkdf2:'))return simpleHash(pin)===stored;
  const parts=stored.split(':');
  if(parts.length!==3)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const salt=Uint8Array.from(parts[1].match(/.{2}/g)||[],x=>parseInt(x,16));
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256));
  return toHex(bits)===parts[2];
}
async function verifyLegacyPin(pin,salt,expected){
  try{
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
    const bytes=Uint8Array.from(salt.match(/.{2}/g),x=>parseInt(x,16));
    const hash=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:120000,hash:'SHA-256'},key,256));
    const actual=Array.from(hash,x=>x.toString(16).padStart(2,'0')).join('');
    return actual===expected;
  }catch(e){ return false; }
}

function onAddItem(ev){
  ev.preventDefault();
  if(!state.admin.unlocked) return;
  const name = el.itemNameInput.value.trim();
  if(!name) return;
  const kind = el.itemKindSelect.value;
  const days = readWeekdays();
  state.items.push(makeItem(name, kind, days));
  el.itemNameInput.value = '';
  saveState(); ensureTodayHistory(); renderAll();
}

function renderAdminItems(){
  if(!state.items.length){ el.adminItemsList.innerHTML = '<div class="micro-note">登録した持ち物はまだありません。</div>'; return; }
  el.adminItemsList.innerHTML = state.items.map(item=>`<div class="admin-item" data-admin-id="${item.id}"><div class="admin-item-head"><div><div class="admin-item-name">${escapeHtml(item.name)}</div><div class="admin-item-kind">${escapeHtml(getKindDef(item.kind).label)}</div></div></div><div class="admin-item-actions"><select class="small-input kind-select" data-id="${item.id}">${presetKinds.map(k=>`<option value="${k.key}" ${k.key===item.kind?'selected':''}>${k.label}</option>`).join('')}</select><input class="small-input name-input" data-id="${item.id}" value="${escapeHtml(item.name)}"></div><div class="weekday-mini" id="days-${item.id}"></div><div class="admin-item-actions"><button type="button" class="secondary-button" data-action="save" data-id="${item.id}">変更を保存</button><button type="button" class="secondary-button" data-action="delete" data-id="${item.id}">削除</button></div></div>`).join('');
  state.items.forEach(item=>renderWeekdayEditor(item.days, document.getElementById(`days-${item.id}`), item.id));
  el.adminItemsList.querySelectorAll('[data-action="qr"]').forEach(btn=>btn.addEventListener('click',()=>showQrFor(btn.dataset.id)));
  el.adminItemsList.querySelectorAll('[data-action="save"]').forEach(btn=>btn.addEventListener('click',()=>saveAdminItem(btn.dataset.id)));
  el.adminItemsList.querySelectorAll('[data-action="delete"]').forEach(btn=>btn.addEventListener('click',()=>deleteAdminItem(btn.dataset.id)));
}
function renderOverrideEditor(){
  const date=document.getElementById('overrideDate')?.value||todayKey();
  const container=document.getElementById('overrideItems');
  if(!container)return;
  const wd=new Date(date+'T00:00:00').getDay();
  document.getElementById('restDayInput').checked=!!state.history[date]?.rest;
  container.innerHTML=state.items.map(item=>{
    const base=!!item.days?.[wd];
    const override=state.scheduleOverrides?.[date]?.[item.id];
    const needed=typeof override==='boolean'?override:base;
    return `<label class="override-item"><span>${escapeHtml(item.name)}</span><input type="checkbox" data-id="${escapeHtml(item.id)}" ${needed?'checked':''}></label>`;
  }).join('');
}
function saveOverrideDate(){
  if(!state.admin.unlocked)return;
  const date=document.getElementById('overrideDate')?.value;
  if(!/^\d{4}-\d\d-\d\d$/.test(date||''))return alert('日付を選択してね');
  const wd=new Date(date+'T00:00:00').getDay();
  const overrides={};
  document.querySelectorAll('#overrideItems input[type=checkbox]').forEach(input=>{
    const item=state.items.find(i=>i.id===input.dataset.id);if(!item)return;
    const baseline=!!item.days?.[wd];
    if(input.checked!==baseline)overrides[item.id]=input.checked;
  });
  if(Object.keys(overrides).length)state.scheduleOverrides[date]=overrides;
  else delete state.scheduleOverrides[date];
  const rest=!!document.getElementById('restDayInput').checked;
  if(rest){ state.history[date]={date,items:[],rest:true,updatedAt:Date.now()}; }
  else if(state.history[date]){ state.history[date].rest=false; syncHistory(date); }
  else {syncHistory(date);}
  saveState();renderAll();
  alert('この日の設定を保存したよ');
}

function saveAdminItem(id){
  const item = state.items.find(x=>x.id===id); if(!item) return;
  const card = el.adminItemsList.querySelector(`[data-admin-id="${id}"]`); if(!card) return;
  item.name = card.querySelector('.name-input').value.trim() || item.name;
  item.kind = card.querySelector('.kind-select').value;
  item.days = Array.from(card.querySelectorAll('.weekday-toggle')).map(btn=>btn.classList.contains('on'));
  saveState(); ensureTodayHistory(); renderAll();
}
function deleteAdminItem(id){
  if(!confirm('この持ち物を削除しますか？')) return;
  state.items = state.items.filter(x=>x.id !== id);
  Object.values(state.daily).forEach(day=>delete day[id]);
  // Keep historical snapshots even after a registered item is deleted.
  saveState(); renderAll();
}

function showQrFor(id){
  const item=state.items.find(x=>x.id===id); if(!item)return;
  const value=`${item.qrPrefix||qrPrefix}${item.qrId}`;
  if(typeof window.MCQRCode!=='function'){
    alert('QRの部品を読み込めなかったよ。オンラインで開き直してね');return;
  }
  try{
    state.currentQrItemId=id;
    state.lastQrValue=value;
    drawQrCanvas(el.qrCanvas,value,232);
    el.qrDialogTitle.textContent=`${item.name} のQRコード`;
    el.qrDialogText.textContent='画像を保存または印刷して、持ち物に貼ってね。';
    el.qrDialog.showModal();
  }catch(err){console.error('QR生成:',err);alert('QRを作成できなかったよ：'+(err.message||'不明なエラー'));}
}
// Same QR generator and quiet zone as the individual printing flow.
function drawQrCanvas(canvas,value,preferredSize=232){
  if(typeof window.MCQRCode !== 'function')throw new Error('QR生成部品がありません');
  const qr=new window.MCQRCode(-1,window.MCQRCodeLevels.M);
  qr.addData(value);qr.make();
  const n=qr.getModuleCount(),quiet=4;
  const cell=Math.max(2,Math.floor(preferredSize/(n+quiet*2)));
  const size=cell*(n+quiet*2);
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);
  ctx.fillStyle='#1f1b1a';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))ctx.fillRect((c+quiet)*cell,(r+quiet)*cell,cell,cell);
  return canvas.toDataURL('image/png');
}

function switchAdminPage(page){
  if(!state.admin.unlocked || currentView!=='adminView')return;
  if(!['items','calendar','qr','data'].includes(page))return;
  currentAdminPage=page;
  showAdminPage();
  if(page==='qr')renderQrManageList();
}
function showAdminPage(){
  document.querySelectorAll('[data-admin-page]').forEach(p=>p.hidden=p.dataset.adminPage!==currentAdminPage);
  document.querySelectorAll('[data-admin-target]').forEach(btn=>{
    const active=btn.dataset.adminTarget===currentAdminPage;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
  });
}
function setQrSelection(ids){
  if(!state.admin.unlocked)return;
  qrSelectionInitialized=true;
  qrSelectedIds=new Set(ids.filter(id=>state.items.some(item=>item.id===id)));
  renderQrManageList();
}
function renderQrManageList(){
  if(currentView!=='adminView' || !state.admin.unlocked)return;
  const list=document.getElementById('qrManageList');
  const count=document.getElementById('qrSelectionCount');
  if(!qrSelectionInitialized){qrSelectedIds=new Set(state.items.map(item=>item.id));qrSelectionInitialized=true;}
  const exists=new Set(state.items.map(item=>item.id));
  qrSelectedIds=new Set([...qrSelectedIds].filter(id=>exists.has(id)));
  count.textContent=`${qrSelectedIds.size}こ選択中`;
  if(!state.items.length){list.innerHTML='<p class="micro-note">まだもちものがないよ。「もちもの追加・編集」で登録してね。</p>';return;}
  list.innerHTML=state.items.map(item=>{
    const checked=qrSelectedIds.has(item.id)?'checked':'';
    return `<div class="qr-manage-item"><label class="qr-select-label"><input type="checkbox" data-qr-select="${escapeHtml(item.id)}" ${checked}><span class="qr-manage-name">${escapeHtml(item.name)}</span></label><button type="button" class="mini-button" data-qr-view="${escapeHtml(item.id)}">表示</button></div>`;
  }).join('');
  list.querySelectorAll('[data-qr-select]').forEach(input=>input.addEventListener('change',()=>{
    const id=input.dataset.qrSelect;
    if(input.checked)qrSelectedIds.add(id);else qrSelectedIds.delete(id);
    count.textContent=`${qrSelectedIds.size}こ選択中`;
  }));
  list.querySelectorAll('[data-qr-view]').forEach(btn=>btn.addEventListener('click',()=>showQrFor(btn.dataset.qrView)));
}
function showBulkPrintPreview(){
  if(currentView!=='adminView' || !state.admin.unlocked)return;
  const selected=state.items.filter(item=>qrSelectedIds.has(item.id));
  if(!selected.length){alert('印刷したいもちものを1つ以上選んでね。');return;}
  if(typeof window.MCQRCode!=='function'){alert('QRの部品を読み込めなかったよ。オンラインで一度開き直してね。');return;}
  const columns=document.getElementById('qrPrintSize').value==='large'?2:3;
  const copies=Math.min(3,Math.max(1,Number(document.getElementById('qrCopyCount').value)||1));
  const sheet=document.getElementById('bulkPrintSheet');
  const qrCanvas=document.createElement('canvas');
  const markup=[];
  try{
    selected.forEach(item=>{
      const value=`${item.qrPrefix||qrPrefix}${item.qrId}`;
      const dataUrl=drawQrCanvas(qrCanvas,value,280);
      for(let i=0;i<copies;i++){
        markup.push(`<article class="bulk-label"><div class="bulk-label-name">${escapeHtml(item.name)}</div><img src="${dataUrl}" alt="${escapeHtml(item.name)}のQRコード"><div class="bulk-label-caption">もちもちもちもの</div></article>`);
      }
    });
  }catch(err){console.error('QR一括生成:',err);alert('QRを一括生成できなかったよ：'+(err.message||'不明なエラー'));return;}
  sheet.className=`bulk-print-sheet cols-${columns}`;
  sheet.innerHTML=markup.join('');
  document.getElementById('bulkPrintInfo').textContent=`${selected.length}種類・${markup.length}枚 / A4 ${columns}列`;
  document.getElementById('bulkPrintOverlay').hidden=false;
  document.body.classList.add('bulk-print-open');
  document.getElementById('closeBulkPrintButton').focus();
}
function closeBulkPrintPreview(){
  const overlay=document.getElementById('bulkPrintOverlay');
  if(overlay)overlay.hidden=true;
  document.body.classList.remove('bulk-print-open');
}

function printCurrentQr(){
  const item = state.items.find(x=>x.id===state.currentQrItemId); if(!item) return;
  const dataUrl = el.qrCanvas.toDataURL('image/png');
  const w = window.open('','_blank');
  if(!w){alert('ポップアップがブロックされました。QRを長押しして保存してね。');return;}
  w.document.write(`<title>${item.name} QR</title><body style="font-family:sans-serif;text-align:center;padding:24px"><h1>${escapeHtml(item.name)}</h1><img src="${dataUrl}" style="width:240px;height:240px"><p>もちもちもちもの</p></body>`);
  w.document.close(); w.focus(); setTimeout(()=>w.print(),200);
}

function exportBackup(){
  const blob = new Blob([JSON.stringify({...state, admin:{...state.admin, unlocked:false}}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mochimochi-mochimono-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href);
}
function importV14Backup(data){
  // Old v1.4 exports use UUID item IDs, expected/checked/scanned arrays.
  const legacyKinds={pencil:'pencilcase',bottle:'bottle',book:'notebook',shoe:'shoes',bag:'bag',cloth:'handkerchief',gym:'gym',lunch:'lunch',folder:'bag',mat:'board',tablet:'ipad',tissue:'tissue',umbrella:'umbrella',cap:'hat',letter:'custom'};
  const items=data.items.map(i=>({id:i.id,qrId:i.id,qrPrefix:'MCHK:',name:i.name,kind:legacyKinds[i.type]||'custom',days:Array.from({length:7},(_,d)=>(i.weekdays||[1,2,3,4,5]).includes(d)),createdAt:i.addedOn ? new Date(i.addedOn+'T12:00:00').getTime() : Date.now()}));
  const history={};const daily={};
  for(const [key,day] of Object.entries(data.history||{})){
    if(!/^\d{4}-\d\d-\d\d$/.test(key)||!Array.isArray(day?.expected))continue;
    const checked=new Set(day.checked||[]),scanned=new Set(day.scanned||[]);
    const entries=day.expected.map(e=>({id:e.id,name:e.name,kind:items.find(i=>i.id===e.id)?.kind||'custom',status:scanned.has(e.id)?'qr':checked.has(e.id)?'manual':'missing'}));
    history[key]={date:key,items:entries,rest:!!day.rest,updatedAt:Date.now()};
    daily[key]=Object.fromEntries(entries.map(e=>[e.id,e.status]));
  }
  return normalizeState({items,history,daily,scheduleOverrides:data.scheduleOverrides||{},admin:{pin:''}});
}
function importBackup(ev){
  const file = ev.target.files && ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload=()=>{
    try{
      const payload=JSON.parse(reader.result);
      if(!payload||!Array.isArray(payload.items)||payload.items.length>200)throw new Error('データ形式');
      if(!confirm('現在の登録データをバックアップの内容に置き換えます。よろしいですか？'))return;
      state=(payload.app==='mochimono-check'&&Number(payload.version)<=3) ? importV14Backup(payload) : normalizeState(payload);
      saveState();ensureTodayHistory();renderAll();
      alert('復元しました。登録したQRの番号も引き継いだよ。');
    }catch(e){console.warn('Backup restore:',e);alert('バックアップの形式を確認してね。復元できなかったよ。');}
  };
  reader.readAsText(file,'utf-8'); ev.target.value='';
}

function rand(a,b){ return a + Math.random()*(b-a); }
function shorten(s,n){ return s.length>n ? s.slice(0,n) : s; }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
