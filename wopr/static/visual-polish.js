(() => {
'use strict';
const $=id=>document.getElementById(id);
const pct=(n)=>Math.max(0,Math.min(100,Number(n)||0));
const put=(id,v)=>{const e=$(id);if(e)e.textContent=v};
const bar=(id,n)=>{const e=$(id);if(e)e.style.width=pct(n)+'%'};
const nfmt=(n)=>Number(n||0).toLocaleString('it-IT');
let activeSince=0, baseline=0;
const term=$('terminal');
const form=$('chat-form');
form.addEventListener('submit',()=>{
 if($('send').disabled||!$('prompt').value.trim())return;
 activeSince=performance.now();
 baseline=term.textContent.length;
},true);
function activity(){
 const state=$('ai-state').textContent.trim();
 const active=state!=='STANDBY' && activeSince>0;
 put('phase-live',active?'RECEIVING DATA...':state);
 if(active){
  const secs=Math.max(.01,(performance.now()-activeSince)/1000);
  const chars=Math.max(0,term.textContent.length-baseline);
  const approx=Math.max(0,Math.floor(chars/4));
  put('live-tokens','~'+nfmt(approx));
  put('elapsed-live',secs.toFixed(1)+' s');
  put('speed-live',(approx/secs).toFixed(1)+' T/S');
 }else if(activeSince){
  activeSince=0;
 }
}
setInterval(activity,250);
let lastMetrics=null;
async function refreshHardware(){
 try{
  const r=await fetch('/api/system',{cache:'no-store'});
  if(!r.ok)throw Error(r.status);
  const d=await r.json(),m=d.host_metrics;
  if(!m)return;
  lastMetrics=m;
  bar('cpu-bar',m.cpu_percent);bar('gpu-bar',m.gpu_percent);
  put('cpu-bar-label',m.cpu_percent+'%');put('gpu-bar-label',m.gpu_percent+'%');
  const total=Number(m.ram_total_gb)||0,used=Number(m.ram_used_gb)||0;
  const available=Math.max(0,total-used);
  put('mem-total',total.toFixed(2)+' GB');
  put('mem-used',used.toFixed(2)+' GB');
  put('mem-available',available.toFixed(2)+' GB');
  bar('ram-bar',total?used/total*100:0);
  put('core-status','HOST '+(m.hostname||'WINDOWS')+' / TELEMETRY ONLINE');
 }catch(e){/* Retain the existing backend polling status */ }
}
refreshHardware();setInterval(refreshHardware,5000);
// Preserve completed token statistics when refreshing the preview.
const storeKey='wopr-stats-v2';
let totals={in:0,out:0,requests:0,last:0,speed:0};
try{const parsed=JSON.parse(sessionStorage.getItem(storeKey)||'null');if(parsed&&typeof parsed==='object')totals={...totals,...parsed}}catch(e){}
function paintTotals(){
 put('tok-in',nfmt(totals.in));put('tok-out',nfmt(totals.out));
 put('tok-total',nfmt(totals.in+totals.out));put('tok-speed',totals.speed.toFixed(1)+' tok/s');
 put('tok-requests',nfmt(totals.requests));put('tok-last',nfmt(totals.last)+' tokens');
}
paintTotals();
window.woprRecordTokens=(stats)=>{
 const i=Number(stats.prompt_eval_count)||0,o=Number(stats.eval_count)||0;
 totals.in+=i;totals.out+=o;totals.requests++;
 totals.last=i+o;
 const secs=(Number(stats.eval_duration)||0)/1e9;
 totals.speed=secs>0?o/secs:0;
 sessionStorage.setItem(storeKey,JSON.stringify(totals));paintTotals();
 put('live-tokens',nfmt(o));put('speed-live',totals.speed.toFixed(1)+' T/S');
};
// STOP cancels only the currently active Ollama request, not the missile simulation.
const nativeFetch=window.fetch.bind(window);
let activeChatController=null;
window.fetch=(resource,options={})=>{
 const url=typeof resource==='string'?resource:resource&&resource.url||'';
 if(!url.includes('/api/chat'))return nativeFetch(resource,options);
 const controller=new AbortController();activeChatController=controller;
 return nativeFetch(resource,{...options,signal:controller.signal});
};
$('stop-chat').onclick=()=>{
 if(activeChatController && $('ai-state').textContent!=='STANDBY'){
  activeChatController.abort();
  activeChatController=null;
  put('phase-live','INTERRUPTED');
 }else{
  put('phase-live','NO ACTIVE CHAT');
 }
};
// HISTORY opens a read-only session view; CLR retains the existing delete-with-confirmation.
$('history-view').onclick=async()=>{
 const sid=localStorage.getItem('wopr-session');
 if(!sid)return;
 try{
  const r=await nativeFetch('/api/history?session='+encodeURIComponent(sid));
  const data=await r.json();
  const dialog=document.createElement('dialog');dialog.className='history-dialog';
  const head=document.createElement('div');head.className='history-head';
  const label=document.createElement('b');label.textContent='WOPR / SESSION HISTORY';
  const close=document.createElement('button');close.textContent='CLOSE';close.onclick=()=>dialog.close();
  head.append(label,close);dialog.append(head);
  const body=document.createElement('div');body.className='history-content';
  for(const m of data.messages||[]){
   const line=document.createElement('p');
   const role=document.createElement('b');role.textContent=m.role==='user'?'OPERATOR: ':'WOPR: ';
   line.append(role,document.createTextNode(m.content));body.append(line);
  }
  if(!body.children.length)body.textContent='NO MESSAGES IN THIS SESSION';
  dialog.append(body);document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.remove());
  dialog.showModal();
 }catch(e){alert('History unavailable: '+e.message)}
};
})();