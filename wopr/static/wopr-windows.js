(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let totalIn=0,totalOut=0,requests=0;
 window.woprRecordTokens=stats=>{
  const n=Number(stats.prompt_eval_count)||0,o=Number(stats.eval_count)||0;
  totalIn+=n;totalOut+=o;requests++;
  const secs=(Number(stats.eval_duration)||0)/1e9;
  $('tok-in').textContent=totalIn.toLocaleString('it-IT');$('tok-out').textContent=totalOut.toLocaleString('it-IT');
  $('tok-total').textContent=(totalIn+totalOut).toLocaleString('it-IT');
  $('tok-speed').textContent=(secs>0?(o/secs).toFixed(1):'0.0')+' tok/s';
  $('tok-requests').textContent=String(requests);$('tok-last').textContent=String(n+o)+' tokens';
 };
 async function poll(){try{const r=await fetch('/api/system',{cache:'no-store'}),d=await r.json(),m=d.host_metrics;
  if(!m){$('hw-cpu').textContent='HOST AGENT OFF';return;}
  $('hw-cpu').textContent=m.cpu_percent==null?'—':m.cpu_percent+'%';
  $('hw-ram').textContent=m.ram_used_gb==null?'—':m.ram_used_gb+' / '+m.ram_total_gb+' GB';
  $('hw-gpu').textContent=m.gpu_percent==null?'—':m.gpu_percent+'%';
  $('hw-temp').textContent=m.gpu_temp_c==null?'—':m.gpu_temp_c+'°C';
  $('hw-vram').textContent=m.vram_used_mb==null?'—':m.vram_used_mb+' / '+m.vram_total_mb+' MB';
  $('hw-name').textContent=m.gpu_name||'—';
  if(m.hostname)$('host').textContent='HOST: '+m.hostname;
  if(m.ram_total_gb)$('ram').textContent='MEMORY: '+m.ram_total_gb+' GB';
 }catch(e){$('hw-cpu').textContent='METRICS OFFLINE'}}
 poll();setInterval(poll,5000);
})();
