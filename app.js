const STORAGE_KEY = 'mochimochi-mochimono-v15';
const APP_VERSION = 'v1.5';
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
let scan = {stream:null, raf:null, lastSeen:'', lastAt:0};
let friendMotionTimer = null;
let celebrateTimer = null;

const el = {};

document.addEventListener('DOMContentLoaded', init);

function init(){
  cacheEls();
  if(!state.items.length) seedDefaultItems();
  bindEvents();
  fillKindSelects();
  ensureTodayHistory();
  registerSW();
  updateOnlineBadge();
  renderAll();
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
  document.getElementById('prevMonthButton').addEventListener('click',()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();});
  document.getElementById('nextMonthButton').addEventListener('click',()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();});
  document.getElementById('settingsButton').addEventListener('click',()=>switchView('adminView'));
  document.getElementById('lockAdminButton').addEventListener('click',lockAdmin);
  document.getElementById('addItemForm').addEventListener('submit',onAddItem);
  document.getElementById('exportButton').addEventListener('click',exportBackup);
  document.getElementById('importInput').addEventListener('change',importBackup);
  document.getElementById('printQrButton').addEventListener('click',printCurrentQr);
}

function seedDefaultItems(){
  state.items = defaultPresets.map(p=>makeItem(p.name,p.kind,p.days));
  saveState();
}

function makeItem(name, kind, days){
  return {id:uid(), name, kind, days:days||[false,true,true,true,true,true,false], qrId:uid(), createdAt:Date.now()};
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    }
    for(let i=0;i<localStorage.length;i++){
      const key = localStorage.key(i);
      if(!key || key === STORAGE_KEY) continue;
      if(!/mochi|mochimono/i.test(key)) continue;
      try{
        const candidate = JSON.parse(localStorage.getItem(key));
        if(candidate && Array.isArray(candidate.items)){
          return normalizeState(candidate);
        }
      }catch(err){}
    }
  }catch(e){}
  return normalizeState({items:[], daily:{}, history:{}, admin:{pin:'', unlocked:false}});
}

function normalizeState(s){
  return {
    items:Array.isArray(s.items)?s.items:[],
    daily:s.daily||{},
    history:s.history||{},
    admin:{pin:(s.admin&&s.admin.pin)||'', unlocked:false},
    lastQrValue:s.lastQrValue||'',
    currentQrItemId:s.currentQrItemId||''
  };
}

