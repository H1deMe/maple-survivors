import {regionalPlan,regionalRandom} from './regional-layout.mjs';
const SIZE=256,PIXEL=2,LIMIT=96;
export class RegionalTerrain{
  constructor(){this.tiles=new Map();this.key='';}
  draw(g,id,seed,arrival,left,top,width,height){const p=regionalPlan(id,seed,arrival);if(this.key!==p.key){this.tiles.clear();this.key=p.key;}
    // Neighbouring destinations share the same physical-pixel edge at any zoom/DPR.
    // Separate fractional drawImage rectangles otherwise leave hairline seams.
    const m=g.getTransform(),sx=v=>(Math.round(v*m.a+m.e)-m.e)/m.a,sy=v=>(Math.round(v*m.d+m.f)-m.f)/m.d;
    for(let y=Math.floor(top/SIZE);y<=Math.floor((top+height)/SIZE);y++)for(let x=Math.floor(left/SIZE);x<=Math.floor((left+width)/SIZE);x++){const key=`${x},${y}`;let tile=this.tiles.get(key);if(!tile){tile=this.make(p,x*SIZE,y*SIZE);this.tiles.set(key,tile);if(this.tiles.size>LIMIT)this.tiles.delete(this.tiles.keys().next().value);}const dx=sx(x*SIZE-left),dy=sy(y*SIZE-top);g.drawImage(tile,dx,dy,sx((x+1)*SIZE-left)-dx,sy((y+1)*SIZE-top)-dy);}}
  make(p,left,top){const c=document.createElement('canvas');c.width=c.height=SIZE/PIXEL;const g=c.getContext('2d');g.scale(1/PIXEL,1/PIXEL);g.translate(-left,-top);g.fillStyle=p.ground;g.fillRect(left,top,SIZE,SIZE);
    const paving=['paving','marble'].includes(p.surface),step=paving?48:20;
    // Overscan world-anchored marks: a tuft crossing a tile edge belongs to both tiles.
    for(let y=Math.floor((top-48)/step)*step;y<top+SIZE+48;y+=step)for(let x=Math.floor((left-48)/step)*step;x<left+SIZE+48;x+=step){const r=regionalRandom(37,x,y);g.fillStyle=p.accent;g.globalAlpha=paving?.16:.34;
      if(paving){g.fillRect(x,y,step-2,2);g.fillRect(x,y,2,step-2);}else if(r()<.55){g.fillRect(x+Math.floor(r()*7)*2,y+Math.floor(r()*7)*2,4+Math.floor(r()*3)*2,2);g.fillRect(x+8,y+6,2,4);}g.globalAlpha=1;}
    // Paint every verge before the road surfaces, including adjoining round caps.
    // Interleaving these passes stamps a dark semicircle at every curve segment.
    g.lineCap='round';
    for(const [color,width]of [[p.edge,p.width+12],[p.path,p.width]]){g.strokeStyle=color;g.lineWidth=width;for(const [a,b]of p.roads){g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();}}
    g.fillStyle=p.path;g.beginPath();g.ellipse(p.boss.x,p.boss.y,210,160,0,0,Math.PI*2);g.fill();
    for(let y=Math.floor((top-32)/26)*26;y<top+SIZE+32;y+=26)for(let x=Math.floor((left-32)/26)*26;x<left+SIZE+32;x+=26){const r=regionalRandom(191,x,y);if(r()>.42)continue;g.fillStyle=r()<.5?'#ffffff28':p.accent;g.fillRect(x+Math.floor(r()*9)*2,y+Math.floor(r()*9)*2,4,2);if(p.surface==='moss'&&r()<.12){g.fillStyle='#95ceb35c';g.fillRect(x+8,y+8,2,2);}}
    if(p.id==='kerning'){g.fillStyle='#eee6bd';for(const side of [-1,1])for(let i=-3;i<=3;i++)g.fillRect(p.x+side*500+i*16,p.y-65,8,130);}
    if(p.id==='orbis'){g.strokeStyle='#aebda3';g.lineWidth=3;g.beginPath();g.ellipse(p.x,p.y,350,230,0,0,Math.PI*2);g.stroke();}
    for(const b of p.barriers){g.fillStyle='#a2bd93';g.beginPath();g.arc(b.x,b.y,b.radius+14,0,Math.PI*2);g.fill();g.fillStyle='#4bafc2';g.beginPath();g.arc(b.x,b.y,b.radius,0,Math.PI*2);g.fill();g.strokeStyle='#b5e5db';g.lineWidth=3;for(let y=b.y-b.radius+20;y<b.y+b.radius-20;y+=24){const dx=Math.sqrt(Math.max(0,b.radius*b.radius-(y-b.y)**2))-12;g.beginPath();g.moveTo(b.x-dx,y);g.lineTo(b.x+dx,y);g.stroke();}}
    return c;}
}
