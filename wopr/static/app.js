'use strict';
const $=id=>document.getElementById(id); const session=localStorage.getItem('wopr-session')||crypto.randomUUID();localStorage.setItem('wopr-session',session);
const worlds={
 northAmerica:[[-168,65],[-150,70],[-135,60],[-125,49],[-124,42],[-117,32],[-110,30],[-105,25],[-97,26],[-92,29],[-82,25],[-80,30],[-75,35],[-70,44],[-60,47],[-53,52],[-60,60],[-75,62],[-85,70],[-105,73],[-130,72],[-150,68]],
 southAmerica:[[-81,12],[-75,10],[-72,5],[-60,9],[-50,3],[-47,-5],[-35,-9],[-38,-18],[-44,-23],[-48,-29],[-53,-33],[-57,-39],[-67,-55],[-74,-51],[-73,-40],[-71,-29],[-76,-16],[-80,-4]],
 europeAsia:[[-11,36],[-10,44],[-6,50],[2,51],[9,54],[14,58],[22,60],[28,70],[40,70],[52,63],[65,68],[83,73],[110,72],[130,68],[150,60],[170,63],[180,65],[180,45],[155,48],[142,42],[137,35],[127,38],[122,30],[115,23],[109,18],[104,9],[100,3],[105,-6],[114,-8],[120,-4],[125,5],[134,-3],[140,-9],[145,-18],[135,-14],[125,-8],[118,0],[111,9],[107,16],[101,20],[98,15],[92,21],[88,22],[82,8],[77,8],[72,20],[68,24],[62,25],[57,20],[51,13],[45,12],[42,19],[36,30],[32,31],[28,41],[23,39],[15,43],[10,37],[0,36]],
 africa:[[-17,36],[-7,37],[10,37],[24,32],[32,31],[35,23],[43,12],[51,11],[49,2],[42,-11],[36,-20],[33,-27],[27,-34],[19,-35],[12,-29],[11,-18],[8,-5],[2,5],[-7,5],[-16,13],[-17,24]],
 australia:[[113,-22],[115,-34],[129,-35],[138,-38],[149,-37],[153,-28],[145,-17],[137,-12],[126,-13],[117,-18]],
 greenland:[[-52,60],[-43,60],[-39,68],[-41,78],[-49,82],[-60,78],[-59,70]],
 japan:[[130,31],[134,34],[137,36],[140,40],[144,44],[145,42],[141,35],[137,33]],
 britain:[[-8,50],[-4,51],[-3,55],[-5,58],[-1,57],[1,53]],
 madagascar:[[49,-12],[50,-19],[46,-26],[44,-23],[46,-15]]};
