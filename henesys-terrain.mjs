// Runtime pixel terrain, not a flattened concept painting. Cache only visible 256px tiles.
import {townPlan} from './henesys-map.mjs';
import {pointSegmentDistance} from './field-collision.mjs';
import {originalTerrainArt} from './original-field-art.mjs';
const SIZE=256,PIXEL=2,LIMIT=96;
export class HenesysTerrain{
  constructor(){this.tiles=new Map();this.key='';}
  draw(g,seed,arrival,left,top,width,height){
    const p=townPlan(seed,arrival);if(this.key!==p.key){this.key=p.key;this.tiles.clear();}
    for(let y=Math.floor(top/SIZE);y<=Math.floor((top+height)/SIZE);y++)for(let x=Math.floor(left/SIZE);x<=Math.floor((left+width)/SIZE);x++){
      const key=`${x},${y}`;let tile=this.tiles.get(key);if(!tile){tile=this.make(p,x*SIZE,y*SIZE);this.tiles.set(key,tile);if(this.tiles.size>LIMIT)this.tiles.delete(this.tiles.keys().next().value);}
      g.drawImage(tile,Math.round(x*SIZE-left),Math.round(y*SIZE-top),SIZE,SIZE);
    }
  }
  make(p,left,top){
    const c=document.createElement('canvas');c.width=c.height=SIZE/PIXEL;const g=c.getContext('2d');g.scale(1/PIXEL,1/PIXEL);g.translate(-left,-top);
    g.imageSmoothingEnabled=false;
    const textures=originalTerrainArt(),grass=g.createPattern(textures.grass,'repeat'),dirt=g.createPattern(textures.dirt,'repeat'),water=g.createPattern(textures.water,'repeat');
    g.fillStyle=grass;g.fillRect(left,top,SIZE,SIZE);
    const line=(a,b,w,color)=>{g.strokeStyle=color;g.lineCap='round';const length=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(length/26));for(let i=0;i<steps;i++){const t=i/steps,u=(i+1)/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;g.lineWidth=w+Math.sin(x/71+y/83)*10+Math.sin(x/31-y/57)*5;g.beginPath();g.moveTo(x,y);g.lineTo(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u);g.stroke();}};
    // A continuous loop plus separate spokes; the center stays grass for combat readability.
    for(const [a,b]of p.roads)line(a,b,p.roadWidth+12,'#739a44');
    for(const [a,b]of p.roads)line(a,b,p.roadWidth+4,'#a4b75a');
    for(const [a,b]of p.roads)line(a,b,p.roadWidth,dirt);
    // Boss clearing: light worn ground, stones only around its rim, four broad gaps.
    g.fillStyle='#8fa849';g.beginPath();g.ellipse(p.boss.x,p.boss.y,235,185,0,0,Math.PI*2);g.fill();
    g.fillStyle=dirt;g.beginPath();g.ellipse(p.boss.x,p.boss.y,216,166,0,0,Math.PI*2);g.fill();
    // River remains peripheral; the loop is entirely on its dry west side.
    const riverTop=Math.max(p.riverStart-p.y,Math.floor((top-p.y-28)/24)*24),riverBottom=Math.min(p.riverEnd-p.y,top+SIZE-p.y);
    for(let dy=riverTop;dy<riverBottom;dy+=24){const x=p.x+p.riverX(dy+12),y=p.y+dy;g.fillStyle='#305e30';g.fillRect(x-92,y,184,28);g.fillStyle=water;g.fillRect(x-72,y,144,28);
      for(const side of [-1,1]){const sx=Math.round((x+side*79)/2)*2,sy=y-2,w=12+(Math.abs(dy/24)%3)*2;
        g.fillStyle='#394c39';g.beginPath();g.ellipse(sx,sy+17,w+3,12,0,0,Math.PI*2);g.fill();
        g.fillStyle='#7b755f';g.beginPath();g.moveTo(sx-w,sy+7);g.lineTo(sx-w+5,sy-2);g.lineTo(sx+w-5,sy-4);g.lineTo(sx+w,sy+6);g.lineTo(sx+w-2,sy+22);g.lineTo(sx-w+2,sy+23);g.closePath();g.fill();
        g.fillStyle='#b5af90';g.beginPath();g.moveTo(sx-w,sy+7);g.lineTo(sx-w+5,sy-2);g.lineTo(sx+w-5,sy-4);g.lineTo(sx+w,sy+6);g.lineTo(sx+2,sy+12);g.closePath();g.fill();g.fillStyle='#d3cba5';g.fillRect(sx-w+6,sy,8,3);g.fillStyle='#719a49';g.fillRect(sx-w-2,sy-2,w,4);
      }
    }
    const b=p.bridge;g.fillStyle='#59452e';g.fillRect(b.x-b.width/2-8,b.y-b.height/2-8,b.width+16,b.height+16);
    for(let x=b.x-b.width/2;x<b.x+b.width/2;x+=16){g.fillStyle=(Math.floor(x/16)%2)?'#bd9153':'#cda061';g.fillRect(x,b.y-b.height/2,14,b.height);g.fillStyle='#ae804d';g.fillRect(x+6,b.y-56,4,32);g.fillRect(x+4,b.y+20,4,28);g.fillStyle='#67492e';g.fillRect(x+4,b.y-b.height/2+12,4,4);g.fillRect(x+4,b.y+b.height/2-16,4,4);}
    // Rails stay at the sides of a 192px clear passage, never across its entrances.
    for(const y of [b.y-b.height/2-8,b.y+b.height/2+4]){g.fillStyle='#6c4d2f';g.fillRect(b.x-b.width/2-12,y,b.width+24,8);for(let x=b.x-b.width/2;x<=b.x+b.width/2;x+=64){g.fillStyle='#966b3b';g.fillRect(x-6,y-12,12,20);g.fillStyle='#d5ae67';g.fillRect(x-4,y-12,8,4);}}
    // Sparse ground freckles use world coordinates and remain identical at tile boundaries.
    for(let y=Math.floor(top/32)*32;y<top+SIZE;y+=32)for(let x=Math.floor(left/32)*32;x<left+SIZE;x+=32){let n=(Math.imul(x,73856093)^Math.imul(y,19349663))>>>0;if(n%3===0&&p.roads.some(([a,b])=>pointSegmentDistance({x,y},a,b)<p.roadWidth/2-16)){g.fillStyle='#b5966666';g.fillRect(x+(n%17),y+(n%11),4,4);g.fillStyle='#ecd39b55';g.fillRect(x+8,y+16,8,4);}}
    // Irregular tufts break the geometric path outline; tiny walk-through flowers keep the center readable.
    for(let y=Math.floor(top/18)*18;y<top+SIZE;y+=18)for(let x=Math.floor(left/18)*18;x<left+SIZE;x+=18){
      const n=(Math.imul(x,73856093)^Math.imul(y,19349663)^p.x)>>>0,d=Math.min(...p.roads.map(([a,b])=>pointSegmentDistance({x,y},a,b)));
      if(y>=p.riverStart&&y<=p.riverEnd&&Math.abs(x-p.x-p.riverX(y-p.y))<94)continue;
      if(Math.abs(d-p.roadWidth/2)<18&&n%3!==0){g.fillStyle='#739d47';g.fillRect(x,y,8,4);g.fillRect(x+2,y-6,2,8);g.fillRect(x+6,y-4,2,6);g.fillStyle='#b1ca66';g.fillRect(x+2,y-6,2,4);}
      else if(d>p.roadWidth/2+24&&n%29===0){g.fillStyle='#658e3f';g.fillRect(x+2,y+2,2,6);g.fillStyle='#f8f1bd';g.fillRect(x,y,6,2);g.fillRect(x+2,y-2,2,6);g.fillStyle='#e9bb39';g.fillRect(x+2,y,2,2);}
    }
    return c;
  }
}
