/* Enhanced strategic displays, keeping original simulation, backend and controls. */
(function(){
const oldDraw=drawMap;
const sites=[['NORAD',-104.8,38.9],['THULE',-68.7,76.5],['LONDON',-.12,51.5],['MOSCOW',37.6,55.8],['TOKYO',139.7,35.7],['PEARL HARBOR',-157.8,21.3],['VLADIVOSTOK',131.9,43.1],['ALASKA',-149.9,61.2]];
const sectors={'map-global':'GLOBAL DEFENSE NETWORK','map-atlantic':'NORTH ATLANTIC / EARLY WARNING','map-pacific':'PACIFIC / SATELLITE TRACKING'};
let last=0;
drawMap=function(v,now){
 oldDraw(v,now);
 const c=document.getElementById(v.id),g=c.getContext('2d'),dpr=window.devicePixelRatio||1;
 const w=c.width/dpr,h=c.height/dpr;if(!w||!h)return;
 g.save();g.scale(dpr,dpr);
 // Dim radar range circles, tracking crosshairs and rotating radar sweep.
 const cx=w*.51,cy=h*.51,r=Math.min(w*.39,h*.43);
 g.strokeStyle='rgba(61,195,147,.17)';g.lineWidth=.8;
 for(let i=1;i<=4;i++){g.beginPath();g.arc(cx,cy,r*i/4,0,Math.PI*2);g.stroke()}
 g.beginPath();g.moveTo(cx-r-12,cy);g.lineTo(cx+r+12,cy);g.moveTo(cx,cy-r-12);g.lineTo(cx,cy+r+12);g.stroke();
 const angle=(now*.00028)%(Math.PI*2);
 g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,r,angle-.20,angle);g.closePath();g.fillStyle='rgba(45,190,132,.055)';g.fill();
 g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r);g.strokeStyle='rgba(75,235,164,.34)';g.stroke();
 for(const [name,lon,lat] of sites){const [x,y]=project(lon,lat,v,w,h);if(x<8||x>w-8||y<20||y>h-12)continue;
 g.strokeStyle='rgba(116,236,171,.55)';g.beginPath();g.arc(x,y,4,0,Math.PI*2);g.moveTo(x-8,y);g.lineTo(x-3,y);g.moveTo(x+3,y);g.lineTo(x+8,y);g.stroke();
 g.font='9px Consolas,monospace';g.fillStyle='#9bd8ac';g.fillText(name,x+9,y+12)}
 // Instrument overlay: grid references, scan line and bottom legend.
 g.fillStyle='rgba(1,12,12,.83)';g.fillRect(0,0,w,24);g.fillRect(0,h-23,w,23);
 g.font='bold 10px Consolas,monospace';g.fillStyle='#d1ae70';g.fillText(sectors[v.id]||'TRACKING',11,16);
 g.textAlign='right';g.fillStyle='#85cba9';g.fillText('RADAR ACTIVE  •  '+String(Math.floor(now/1000)%1000).padStart(3,'0'),w-10,16);
 g.textAlign='left';g.fillStyle='#8cae98';g.font='9px Consolas,monospace';g.fillText('GRID REF: '+(v.center===0?'WORLD':v.center<0?'ATL':'PAC')+'   |   SIMULATED TRACKING',10,h-8);
 g.textAlign='right';g.fillText('WOPR / NORAD',w-10,h-8);g.textAlign='left';
 if(running){g.font='bold 12px Consolas,monospace';g.fillStyle='#f1ad65';g.fillText('● EXERCISE IN PROGRESS',13,42)}
 g.restore();last=now;
};
})();