let landPolygons=[];fetch('/land.json').then(r=>r.json()).then(d=>{landPolygons=d}).catch(()=>{});
const cities={Washington:[-77,39],Moscow:[37.6,55.8],London:[-0.1,51.5],Beijing:[116.4,39.9],Tokyo:[139.7,35.7],Paris:[2.35,48.85],LosAngeles:[-118.2,34],NewYork:[-74,40.7],Hawaii:[-157.8,21.3],Sydney:[151.2,-33.9],Rome:[12.5,41.9],Seoul:[127,37.6],Anchorage:[-149.9,61.2],SanFrancisco:[-122.4,37.8]};
const scenes={cold:[['Moscow','Washington'],['Washington','Moscow'],['Beijing','LosAngeles'],['London','Moscow']],atlantic:[['Washington','London'],['Moscow','NewYork'],['London','Moscow'],['Paris','Washington']],pacific:[['Beijing','Hawaii'],['Tokyo','LosAngeles'],['Hawaii','Tokyo'],['Sydney','Beijing']],global:[['Moscow','Washington'],['Washington','Moscow'],['Beijing','LosAngeles'],['London','Moscow'],['Tokyo','SanFrancisco'],['Hawaii','Tokyo'],['Paris','Beijing'],['Anchorage','Moscow'],['Sydney','Beijing'],['Rome','Moscow']]};
let missiles=[],explosions=[],running=false,start=0,events=0,lastLaunch=0,scenario='cold',animation=0;
const views=[{id:'map-global',center:0,span:360},{id:'map-atlantic',center:-35,span:155},{id:'map-pacific',center:175,span:175}];
function project(lon,lat,v,w,h){let dx=((lon-v.center+540)%360)-180;return [w*(.5+dx/v.span),h*(.5-(lat/180)*1.8)];}
function drawMap(v,now){const c=$(v.id),rect=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=rect.width,h=rect.height;if(!w||!h)return;c.width=Math.floor(w*dpr);c.height=Math.floor(h*dpr);let g=c.getContext('2d');g.scale(dpr,dpr);g.fillStyle='#061014';g.fillRect(0,0,w,h);
 g.strokeStyle='#173b3c';g.lineWidth=.7;for(let lat=-75;lat<=75;lat+=15){let y=project(0,lat,v,w,h)[1];g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}for(let lon=-180;lon<=180;lon+=15){let x=project(lon,0,v,w,h)[0];if(x>=0&&x<=w){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}}
 for(const coords of landPolygons){
  for(const shift of [-360,0,360]){
   let started=false,prevX=0;g.beginPath();
   for(const [lon,lat] of coords){const [px,py]=project(lon,lat,v,w,h),x=px+shift*w*360/v.span;
    if(!started||Math.abs(x-prevX)>w*.7){g.moveTo(x,py);started=true}else g.lineTo(x,py);prevX=x;
   }
   g.closePath();g.fillStyle='#0a211b';g.strokeStyle='#468c69';g.lineWidth=.65;g.fill();g.stroke();
  }
 }
 for(let [name,p] of Object.entries(cities)){let [x,y]=project(...p,v,w,h);if(x<0||x>w||y<0||y>h)continue;g.fillStyle='#c2b475';g.fillRect(x-1,y-1,3,3);if(w>320){g.font='8px monospace';g.fillStyle='#a6a878';g.fillText(name.toUpperCase().slice(0,10),x+5,y-4)}}
 for(let m of missiles){let a=project(...cities[m.from],v,w,h),b=project(...cities[m.to],v,w,h);let dx=b[0]-a[0];if(Math.abs(dx)>w*.8)continue;let t=Math.min(1,(now-m.t)/m.duration);if(t<0)continue;let curve=p=>{let x=a[0]+dx*p,y=a[1]+(b[1]-a[1])*p-Math.sin(Math.PI*p)*Math.min(90,Math.abs(dx)*.28);return [x,y]};g.beginPath();for(let k=0;k<=40*t;k++){let p=k/40,[x,y]=curve(p);if(k===0)g.moveTo(x,y);else g.lineTo(x,y)}g.strokeStyle='#f6b45e';g.lineWidth=1.5;g.shadowColor='#ef8b35';g.shadowBlur=8;g.stroke();g.shadowBlur=0;let [x,y]=curve(t);g.fillStyle='#ffda8b';g.beginPath();g.arc(x,y,2.6,0,Math.PI*2);g.fill()}
 for(let e of explosions){let [x,y]=project(...cities[e.city],v,w,h),p=(now-e.t)/1700;if(p<0||p>1)continue;for(let k=0;k<3;k++){g.beginPath();g.arc(x,y,Math.max(0,(p-k*.13))*38,0,Math.PI*2);g.strokeStyle=`rgba(255,${125+k*32},65,${(1-p)*.8})`;g.lineWidth=2;g.stroke()}}
 g.fillStyle='#73a8a0';g.font='10px monospace';g.fillText(`${v.center===0?'WORLD':v.center<0?'ATLANTIC':'PACIFIC'} // ${new Date().toISOString().slice(11,19)} Z`,10,16);
}
function spawn(now){const list=scenes[scenario],pair=list[Math.floor(Math.random()*list.length)];missiles.push({from:pair[0],to:pair[1],t:now,duration:2500+Math.random()*2000});}
function frame(now){if(running){if(now-lastLaunch>750){spawn(now);lastLaunch=now}for(let m of missiles){if(!m.hit&&now-m.t>=m.duration){m.hit=true;explosions.push({city:m.to,t:now});events++}}missiles=missiles.filter(m=>now-m.t<m.duration+200);explosions=explosions.filter(e=>now-e.t<1800);if(now-start>38000){stopSimulation('SIMULATION COMPLETE')}}for(let v of views)drawMap(v,now);$('tracks').textContent=String(missiles.length).padStart(3,'0');$('events').textContent=String(events).padStart(3,'0');for(let [id] of [['global-count'],['atlantic-count'],['pacific-count']])$(id).textContent=`${missiles.length} TRACKS`;animation=requestAnimationFrame(frame)}
function stopSimulation(state='STANDBY'){running=false;$('state').textContent=state;$('response').textContent='PASSIVE';$('global-tag').textContent='TRACKING';$('defcon').textContent='5';$('alert-label').textContent='NORMAL READINESS';$('threat').textContent='LOW'}
$('launch').onclick=()=>{scenario=$('scenario').value;running=true;start=performance.now();lastLaunch=0;events=0;missiles=[];explosions=[];$('state').textContent='SIMULATING';$('response').textContent='ANALYZING';$('global-tag').textContent='SIMULATION';$('defcon').textContent=scenario==='global'?'1':'3';$('alert-label').textContent='EXERCISE IN PROGRESS';$('threat').textContent='SIMULATED';terminalLine('system','GLOBAL THERMONUCLEAR WAR // '+$('scenario').selectedOptions[0].text+' // SIMULATION ONLY')};$('stop').onclick=()=>stopSimulation('ABORTED');$('reset').onclick=()=>{stopSimulation();missiles=[];explosions=[];events=0};requestAnimationFrame(frame);
function terminalLine(cls,text){const d=document.createElement('div');d.className='line '+cls;d.textContent=text;$('terminal').appendChild(d);$('terminal').scrollTop=$('terminal').scrollHeight;return d}
async function refreshModels(){
 try{
  const selected=$('model').value||localStorage.getItem('wopr-selected-model')||'';
  const r=await fetch('/api/models',{cache:'no-store'}),d=await r.json();
  if(!r.ok)throw Error('Models HTTP '+r.status);
  const models=Array.isArray(d.models)?d.models:[];
  // Do not reset the selected model on the 60-second refresh.
  const existing=Array.from($('model').options).map(o=>o.value);
  if(JSON.stringify(existing)!==JSON.stringify(models)){
   $('model').replaceChildren();
   for(const m of models){const o=document.createElement('option');o.value=o.textContent=m;$('model').append(o)}
   if(!models.length){const o=document.createElement('option');o.value='';o.textContent='NO MODELS';$('model').append(o)}
  }
  if(models.includes(selected))$('model').value=selected;
  $('ollama-status').textContent=d.online?'OLLAMA: CONNECTED':'OLLAMA: OFFLINE';
  $('ollama-status').style.color=d.online?'#8fe1aa':'#ee705b';
  $('active-model').textContent='MODEL: '+($('model').value||'—');
 }catch(e){$('ollama-status').textContent='OLLAMA: ERROR'}
}
$('model').onchange=()=>{localStorage.setItem('wopr-selected-model',$('model').value);$('active-model').textContent='MODEL: '+$('model').value};
refreshModels();setInterval(refreshModels,60000);
fetch('/api/system').then(r=>r.json()).then(d=>{$('host').textContent='HOST: '+d.hostname;$('arch').textContent='ARCH: '+d.architecture;$('ram').textContent='MEMORY: '+(d.memory_mb.MemTotal||'?')+' MB'}).catch(()=>{});
fetch('/api/history?session='+encodeURIComponent(session)).then(r=>r.json()).then(d=>{for(let m of d.messages)terminalLine(m.role,m.role==='user'?'> '+m.content:m.content)}).catch(()=>{});
// SSE and CRT teleprinter: preserve every received character until displayed.
const WOPR_TYPE_CPS=125;
function createTeleprinter(target){
 let queue='',closed=false,resolveDone;
 const done=new Promise(resolve=>resolveDone=resolve);
 let last=performance.now(),fraction=0,finishAt=0;
 target.classList.add('wopr-typing');
 const timer=setInterval(()=>{
  const now=performance.now(),elapsed=Math.min(150,now-last);last=now;
  fraction+=elapsed*WOPR_TYPE_CPS/1000;
  // Once Ollama has finished, drain the backlog promptly rather than
  // keeping the chat locked for minutes on a long completion.
  const count=Math.min(queue.length,closed&&now-finishAt>1000?queue.length:Math.floor(fraction));
  if(count){target.textContent+=queue.slice(0,count);queue=queue.slice(count);fraction=Math.max(0,fraction-count);$('terminal').scrollTop=$('terminal').scrollHeight}
  if(closed&&!queue.length){clearInterval(timer);target.classList.remove('wopr-typing');resolveDone()}
 },25);
 return {push:text=>{if(!closed)queue+=String(text)},finish:()=>{closed=true;finishAt=performance.now();return done},cancel:()=>{closed=true;queue='';return done}};
}
let busy=false,chatController=null;
$('chat-form').onsubmit=async e=>{
 e.preventDefault();if(busy)return;
 const message=$('prompt').value.trim(),model=$('model').value;
 if(!message||!model)return;
 $('prompt').value='';terminalLine('user','> '+message);
 const target=terminalLine('assistant',''),printer=createTeleprinter(target);
 const controller=new AbortController();chatController=controller;
 busy=true;$('send').disabled=true;$('ai-state').textContent='ANALYZING';$('core-status').textContent='PROCESSING';
 let received=false,serverDone=false,doneReason='',stopped=false;
 const loading=setInterval(()=>$('loadbar').style.width=(20+Math.floor(Math.random()*70))+'%',160);
 try{
  let options={};try{options=JSON.parse(localStorage.getItem('wopr-ollama-config')||'{}')}catch{}
  const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({message,model,session,options})});
  if(!r.ok){let x={};try{x=await r.json()}catch{}throw Error(x.error||'HTTP '+r.status)}
  if(!r.body)throw Error('Streaming non disponibile');
  const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
  const consume=block=>{
   const line=block.split('\n').find(x=>x.startsWith('data:'));
   if(!line)return;
   let d;try{d=JSON.parse(line.slice(5).trim())}catch{return}
   if(typeof d.token==='string'&&d.token){received=true;printer.push(d.token);$('ai-state').textContent='RECEIVING DATA'}
   if(Array.isArray(d.needle_actions)){
    for(const action of d.needle_actions){
     if(action.action==="activate_defcon"){
      const level=Number(action.level);
      if(Number.isInteger(level)&&level>=1&&level<=5){
       $("defcon").textContent=String(level);
       document.querySelector(".status-panel").setAttribute("data-defcon",String(level));
       $("alert-label").textContent="DEFCON "+level+" - SIMULATION";
       $("threat").textContent="SIMULATED";
      }
     }
    }
   }
   if(d.stats){if(window.woprRecordTokens)window.woprRecordTokens(d.stats);if(d.done_reason)doneReason=d.done_reason}
   if(d.done_reason)doneReason=d.done_reason;
   if(d.error)throw Error(d.error);
   if(d.done)serverDone=true;
  };
  while(true){
   const {done,value}=await reader.read();if(done)break;
   buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
   const blocks=buffer.split('\n\n');buffer=blocks.pop();
   for(const block of blocks)consume(block);
   if(!received&&!serverDone)$('ai-state').textContent='ANALYZING / WAITING FOR OUTPUT';
  }
  buffer+=decoder.decode();if(buffer.trim())consume(buffer);
  if(!serverDone)printer.push('\n[WOPR: STREAM TERMINATED WITHOUT COMPLETION]');
  else if(doneReason==='length')printer.push('\n[WOPR: OUTPUT TOKEN LIMIT REACHED]');
  else if(!received)printer.push('\n[WOPR: MODEL RETURNED NO VISIBLE TEXT]');
 }catch(err){stopped=err.name==='AbortError';if(stopped)printer.push('\n[WOPR: REQUEST INTERRUPTED]');else printer.push('\n[WOPR ERROR: '+err.message+']')}
 finally{
  await printer.finish();clearInterval(loading);$('loadbar').style.width='8%';
  busy=false;chatController=null;$('send').disabled=false;
  $('ai-state').textContent=stopped?'INTERRUPTED':'STANDBY';$('core-status').textContent='SYSTEM READY';$('prompt').focus();
 }
};
// STOP button belongs to the simulation; keep its existing behavior.
$('clear').onclick=async()=>{if(!confirm('Cancellare la cronologia di questa sessione?'))return;await fetch('/api/history/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session})});$('terminal').replaceChildren();terminalLine('system','WOPR TERMINAL RESET')};
function clock(){let d=new Date();$('clock').textContent=d.toISOString().slice(0,19).replace('T',' ')+' Z'}clock();setInterval(clock,1000);
// Tic-tac-toe with perfect minimax AI and automated demonstration.
let board=Array(9).fill(''),gameOver=false,demo=false,demoTimer=null;
function winner(b){for(let [a,c,d] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a];return b.every(Boolean)?'DRAW':null}
function minimax(b,turn,depth){let w=winner(b);if(w)return {score:w==='O'?10-depth:w==='X'?depth-10:0};let best={score:turn==='O'?-Infinity:Infinity,index:-1};for(let i=0;i<9;i++){if(b[i])continue;b[i]=turn;let s=minimax(b,turn==='O'?'X':'O',depth+1).score;b[i]='';if((turn==='O'&&s>best.score)||(turn==='X'&&s<best.score))best={score:s,index:i}}return best}
function paint(){const el=$('board');el.replaceChildren();board.forEach((v,i)=>{let b=document.createElement('button');b.textContent=v;b.className=v.toLowerCase();b.disabled=!!v||gameOver||demo;b.onclick=()=>move(i,'X');el.appendChild(b)});let w=winner(board);$('game-message').textContent=w?(w==='DRAW'?'A STRANGE GAME. THE ONLY WINNING MOVE IS NOT TO PLAY.':w+' WINS'):(demo?'DEMONSTRATION / SELF PLAY':'YOUR MOVE / X')}
function move(i,player){if(board[i]||gameOver)return;board[i]=player;let w=winner(board);gameOver=!!w;paint();if(!gameOver&&!demo&&player==='X')setTimeout(()=>{let n=minimax(board,'O',0).index;if(n>=0)move(n,'O')},180)}
function newGame(){board=Array(9).fill('');gameOver=false;paint()}$('newgame').onclick=()=>newGame();$('demo').onclick=()=>{demo=!demo;$('demo').textContent='DEMO: '+(demo?'ON':'OFF');if(demo){newGame();demoTimer=setInterval(()=>{if(gameOver)newGame();let turn=board.filter(Boolean).length%2?'O':'X',n=minimax(board,turn,0).index;if(n>=0)move(n,turn)},650)}else{clearInterval(demoTimer);newGame()}};newGame();
