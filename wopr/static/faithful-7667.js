
'use strict';
/* Visual adapter: no API or chat changes. Replaces canvas drawing, retains simulation data. */
(function(){
const north=views[0],global=views[1],soviet=views[2];
// Reference Raspberry framing: compressed latitude scale, identical for all three maps.
north.center=-105;north.span=128;
global.center=0;global.span=360;
soviet.center=74;soviet.span=145;
const rand=(n)=>{let x=Math.sin(n*127.1+78.233)*43758.5453;return x-Math.floor(x)};
// Fixed pseudo-random points clustered around simulated strategic corridors.
const sites=[];
const clusters=[
 [-122,40,14,9,95],[-97,39,18,11,115],[-78,39,11,10,65],[-150,62,10,6,24],
 [-4,53,13,7,80],[19,51,15,9,105],[42,55,17,10,115],[77,55,24,9,100],
 [114,40,21,12,75],[140,38,10,9,35]
];
let siteIndex=0;
for(const [cx,cy,rx,ry,count] of clusters){
 for(let j=0;j<count;j++){
  const k=siteIndex++,a=rand(k+91)*Math.PI*2,r=Math.sqrt(rand(k+143));
  sites.push({lon:cx+Math.cos(a)*rx*r,lat:cy+Math.sin(a)*ry*r,
    phase:rand(k+50)*6.28,kind:k%13});
 }
}
function pos(lon,lat,v,w,h){
 const delta=((lon-v.center+540)%360)-180;
 return [w*(.5+delta/v.span),h*(v===global ? .64-lat*.0041 : v===north ? 1.03-lat*.0097 : 1.02-lat*.0093)];
}
function trace(g,coords,v,w,h,shift=0){
 let begun=false,prev=0;
 g.beginPath();
 for(let i=0;i<coords.length;i++){
  const pt=coords[i],p=pos(pt[0],pt[1],v,w,h),x=p[0]+shift*w*360/v.span;
  if(!begun||Math.abs(x-prev)>w*.6){g.moveTo(x,p[1]);begun=true}else g.lineTo(x,p[1]);prev=x;
 }
 g.closePath();
}
drawMap=function(v,now){
 const canvas=document.getElementById(v.id),r=canvas.getBoundingClientRect(),w=r.width,h=r.height,dpr=Math.min(2,window.devicePixelRatio||1);
 if(!w||!h)return;
 const cw=Math.round(w*dpr),ch=Math.round(h*dpr);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch}
 const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
 g.fillStyle='#01060e';g.fillRect(0,0,w,h);
 g.lineWidth=.8;g.strokeStyle='#12384a';
 for(let lat=-60;lat<=75;lat+=15){let y=pos(0,lat,v,w,h)[1];g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}
 for(let lon=-180;lon<180;lon+=15){let x=pos(lon,0,v,w,h)[0];if(x<0||x>w)continue;g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke()}
 // Coastlines and borders: actual geographic polygon data bundled in land.json
 g.shadowColor='#06cbb9';g.shadowBlur=2;
 for(const poly of landPolygons){
  for(const shift of [-360,0,360]){
   trace(g,poly,v,w,h,shift);
   g.fillStyle='#010c15';g.fill();
   g.strokeStyle='#1dd3c5';g.lineWidth=1.03;g.stroke();
  }
 }
 g.shadowBlur=0;
 // Dense luminous simulated tracking sites; deterministic, no real military data
 for(const s of sites){
  const [x,y]=pos(s.lon,s.lat,v,w,h);
  if(x<4||x>w-4||y<70||y>h-20)continue;
  const glow=.45+.55*(.5+.5*Math.sin(now*.002+s.phase));
  g.globalAlpha=glow;g.shadowColor=s.kind===0?'#ffffff':'#44d9f8';g.shadowBlur=s.kind===0?14:7;
  g.fillStyle=s.kind===0?'#e7ffff':'#60d9f3';
  g.beginPath();g.arc(x,y,s.kind===0?1.75:.8,0,Math.PI*2);g.fill();
  g.shadowBlur=0;
  if(s.kind===0){g.strokeStyle='#5ad8ff';g.lineWidth=.85;g.strokeRect(x-3,y-3,6,6)}
 }
 g.globalAlpha=1;
 // Fixed subtle radar arcs across the reference regions
 g.strokeStyle='#1d83b055';g.lineWidth=.8;
 const center=pos(v===north?-98:v===soviet?90:0,52,v,w,h);
 for(let radius of [35,70,105]){g.beginPath();g.arc(center[0],center[1],radius,0,Math.PI*2);g.stroke()}
 // Animated simulated missile tracks, driven by the original app's launch/abort buttons
 for(const m of missiles){
  const a=pos(...cities[m.from],v,w,h),b=pos(...cities[m.to],v,w,h);
  if(Math.abs(a[0]-b[0])>w*.8)continue;
  const t=Math.min(1,(now-m.t)/m.duration);if(t<0)continue;
  const curve=p=>[a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p-Math.sin(p*Math.PI)*Math.min(85,Math.abs(b[0]-a[0])*.28)];
  g.beginPath();
  for(let k=0;k<=48*t;k++){let p=k/48,q=curve(p);if(!k)g.moveTo(q[0],q[1]);else g.lineTo(q[0],q[1])}
  const palette=['#9cfaff','#ffd18b','#ffa6b8','#b7ff8b','#c5b2ff','#ffffff'];
  const color=palette[Math.abs((m.from.length*17+m.to.length*29+missiles.indexOf(m)*7))%palette.length];
  g.strokeStyle=color;g.lineWidth=2.0;g.shadowColor=color;g.shadowBlur=10;g.stroke();g.shadowBlur=0;
  let p=curve(t);g.fillStyle='#fff';g.beginPath();g.arc(p[0],p[1],2.2,0,Math.PI*2);g.fill();
 }
 for(const e of explosions){
  const [x,y]=pos(...cities[e.city],v,w,h),p=(now-e.t)/1700;
  if(p<0||p>1)continue;
  const alpha=Math.pow(1-p,.72),radius=4+p*32;
  g.shadowColor='#ffffff';g.shadowBlur=13;
  for(const [scale,opacity] of [[1,.13],[.73,.27],[.48,.44],[.25,.9]]){
   g.globalAlpha=alpha*opacity;g.fillStyle='#fff';
   g.beginPath();g.arc(x,y,radius*scale,0,Math.PI*2);g.fill();
  }
  g.globalAlpha=alpha;g.fillStyle='#fff';
  g.beginPath();g.arc(x,y,Math.max(1.8,4*(1-p)),0,Math.PI*2);g.fill();
  g.globalAlpha=1;g.shadowBlur=0;
 }
};
// Visual controls without deleting conversations or altering existing endpoints
const toolbar=document.querySelector('.terminal-toolbar');
const btn=(id)=>document.getElementById(id);
// Toolbar handlers are installed by wopr-behavior-fix.js.
// On-screen history control keeps existing clear-history behavior, relabel only
const clear=btn('clear');clear.title='Cancella la cronologia della sessione corrente';
function reflectMemory(){
 const cpu=btn('hw-cpu').textContent,ram=btn('hw-ram').textContent;
 const agent=cpu!=='—'&&!cpu.includes('OFF');
 if(!agent)return;
 const s=ram.match(/(\d+(?:\.\d+)?)\s*(?:MB|GB)/i);
 if(s){btn('mem-used').textContent=ram;btn('mem-total').textContent='HOST AGENT';btn('mem-available').textContent='LIVE'}
}
setInterval(reflectMemory,2000);
})();
