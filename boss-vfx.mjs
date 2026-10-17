// Procedural combat VFX. Deterministic geometry, bounded particles, no full-screen flashes.
export function drawBossVfx(g,e,ox,oy){
  const k=Math.max(0,Math.min(1,e.t/e.life)),x=e.x+ox,y=e.y+oy,color=e.color??'#b991ff';g.save();
  g.globalAlpha=1-k;g.strokeStyle=color;g.fillStyle=color;g.lineWidth=2;
  if(e.kind==='bossTrail'){
    g.globalAlpha=(1-k)*.3;g.beginPath();g.ellipse(x,y,e.r*(1+k),e.r*.5,0,0,Math.PI*2);g.fill();
  }else if(e.kind==='bossImpact'){
    const h=110+e.rank*7,beam=g.createLinearGradient(x,y-h,x,y);beam.addColorStop(0,'#ffffff00');beam.addColorStop(.5,color);beam.addColorStop(1,'#fff6db');
    g.fillStyle=beam;g.fillRect(x-e.r*(1-k)*.65,y-h*(1-k),e.r*(1-k)*1.3,h*(1-k));
    g.strokeStyle='#fff1cb';g.lineWidth=3;g.beginPath();g.arc(x,y,e.r*(.55+k*.45),0,Math.PI*2);g.stroke();
    for(let i=0;i<12;i++){const a=i*Math.PI/6,d=e.r*(.2+k);g.fillStyle=i%2?color:'#fff3c2';g.fillRect(Math.round(x+Math.cos(a)*d),Math.round(y+Math.sin(a)*d-k*35),4,6);}
  }else{
    const radius=22+(e.rank??1)*3+k*65;g.globalCompositeOperation='lighter';
    for(let ring=0;ring<2;ring++){g.beginPath();g.arc(x,y,radius*(ring?.65:1),k*2+ring,k*2+ring+Math.PI*1.6);g.stroke();}
    const n=8+Math.min(7,e.rank??1)*2;
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2,d=radius*(.5+k*.7);g.beginPath();g.moveTo(x+Math.cos(a)*d,y+Math.sin(a)*d);g.lineTo(x+Math.cos(a)*(d+12*(1-k)),y+Math.sin(a)*(d+12*(1-k)));g.stroke();}
    g.fillStyle='#fff4d3';g.globalAlpha=(1-k)*.65;g.beginPath();g.arc(x,y,Math.max(1,18*(1-k)),0,Math.PI*2);g.fill();
  }
  g.restore();
}