function saveState(){
  const snapshot = JSON.parse(JSON.stringify(state));
  if(snapshot.admin) snapshot.admin.unlocked = false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function registerSW(){
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
}

function updateOnlineBadge(){
  const ready = navigator.onLine ? 'オフライン準備OK' : 'オフライン中';
  el.offlineBadge.textContent = ready;
}

function switchView(viewId){
  currentView = viewId;
  document.querySelectorAll('.view').forEach(v=>v.hidden = v.id !== viewId);
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('is-active', b.dataset.view === viewId));
  if(viewId === 'scannerView') startScan(); else stopScan();
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
function itemGlyph(item){ return getKindDef(item.kind).glyph || (item.name||'?').trim().charAt(0) || '?'; }
function itemColor(item){ return getKindDef(item.kind).tone || '#f2e7dd'; }
function isSchoolday(dateKey){ const d = new Date(dateKey+'T00:00:00'); const day = d.getDay(); return day !== 0 && day !== 6; }
function currentDayStatuses(dateKey = todayKey()){ if(!state.daily[dateKey]) state.daily[dateKey] = {}; return state.daily[dateKey]; }
function statusFor(itemId, dateKey = todayKey()){ return currentDayStatuses(dateKey)[itemId] || 'missing'; }
function setStatus(itemId, status, dateKey = todayKey()){
  currentDayStatuses(dateKey)[itemId] = status;
  syncHistory(dateKey);
  saveState();
  renderAll();
}
function requiredItems(dateKey = todayKey()){
  const d = new Date(dateKey+'T00:00:00'); const w = d.getDay();
  return state.items.filter(item => (item.days && item.days[w]) !== false);
}
function checkedCount(dateKey = todayKey()){
  const req = requiredItems(dateKey);
  let done = 0; req.forEach(item=>{ const st = statusFor(item.id,dateKey); if(st === 'qr' || st === 'manual' || st === 'notneeded') done++; });
  return {done,total:req.length};
}
function syncHistory(dateKey = todayKey()){
  const req = requiredItems(dateKey);
  state.history[dateKey] = {
    date: dateKey,
    items: req.map(item=>({id:item.id,name:item.name,kind:item.kind,status:statusFor(item.id,dateKey)})),
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
  el.progressMessage.textContent = total ? (rem===0 ? 'きょうの持ち物は ばっちり！' : `${rem}こ 見つけると みんながよろこぶよ`) : '保護者設定から持ち物を追加してね';
}

function buildFriendMarkup(item, extra=''){
  const kind = getKindDef(item.kind);
  const isCustom = item.kind === 'custom';
  return `<div class="friend ${kind.className} ${isCustom?'custom-letter':''} ${extra}" data-item-id="${item.id}" style="--tone:${itemColor(item)}"><div class="blob"></div><div class="tone"></div>${isCustom?`<div class="letter">${escapeHtml(itemGlyph(item).charAt(0))}</div>`:''}<div class="face"><div class="cheeks"></div><div class="mouth"></div></div><div class="arms"></div><div class="legs"></div><div class="label">${escapeHtml(shorten(item.name,8))}</div></div>`;
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
  const today = new Date();
  let sum = 0, denom = 0;
  for(let i=0;i<14;i++){
    const d = new Date(today); d.setDate(today.getDate()-i); const key = todayKey(d);
    if(!isSchoolday(key)) continue;
    if((item.days && item.days[d.getDay()]) === false) continue;
    denom += 1;
    const st = state.history[key]?.items?.find(x=>x.id===item.id)?.status || state.daily[key]?.[item.id] || 'missing';
    if(st === 'qr') sum += 1;
    else if(st === 'manual') sum += .8;
    else if(st === 'notneeded') sum += .85;
  }
  const base = denom ? sum/denom : .45;
  return Math.max(0, Math.min(1, base));
}

function roomMessageFromAvg(avg){
  if(avg >= .78) return ['みんなが もちもちっと元気！','にこにこしながら近くまで来ているよ'];
  if(avg >= .55) return ['みんな ごきげん','おへやの中を たくさん歩き回っているよ'];
  if(avg >= .32) return ['のんびり しているよ','見つけてもらえると もっと元気になるよ'];
  return ['ちょっぴり さみしそう','見つけてもらえるのを待っているよ'];
}

function renderFriends(){
  const source = state.items.length ? state.items : requiredItems();
  if(!source.length){ el.friendsLayer.innerHTML = ''; return; }
  const scores = source.map(activityScore);
  const avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
  const [mini,msg] = roomMessageFromAvg(avg);
  el.friendsMiniStatus.textContent = mini;
  el.friendsMessage.textContent = msg;
  el.friendsLayer.innerHTML = source.map(item=>{
    const a = activityScore(item);
    let mood = a < .25 ? 'back small' : a < .5 ? 'side' : a < .75 ? 'happy' : 'happy big';
    return buildFriendMarkup(item, mood);
  }).join('');
  startFriendMotion();
}

function startFriendMotion(){
  if(friendMotionTimer) clearInterval(friendMotionTimer);
  moveFriendsOnce();
  friendMotionTimer = setInterval(moveFriendsOnce, 2200);
}

function moveFriendsOnce(){
  el.friendsLayer.querySelectorAll('.friend').forEach(friendEl=>{
    const item = state.items.find(x=>x.id===friendEl.dataset.itemId); if(!item) return;
    const a = activityScore(item);
    const box = moodBox(a);
    const x = rand(box.minX, box.maxX); const y = rand(box.minY, box.maxY);
    friendEl.style.left = `${x}%`; friendEl.style.top = `${y}%`;
    const moodClass = a < .25 ? 'back small' : a < .5 ? 'side' : a < .75 ? 'happy' : 'happy big';
    friendEl.className = `friend ${getKindDef(item.kind).className} ${item.kind==='custom'?'custom-letter':''} ${moodClass}`;
  });
}
function moodBox(a){
  if(a < .25) return {minX:70,maxX:84,minY:62,maxY:76};
  if(a < .5) return {minX:52,maxX:80,minY:48,maxY:76};
  if(a < .75) return {minX:28,maxX:72,minY:40,maxY:74};
  return {minX:14,maxX:68,minY:36,maxY:72};
}

async function startScan(){
  el.scanStatus.textContent = 'カメラを起動しています…';
  try{
    stopScan();
    const constraints = {video:{facingMode:{ideal:'environment'}}, audio:false};
    scan.stream = await navigator.mediaDevices.getUserMedia(constraints);
    el.cameraVideo.srcObject = scan.stream;
    await el.cameraVideo.play();
    el.scanStatus.textContent = 'QRコードを枠の中に入れてね。';
    scanLoop();
  }catch(err){ el.scanStatus.textContent = 'カメラを使えませんでした。Safariでカメラ許可を確認してね。'; }
}
function stopScan(){
  if(scan.raf) cancelAnimationFrame(scan.raf); scan.raf = null;
  if(scan.stream){ scan.stream.getTracks().forEach(t=>t.stop()); scan.stream = null; }
  if(el.cameraVideo) el.cameraVideo.srcObject = null;
}
function restartScan(){ if(currentView==='scannerView') startScan(); }
function scanLoop(){
  const video = el.cameraVideo;
  if(!video || video.readyState < 2){ scan.raf = requestAnimationFrame(scanLoop); return; }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const img = ctx.getImageData(0,0,canvas.width,canvas.height);
  if(window.jsQR){
    const code = window.jsQR(img.data, img.width, img.height, {inversionAttempts:'dontInvert'});
    if(code && code.data && (Date.now() - scan.lastAt > 1500 || scan.lastSeen !== code.data)){
      scan.lastSeen = code.data; scan.lastAt = Date.now();
      onScanValue(code.data);
    }
  }
  scan.raf = requestAnimationFrame(scanLoop);
}
function onScanValue(val){
  const item = state.items.find(it => `${qrPrefix}${it.qrId}` === val);
  if(item){
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
    const counts = checkedCount(key);
    const pct = counts.total ? counts.done / counts.total : 0;
    let chip = counts.total ? `${counts.done}/${counts.total}` : '—';
    let chipClass = pct===1 ? 'good' : pct>0 ? 'some' : '';
    const flags = ['day-cell', key===todayKey()?'today':'', key===selectedKey?'selected':''].join(' ');
    cells.push(`<button type="button" class="${flags}" data-date="${key}"><strong>${day}</strong><small>${weekdayNames[d.getDay()]}</small><span class="day-chip ${chipClass}">${chip}</span></button>`);
  }
  el.calendarGrid.innerHTML = cells.join('');
  el.calendarGrid.querySelectorAll('[data-date]').forEach(btn=>btn.addEventListener('click',()=>{ state.selectedDate = btn.dataset.date; saveState(); renderCalendar(); }));
  renderCalendarDetail(selectedKey);
}

function renderCalendarDetail(dateKey){
  const hist = state.history[dateKey] || {items: requiredItems(dateKey).map(item=>({id:item.id,name:item.name,kind:item.kind,status:statusFor(item.id,dateKey)}))};
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
  const pinSet = !!state.admin.pin;
  if(!pinSet){
    el.adminAuth.innerHTML = `<div><strong>保護者用PINを作る</strong><p class="micro-note">4〜8桁の数字で、管理画面に入るためのPINを決めてね。</p></div><div class="pin-row"><input id="setPinInput" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"><button type="button" class="primary-button" id="setPinButton">設定する</button></div>`;
    el.adminPanel.hidden = true;
    document.getElementById('setPinButton').onclick = ()=>{ const pin = document.getElementById('setPinInput').value.trim(); if(!/^\d{4,8}$/.test(pin)) return alert('4〜8桁の数字にしてね'); state.admin.pin = simpleHash(pin); state.admin.unlocked = true; saveState(); renderAdmin(); };
    return;
  }
  if(!state.admin.unlocked){
    el.adminAuth.innerHTML = `<div><strong>保護者PINを入力</strong><p class="micro-note">もちもの一覧の追加・削除・曜日設定をするときに使うよ。</p></div><div class="pin-row"><input id="enterPinInput" type="password" inputmode="numeric" maxlength="8" placeholder="PIN"><button type="button" class="primary-button" id="enterPinButton">入る</button></div>`;
    el.adminPanel.hidden = true;
    document.getElementById('enterPinButton').onclick = ()=>{ const pin = document.getElementById('enterPinInput').value.trim(); if(simpleHash(pin) !== state.admin.pin){ alert('PINがちがうようです'); return; } state.admin.unlocked = true; renderAdmin(); };
    return;
  }
  el.adminAuth.innerHTML = `<div class="friends-status">保護者モードです</div>`;
  el.adminPanel.hidden = false;
  renderAdminItems();
}
function lockAdmin(){ state.admin.unlocked = false; renderAdmin(); }
function simpleHash(s){ return btoa(unescape(encodeURIComponent('pin:'+s))); }

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
  el.adminItemsList.innerHTML = state.items.map(item=>`<div class="admin-item" data-admin-id="${item.id}"><div class="admin-item-head"><div><div class="admin-item-name">${escapeHtml(item.name)}</div><div class="admin-item-kind">${escapeHtml(getKindDef(item.kind).label)}</div></div><button type="button" class="mini-button" data-action="qr" data-id="${item.id}">QR</button></div><div class="admin-item-actions"><select class="small-input kind-select" data-id="${item.id}">${presetKinds.map(k=>`<option value="${k.key}" ${k.key===item.kind?'selected':''}>${k.label}</option>`).join('')}</select><input class="small-input name-input" data-id="${item.id}" value="${escapeHtml(item.name)}"></div><div class="weekday-mini" id="days-${item.id}"></div><div class="admin-item-actions"><button type="button" class="secondary-button" data-action="save" data-id="${item.id}">変更を保存</button><button type="button" class="secondary-button" data-action="delete" data-id="${item.id}">削除</button></div></div>`).join('');
  state.items.forEach(item=>renderWeekdayEditor(item.days, document.getElementById(`days-${item.id}`), item.id));
  el.adminItemsList.querySelectorAll('[data-action="qr"]').forEach(btn=>btn.addEventListener('click',()=>showQrFor(btn.dataset.id)));
  el.adminItemsList.querySelectorAll('[data-action="save"]').forEach(btn=>btn.addEventListener('click',()=>saveAdminItem(btn.dataset.id)));
  el.adminItemsList.querySelectorAll('[data-action="delete"]').forEach(btn=>btn.addEventListener('click',()=>deleteAdminItem(btn.dataset.id)));
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
  Object.values(state.history).forEach(hist=>{ if(hist.items) hist.items = hist.items.filter(x=>x.id !== id); });
  saveState(); renderAll();
}

function showQrFor(id){
  const item = state.items.find(x=>x.id===id); if(!item) return;
  if(!window.QRious){ alert('QRの準備がまだできていません。オンラインで再読込してみてください。'); return; }
  state.currentQrItemId = id; state.lastQrValue = `${qrPrefix}${item.qrId}`;
  const qr = new window.QRious({element:el.qrCanvas, value:state.lastQrValue, size:240, level:'H', foreground:'#2f2b28', background:'#ffffff'});
  el.qrDialogTitle.textContent = `${item.name} のQRコード`;
  el.qrDialogText.textContent = '長押しで画像保存できます。印刷して持ち物に貼ってください。';
  el.qrDialog.showModal();
}
function printCurrentQr(){
  const item = state.items.find(x=>x.id===state.currentQrItemId); if(!item) return;
  const dataUrl = el.qrCanvas.toDataURL('image/png');
  const w = window.open('','_blank');
  w.document.write(`<title>${item.name} QR</title><body style="font-family:sans-serif;text-align:center;padding:24px"><h1>${escapeHtml(item.name)}</h1><img src="${dataUrl}" style="width:240px;height:240px"><p>もちもちもちもの</p></body>`);
  w.document.close(); w.focus(); setTimeout(()=>w.print(),200);
}

function exportBackup(){
  const blob = new Blob([JSON.stringify({...state, admin:{...state.admin, unlocked:false}}, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mochimochi-mochimono-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href);
}
function importBackup(ev){
  const file = ev.target.files && ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{ try{ state = normalizeState(JSON.parse(reader.result)); saveState(); renderAll(); alert('復元しました'); }catch(e){ alert('復元に失敗しました'); } };
  reader.readAsText(file,'utf-8'); ev.target.value='';
}

function rand(a,b){ return a + Math.random()*(b-a); }
function shorten(s,n){ return s.length>n ? s.slice(0,n) : s; }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
