/* WOPR reference behavior: in-panel controls, central TTT, AI-driven map activity. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const panel = document.querySelector('.terminal-panel');
 const terminal = $('terminal'), form = $('chat-form');
 const game = document.querySelector('.wopr-panel .game');
 if (!panel || !game || !terminal || !form) return;
 const gameSlot = document.createElement('div');
 gameSlot.id = 'ttt-view';
 gameSlot.hidden = true;
 gameSlot.setAttribute('aria-label','WOPR TIC-TAC-TOE');
 const gameTitle = document.createElement('div');
 gameTitle.className = 'ttt-title';
 gameTitle.textContent = 'W O P R  /  T I C - T A C - T O E';
 const gameIntro = document.createElement('div');
 gameIntro.className = 'ttt-intro';
 gameIntro.textContent = 'SHALL WE PLAY A GAME?';
 const gameReturn = document.createElement('button');
 gameReturn.id = 'return-chat'; gameReturn.textContent = 'RETURN TO TERMINAL';
 gameSlot.append(gameTitle,gameIntro,game,gameReturn);
 panel.insertBefore(gameSlot,form);
 const status = document.createElement('div');
 status.id = 'terminal-feedback'; status.hidden = true;
 panel.insertBefore(status,form);
 let feedbackTimer;
 function feedback(message){
  status.textContent=message;status.hidden=false;
  clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>status.hidden=true,4500);
 }
 function showGame(on){
  if(on && typeof configView!=='undefined')configView.hidden=true;
  if(on&&typeof historyView!=='undefined')historyView.hidden=true;
  gameSlot.hidden=!on;terminal.hidden=on;form.hidden=on;
  $('ttt-shortcut').textContent=on?'CHAT':'TTT';
  $('ttt-shortcut').setAttribute('aria-pressed',String(on));
  if(!on)$('prompt').focus();
 }
 $('ttt-shortcut').onclick=()=>showGame(gameSlot.hidden);
 gameReturn.onclick=()=>showGame(false);
 // No browser-native confirmation popups: NEW switches session without deleting old history.
 $('new-session').onclick=()=>{
  if($('ai-state').textContent.trim()!=='STANDBY'){
   feedback('WAIT UNTIL THE CURRENT RESPONSE IS COMPLETE.');return;
  }
  const id=crypto.randomUUID();localStorage.setItem('wopr-session',id);
  // Existing app.js holds the session in a const: reload is required to adopt the new ID.
  location.reload();
 };
 // CONFIG: real Ollama generation parameters, stored locally per browser.
 const cfgDefaults={temperature:0.7,top_p:0.9,top_k:40,repeat_penalty:1.1,num_ctx:4096,num_predict:1024};
 function getConfig(){try{return {...cfgDefaults,...JSON.parse(localStorage.getItem('wopr-ollama-config')||'{}')}}catch{return {...cfgDefaults}}}
 const configView=document.createElement('div');configView.id='wopr-config-view';configView.hidden=true;
 configView.innerHTML=`<div class="config-title">WOPR / MODEL PARAMETERS</div><form id="wopr-config-form">
 <label>TEMPERATURE <input name="temperature" type="number" min="0" max="2" step="0.05"></label>
 <label>TOP P <input name="top_p" type="number" min="0.01" max="1" step="0.05"></label>
 <label>TOP K <input name="top_k" type="number" min="1" max="200" step="1"></label>
 <label>REPEAT PENALTY <input name="repeat_penalty" type="number" min="0.5" max="2" step="0.05"></label>
 <label>CONTEXT TOKENS <input name="num_ctx" type="number" min="512" max="32768" step="512"></label>
 <label>MAX OUTPUT TOKENS <input name="num_predict" type="number" min="64" max="8192" step="64"></label>
 <div class="config-actions"><button type="submit">SAVE PARAMETERS</button><button type="button" id="wopr-config-defaults">DEFAULTS</button><button type="button" id="wopr-config-close">BACK TO CHAT</button></div>
 </form><div class="config-note">APPLIED TO NEXT OLLAMA REQUEST / SAVED IN THIS BROWSER</div>`;
 panel.insertBefore(configView,form);
 const cfgForm=configView.querySelector('form');
 function populateCfg(){const c=getConfig();for(const el of cfgForm.querySelectorAll('input'))el.value=c[el.name]}
 function closeCfg(){configView.hidden=true;terminal.hidden=false;form.hidden=false;$('prompt').focus()}
 $('config').onclick=()=>{
  showGame(false);
  if(typeof historyView!=='undefined')historyView.hidden=true;
  terminal.hidden=true;form.hidden=true;configView.hidden=false;populateCfg();
 };
 cfgForm.onsubmit=e=>{e.preventDefault();const c={};for(const el of cfgForm.querySelectorAll('input')){
  if(!el.checkValidity()){el.reportValidity();return}c[el.name]=Number(el.value)
 }localStorage.setItem('wopr-ollama-config',JSON.stringify(c));closeCfg();feedback('MODEL PARAMETERS SAVED')};
 $('wopr-config-defaults').onclick=()=>{localStorage.removeItem('wopr-ollama-config');populateCfg()};
 $('wopr-config-close').onclick=closeCfg;
 // CLR keeps backend history deletion semantics but avoids the native confirm popup.
 $('clear').onclick=async()=>{
  if($('ai-state').textContent.trim()!=='STANDBY'){
   feedback('STOP THE ACTIVE RESPONSE BEFORE CLEARING HISTORY.');return;
  }
  const id=localStorage.getItem('wopr-session');
  if(!id){feedback('NO ACTIVE SESSION.');return;}
  const confirmBox=document.createElement('div');confirmBox.className='wopr-confirm';
  const question=document.createElement('span');question.textContent='CLEAR THIS SESSION HISTORY?';
  const yes=document.createElement('button');yes.textContent='CONFIRM';
  const no=document.createElement('button');no.textContent='CANCEL';
  confirmBox.append(question,yes,no);panel.append(confirmBox);
  no.onclick=()=>confirmBox.remove();
  yes.onclick=async()=>{
   yes.disabled=true;
   try{
    const response=await fetch('/api/history/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:id})});
    if(!response.ok)throw new Error('HTTP '+response.status);
    terminal.replaceChildren();
    const line=document.createElement('div');line.className='line system';line.textContent='WOPR TERMINAL RESET / HISTORY CLEARED';terminal.append(line);
    feedback('SESSION HISTORY CLEARED.');
   }catch(err){feedback('ERROR CLEARING HISTORY: '+err.message)}
   finally{confirmBox.remove()}
  };
 };
 // HISTORY replaces the terminal temporarily, without deleting conversation data.
 const historyView=document.createElement('div');historyView.id='wopr-history-view';historyView.hidden=true;
 const historyHeader=document.createElement('div');historyHeader.className='history-inpanel-head';
 const historyTitle=document.createElement('strong');historyTitle.textContent='WOPR / SESSION HISTORY';
 const historyBack=document.createElement('button');historyBack.textContent='RETURN TO CHAT';
 historyHeader.append(historyTitle,historyBack);
 const historyBody=document.createElement('div');historyBody.className='history-inpanel-body';
 historyView.append(historyHeader,historyBody);panel.insertBefore(historyView,form);
 function showHistory(on){
  configView.hidden=true;
  if(on)showGame(false);
  historyView.hidden=!on;terminal.hidden=on;form.hidden=on;
  if(!on)$('prompt').focus();
 }
 historyBack.onclick=()=>showHistory(false);
 $('history-view').onclick=async()=>{
  if($('ai-state').textContent.trim()!=='STANDBY'){
   feedback('WAIT FOR RESPONSE TO COMPLETE BEFORE CHANGING SESSION.');return;
  }
  showHistory(true);historyBody.textContent='LOADING PERSISTENT DATABASE...';
  try{
   const r=await fetch('/api/sessions',{cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();historyBody.replaceChildren();
   const current=localStorage.getItem('wopr-session');
   for(const item of data.sessions||[]){
    const row=document.createElement('div');row.className='wopr-session-row';
    const label=document.createElement('span');
    const date=new Date(item.updated).toLocaleString('it-IT');
    label.textContent=date+' / '+item.messages+' MSG / '+(item.preview||'').slice(0,75);
    const open=document.createElement('button');open.type='button';
    open.textContent=item.id===current?'CURRENT':'OPEN';
    open.onclick=()=>{
     localStorage.setItem('wopr-session',item.id);
     location.reload();
    };
    row.append(label,open);historyBody.append(row);
   }
   if(!historyBody.children.length)historyBody.textContent='NO SAVED SESSIONS';
  }catch(err){historyBody.textContent='DATABASE ERROR: '+err.message}
 };
 // STOP is implemented by visual-polish.js, cancelling the active chat fetch.

 // The original Raspberry version animates the maps while WOPR is thinking.
 // This overlay runs over the existing renderer, without altering launch/abort simulations.
 const originalDraw=window.drawMap;
 // Three independent theaters; every route has endpoints inside its theater.
 const theaters={
  'map-global':{west:[[-122,38],[-117,34],[-104,40],[-97,33],[-86,39],[-75,41],[-149,61]],east:[[-74,40],[-83,34],[-95,38],[-112,47],[-121,38],[-80,26],[-100,52]]},
  'map-atlantic':{west:[[-122,38],[-95,40],[-76,41],[-88,34],[-118,47],[14,51],[35,55]],east:[[37,55],[54,53],[15,49],[74,55],[-82,39],[-99,41],[120,38]]},
  'map-pacific':{west:[[31,55],[40,51],[57,56],[77,55],[101,49],[117,40],[135,36]],east:[[37,55],[67,51],[90,55],[116,39],[131,44],[48,48],[76,44]]}
 };
 const colors=['#a7faff','#ffe1a6','#ff9eb9','#c4ff91','#d9b5ff','#ffffff','#ffb66b'];
 const active={on:false,last:0,tracks:[],next:0};
 function xy(lon,lat,v,w,h){
  const dx=((lon-v.center+540)%360)-180;
  return [w*(.5+dx/v.span),h*(v.id==='map-atlantic'?.64-lat*.0041:v.id==='map-global'?1.03-lat*.0097:1.02-lat*.0093)];
 }
 function choose(a){return a[Math.floor(Math.random()*a.length)]}
 function launchTrack(id,now){
  const t=theaters[id];if(!t)return;
  let a,b,tries=0;
  do{a=choose(t.west);b=choose(t.east);tries++}
  while(tries<25 && Math.abs(a[0]-b[0])<8 && Math.abs(a[1]-b[1])<4);
  const v=views.find(v=>v.id===id);
  const w=document.getElementById(id).clientWidth||500;
  // Some routes may be partially off-screen: reject them and retry on next spawn.
  if(Math.abs(xy(a[0],a[1],v,w,400)[0]-xy(b[0],b[1],v,w,400)[0])>w*.84)return;
  active.tracks.push({id,a,b,start:now,duration:2200+Math.random()*3000,
   height:24+Math.random()*58,color:choose(colors),impact:700+Math.random()*700});
 }
 function overlay(v,now){
  const canvas=document.getElementById(v.id);if(!canvas)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  const g=canvas.getContext('2d'),dpr=canvas.width/w;
  g.save();g.setTransform(dpr,0,0,dpr,0,0);
  for(const m of active.tracks){if(m.id!==v.id)continue;
   const age=now-m.start,progress=Math.min(1,Math.max(0,age/m.duration));
   const a=xy(...m.a,v,w,h),b=xy(...m.b,v,w,h);
   const curve=p=>[a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p-Math.sin(Math.PI*p)*m.height];
   const steps=60;g.beginPath();
   for(let k=0;k<=Math.ceil(progress*steps);k++){
    const p=Math.min(progress,k/steps),q=curve(p);if(k===0)g.moveTo(...q);else g.lineTo(...q);
   }
   const fade=age>m.duration?Math.max(0,1-(age-m.duration)/m.impact):1;
   g.globalAlpha=fade*.88;g.strokeStyle=m.color;g.lineWidth=1.4+Math.random()*.25;
   g.shadowColor=m.color;g.shadowBlur=8;g.stroke();
   if(age<m.duration){const q=curve(progress);g.globalAlpha=1;g.fillStyle='#fff';g.beginPath();g.arc(...q,2.3,0,Math.PI*2);g.fill()}
   else { // Impact starts only when the missile has reached the target.
    const p=Math.min(1,(age-m.duration)/m.impact);
    g.shadowColor='#fff';g.shadowBlur=15;
    for(const [size,opacity] of [[1,.13],[.72,.27],[.45,.5],[.22,1]]){
     g.globalAlpha=(1-p)*opacity;g.fillStyle='#fff';g.beginPath();g.arc(...b,(4+p*23)*size,0,Math.PI*2);g.fill();
    }
   }
  }
  g.restore();
 }
 if(typeof originalDraw==='function'){
  window.drawMap=function(v,now){originalDraw(v,now);overlay(v,now)};
 }
 // Spawn independently in each window; never use the global map as a single route source.
 const routeTimer=setInterval(()=>{
  const now=performance.now();
  const processing=$('ai-state').textContent.trim()!=='STANDBY';
  if(processing&&!active.on){active.on=true;active.next=now}
  if(!processing&&active.on){active.on=false;active.last=now}
  if(active.on&&now>=active.next){
   for(const id of Object.keys(theaters))launchTrack(id,now);
   active.next=now+600+Math.random()*850;
  }
  active.tracks=active.tracks.filter(t=>now<t.start+t.duration+t.impact);
  if(!active.on&&now-active.last>2500)active.tracks=[];
 },90);
 const monitor=setInterval(()=>{
  const state=$('ai-state').textContent.trim();
  const processing=state!=='STANDBY';
  const now=performance.now();
  if(processing&&!active.on){active.on=true;active.start=now;}
  if(!processing&&active.on){active.on=false;active.last=now;}
  const labels=document.querySelectorAll('.map-panel .sim-label');
  labels.forEach(el=>{
   if(processing){el.textContent='● SIMULATION ACTIVE / AI ANALYSIS';el.style.color='#e27383'}
   else if($('state').textContent.trim()!=='SIMULATING'){el.textContent='● STANDBY';el.style.color='#63eea7'}
  });
 },100);
})();
