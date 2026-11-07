/* もちものチェック: local-first app for iOS 16+, no backend */
(() => {
  'use strict';
  const STORAGE_KEY = 'mochimono-check-v1';
  const PREFIX = 'MCHK:';
  const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
  const $ = (id) => document.getElementById(id);
  let storageAvailable = true;
  let items = loadItems();
  let activeView = 'home';
  let activeQRItemId = null;
  let cameraStream = null;
  let scanRAF = 0;
  let lastFrameTime = 0;
  let lastSeenQR = '';
  let noQRFrames = 0;
  let toastTimer = 0;
  const captureCanvas = document.createElement('canvas');
  const captureContext = captureCanvas.getContext('2d', {willReadFrequently:true});

  function todayKey(date = new Date()) {
    const p = n => String(n).padStart(2,'0');
    return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}`;
  }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID().toUpperCase();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
    const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  function normalizeItems(data) {
    if (!data || !Array.isArray(data.items) || data.items.length > 200) throw new Error('データ形式が正しくありません');
    const seen=new Set();
    return data.items.map(i => {
      if (!i || typeof i.name !== 'string' || !i.name.trim() || i.name.length > 35 || typeof i.id !== 'string' || !UUID_RE.test(i.id.toUpperCase())) throw new Error('持ち物データの一部が正しくありません');
      const id=i.id.toUpperCase();
      if (seen.has(id)) throw new Error('同じQR識別子が重複しています');
      seen.add(id);
      return {id,name:i.name.trim(),checkedOn: typeof i.checkedOn === 'string' && /^\d{4}-\d\d-\d\d$/.test(i.checkedOn) ? i.checkedOn : ''};
    });
  }
  function loadItems() {
    try {
      const raw=localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeItems(JSON.parse(raw));
      const sample=['筆箱','連絡帳','水筒','宿題ノート','上履き'].map(name=>({id:uuid(),name,checkedOn:''}));
      localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,items:sample}));
      return sample;
    } catch(err) {
      storageAvailable=false;
      console.error('Storage unavailable:',err);
      return [];
    }
  }
  function saveItems() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,items})); return true; }
    catch(err) {storageAvailable=false;showToast('保存できません。端末の空き容量や設定を確認してね。');return false;}
  }
  function showToast(message) {
    const toast=$('toast');toast.textContent=message;toast.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},3300);
  }
  function makeText(tag,cls,text) {
    const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=text;return el;
  }
  function render() {
    const today=todayKey();const checked=items.filter(i=>i.checkedOn===today).length;
    const dt = new Date();$('dateLabel').textContent=`${dt.getMonth()+1}月${dt.getDate()}日（${'日月火水木金土'[dt.getDay()]}）のチェック`;
    $('progressCount').textContent=`${checked} / ${items.length}`;
    $('progressFill').style.width=items.length?`${checked/items.length*100}%`:'0%';
    $('progressMessage').textContent=items.length===0?'まずは「もちもの」から登録してね':checked===items.length?'ぜんぶそろったよ！ おつかれさま 🎉':`${items.length-checked}こ、まだ確認していないよ`;
    $('remainingText').textContent=items.length===0?'持ち物なし':checked===items.length?'ぜんぶ確認済み':`のこり ${items.length-checked}こ`;
    $('manageCount').textContent=`${items.length}こ`;
    renderHomeList(today);
    renderManageList();
  }
  function renderHomeList(today) {
    const list=$('homeList');list.replaceChildren();
    if(!items.length){list.append(makeText('div','empty-state','「もちもの」から持ち物を登録しよう'));return;}
    for(const item of items){
      const checked=item.checkedOn===today;
      const b=makeText('button','item-row'+(checked?' is-done':''),'');b.type='button';b.setAttribute('aria-label',`${item.name}：${checked?'確認済み。チェックを外す':'未確認。手動でチェックする'}`);
      const dot=makeText('span','check-icon','✓');dot.setAttribute('aria-hidden','true');
      b.append(dot,makeText('span','item-name',item.name),makeText('span','item-status',checked?'確認済み':'未確認'));
      b.addEventListener('click',()=>{item.checkedOn=checked?'':todayKey();saveItems();render();showToast(checked?`${item.name} のチェックを外したよ`:`${item.name} を手動でチェックしたよ`);});
      list.append(b);
    }
  }
  function renderManageList() {
    const list=$('manageList');list.replaceChildren();
    if(!items.length){list.append(makeText('div','empty-state','まだ持ち物がないよ'));return;}
    for(const item of items){
      const row=makeText('div','manage-item','');row.append(makeText('div','manage-name',item.name));
      const btns=makeText('div','manage-buttons','');
      for(const [label,action,cls] of [['QR','qr',''],['名前変更','rename',''],['削除','delete','danger']]){
        const b=makeText('button','mini-button'+(cls?' '+cls:''),label);b.type='button';
        b.setAttribute('aria-label',`${item.name} の${label}`);b.addEventListener('click',()=>manageAction(action,item.id));btns.append(b);
      }
      row.append(btns);list.append(row);
    }
  }
  function manageAction(action,id) {
    const item=items.find(x=>x.id===id);if(!item)return;
    if(action==='qr'){openQr(item);return;}
    if(action==='rename'){
      const name=window.prompt('持ち物の名前を変更',item.name);
      if(name===null)return;
      const trimmed=name.trim();if(!trimmed || trimmed.length>35){showToast('名前は1〜35文字にしてね');return;}
      item.name=trimmed;saveItems();render();showToast('名前を変更したよ');return;
    }
    if(action==='delete'){
      if(!window.confirm(`「${item.name}」を削除しますか？\nこの持ち物のQRシールは使えなくなります。`))return;
      items=items.filter(x=>x.id!==id);saveItems();render();showToast('持ち物を削除したよ');
    }
  }
  function switchView(view) {
    const names=['home','scanner','manage'];if(!names.includes(view))return;
    if(activeView==='scanner' && view!=='scanner')stopScanner();
    activeView=view;
    for(const name of names)$(`${name}View`).hidden=name!==view;
    document.querySelectorAll('[data-view]').forEach(b=>{
      const active=b.dataset.view===view;b.classList.toggle('active',active);
      if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    window.scrollTo(0,0);
    if(view==='scanner')void startScanner(); else render();
  }
  function setScannerMessage(type,message,mark){
    const target=$('scanResult');target.className='scan-result'+(type?' '+type:'');
    $('scanResultText').textContent=message;
    target.querySelector('.result-indicator').textContent=mark||'◎';
  }
  async function startScanner(){
    if(cameraStream)return;
    $('retryCamera').hidden=true;
    $('cameraPlaceholder').hidden=false;
    setScannerMessage('','カメラを準備しているよ…','◎');
    if(!window.isSecureContext){cameraError('カメラにはHTTPSで開く必要があるよ。');return;}
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){cameraError('このブラウザではカメラを利用できないよ。Safariを使ってね。');return;}
    if(typeof window.jsQR!=='function'){cameraError('QR読み取り用の部品を取得できなかったよ。オンラインで一度開き直してね。');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}}});
      if(activeView!=='scanner'){stream.getTracks().forEach(t=>t.stop());return;}
      cameraStream=stream;const video=$('cameraVideo');video.srcObject=stream;
      await video.play();$('cameraPlaceholder').hidden=true;
      setScannerMessage('','QRコードを枠の中に入れてね。','◎');
      noQRFrames=0;lastSeenQR='';lastFrameTime=0;scanRAF=requestAnimationFrame(scanFrame);
    }catch(err){
      console.error('Camera error:',err);
      let message='カメラが起動できなかったよ。';
      if(err.name==='NotAllowedError'||err.name==='PermissionDeniedError')message='カメラの使用が許可されていないよ。iPhoneの設定から許可してね。';
      if(err.name==='NotFoundError'||err.name==='OverconstrainedError')message='カメラが見つからないよ。';
      cameraError(message);
    }
  }
  function cameraError(message){$('cameraPlaceholder').hidden=false;$('cameraPlaceholder').lastElementChild.textContent='カメラを起動できません';$('retryCamera').hidden=false;setScannerMessage('error',message,'!');}
  function stopScanner(){
    cancelAnimationFrame(scanRAF);scanRAF=0;
    const video=$('cameraVideo');video.pause();video.srcObject=null;
    if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;
  }
  function scanFrame(t){
    if(!cameraStream || activeView!=='scanner')return;
    scanRAF=requestAnimationFrame(scanFrame);
    if(t-lastFrameTime<220)return;
    lastFrameTime=t;
    const video=$('cameraVideo');if(video.readyState<2||!video.videoWidth||!video.videoHeight)return;
    const w=Math.min(540,video.videoWidth),h=Math.round(w*video.videoHeight/video.videoWidth);
    if(captureCanvas.width!==w||captureCanvas.height!==h){captureCanvas.width=w;captureCanvas.height=h;}
    try{
      captureContext.drawImage(video,0,0,w,h);
      const pixels=captureContext.getImageData(0,0,w,h);
      const result=window.jsQR(pixels.data,w,h,{inversionAttempts:'dontInvert'});
      if(!result){noQRFrames++;if(noQRFrames>4)lastSeenQR='';return;}
      noQRFrames=0;
      const text=result.data.trim();
      if(text===lastSeenQR)return;
      lastSeenQR=text;
      handleScan(text);
    }catch(err){console.error('Decode error:',err);setScannerMessage('error','QRコードの読み取りでエラーが起きたよ。','!');}
  }
  function handleScan(text){
    const v=text.trim().toUpperCase();
    if(!v.startsWith(PREFIX)||!UUID_RE.test(v.slice(PREFIX.length))){setScannerMessage('error','このアプリ用のQRコードではないみたい。','!');return;}
    const item=items.find(x=>x.id===v.slice(PREFIX.length));
    if(!item){setScannerMessage('error','この持ち物は登録されていないよ。バックアップの復元が必要かも。','!');return;}
    if(item.checkedOn===todayKey()){setScannerMessage('duplicate',`「${item.name}」はもう確認できているよ。`,'✓');return;}
    item.checkedOn=todayKey();saveItems();render();setScannerMessage('success',`「${item.name}」を確認できたよ！ 次のQRをどうぞ。`,'✓');
  }
  function qrFor(item){
    if(typeof window.MCQRCode!=='function')throw new Error('QR作成ライブラリがありません');
    const qr=new window.MCQRCode(-1,window.MCQRCodeLevels.M);qr.addData(PREFIX+item.id);qr.make();return qr;
  }
  function drawQR(canvas,item){
    const qr=qrFor(item), count=qr.getModuleCount(),quiet=4;
    const out=canvas.getContext('2d');const cell=12;const side=(count+quiet*2)*cell;
    canvas.width=side;canvas.height=side;out.fillStyle='#fff';out.fillRect(0,0,side,side);
    out.fillStyle='#000';for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col))out.fillRect((col+quiet)*cell,(row+quiet)*cell,cell,cell);
  }
  function openQr(item){
    activeQRItemId=item.id;$('qrModalTitle').textContent=item.name;
    try{drawQR($('qrCanvas'),item);}catch(err){showToast('QRを作成できなかったよ');return;}
    $('qrModal').hidden=false;
  }
  function closeQr(){$('qrModal').hidden=true;activeQRItemId=null;}
  function currentQRItem(){return items.find(i=>i.id===activeQRItemId);}
  function saveQrImage(){
    const item=currentQRItem();if(!item)return;
    const a=document.createElement('a');a.download=`もちものQR_${item.name.replace(/[\\/:*?"<>|]/g,'_')}.png`;a.href=$('qrCanvas').toDataURL('image/png');document.body.append(a);a.click();a.remove();
    showToast('画像のダウンロードを開始したよ');
  }
  function printQRLabels(subset){
    if(!subset.length){showToast('まず持ち物を登録してね');return;}
    const sheet=$('printSheet');sheet.replaceChildren();
    for(const item of subset){
      const label=makeText('div','print-label','');label.append(makeText('div','print-name',item.name));
      const can=document.createElement('canvas');can.className='print-qr';drawQR(can,item);label.append(can);
      label.append(makeText('div','print-note','もちものチェック用 QR'));sheet.append(label);
    }
    window.print();
  }
  function downloadBackup(){
    const file=new Blob([JSON.stringify({app:'mochimono-check',version:1,exportedAt:new Date().toISOString(),items},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=`もちものバックアップ_${todayKey()}.json`;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    showToast('バックアップのダウンロードを開始したよ');
  }
  async function importBackup(event){
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>200000)throw new Error('ファイルが大きすぎます');
      const raw=await file.text();const data=JSON.parse(raw);
      if(data.app!=='mochimono-check'||data.version!==1)throw new Error('このアプリのバックアップではありません');
      const next=normalizeItems(data);
      if(!window.confirm(`バックアップの ${next.length} 個の持ち物で現在のリストを置き換えますか？`))return;
      items=next;saveItems();render();showToast('バックアップを復元したよ。QRシールもそのまま使えるよ。');
    }catch(err){showToast(`復元できません：${err.message}`);}finally{event.target.value='';}
  }
  function refreshIfDayChanged(){
    const date=todayKey();if(refreshIfDayChanged.last!==date){refreshIfDayChanged.last=date;render();}
  }
  function checkOfflineReadiness(){
    const badge=$('offlineBadge');
    if(!('serviceWorker' in navigator)){badge.textContent='オフライン未対応';badge.className='offline-badge warn';return;}
    navigator.serviceWorker.register('./sw.js').then(reg=>navigator.serviceWorker.ready).then(reg=>{
      if(!reg.active)throw new Error('Service worker inactive');
      const channel=new MessageChannel();
      channel.port1.onmessage=(e)=>{
        if(e.data && e.data.offlineReady){badge.textContent='オフライン準備OK';badge.className='offline-badge ready';}
        else {badge.textContent='ネット接続で準備';badge.className='offline-badge warn';}
      };
      reg.active.postMessage({type:'OFFLINE_STATUS'},[channel.port2]);
    }).catch(err=>{console.warn('Offline setup:',err);badge.textContent='オフライン未準備';badge.className='offline-badge warn';});
  }
  function installEvents(){
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
    $('startScanButton').addEventListener('click',()=>switchView('scanner'));
    $('backHome').addEventListener('click',()=>switchView('home'));
    $('retryCamera').addEventListener('click',()=>{stopScanner();void startScanner();});
    $('addForm').addEventListener('submit',event=>{
      event.preventDefault();if(items.length>=200){showToast('登録できるのは200個までだよ');return;}
      const input=$('newItemName'),name=input.value.trim();if(!name||name.length>35){showToast('名前は1〜35文字にしてね');return;}
      items.push({id:uuid(),name,checkedOn:''});saveItems();input.value='';render();showToast(`「${name}」を登録したよ`);
    });
    $('closeQrModal').addEventListener('click',closeQr);
    $('qrModal').addEventListener('click',e=>{if(e.target===$('qrModal'))closeQr();});
    $('saveQrButton').addEventListener('click',saveQrImage);
    $('printSingleButton').addEventListener('click',()=>{const item=currentQRItem();if(item)printQRLabels([item]);});
    $('printAllButton').addEventListener('click',()=>printQRLabels(items));
    $('exportButton').addEventListener('click',downloadBackup);
    $('importButton').addEventListener('click',()=>$('importFile').click());
    $('importFile').addEventListener('change',importBackup);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScanner();else if(activeView==='scanner'){$('retryCamera').hidden=false;setScannerMessage('','「カメラをもう一度起動」を押してね。','◎');}});
    window.addEventListener('pagehide',stopScanner);
    window.addEventListener('pageshow',()=>{render();refreshIfDayChanged.last=todayKey();});
    setInterval(refreshIfDayChanged,60000);
  }
  installEvents();render();checkOfflineReadiness();
  if(!storageAvailable)showToast('端末内に保存できない状態だよ。Safariの設定を確認してね。');
})();
