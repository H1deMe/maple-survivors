// A fixed, seamless floor per region. Run seeds change scenery, never floor colour or tile phase.
export const FLOOR_TILE_SIZE=64;
const tiles=new Map();
const palettes={
  lith:{base:'#e6d3a6',shade:'#d2be91',light:'#efdfb9',detail:'#c9b58c'},
  henesys:{base:'#95b960',shade:'#83a952',light:'#a6c772',detail:'#789f4c'},
  ellinia:{base:'#567e60',shade:'#4b7256',light:'#658d6b',detail:'#41694f'},
  perion:{base:'#bc946c',shade:'#a9815b',light:'#cba57c',detail:'#97724d'},
  kerning:{base:'#81898c',shade:'#707a7d',light:'#959da0',detail:'#626e72'},
  sleepywood:{base:'#405e4b',shade:'#375340',light:'#506e57',detail:'#2e4938'},
  orbis:{base:'#d7dbd5',shade:'#c5cec9',light:'#e7eae2',detail:'#b6c2bc'},
};
function floorTile(stage){
  if(tiles.has(stage))return tiles.get(stage);
  const p=palettes[stage];if(!p)throw new Error(`Unknown floor: ${stage}`);
  const c=document.createElement('canvas');c.width=c.height=FLOOR_TILE_SIZE;const g=c.getContext('2d');
  g.fillStyle=p.base;g.fillRect(0,0,c.width,c.height);
  // Wrap each small mark across the tile edges, so negative world positions repeat identically.
  const mark=(x,y,w,h,color)=>{g.fillStyle=color;for(let j=0;j<h;j++)for(let i=0;i<w;i++)g.fillRect((x+i+64)%64,(y+j+64)%64,1,1);};
  let state=1065;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/2**32;};
  for(let i=0;i<38;i++)mark(Math.floor(random()*64),Math.floor(random()*64),1+i%2,1,i%3?p.shade:p.light);
  for(const [x,y]of [[7,11],[36,5],[54,23],[21,35],[44,49],[3,59]]){
    if(stage==='lith'){
      mark(x,y,3,1,p.shade);mark(x+1,y-1,2,1,p.light);
    }else{
      mark(x,y,1,3,p.detail);mark(x-2,y+1,1,2,p.shade);mark(x+2,y,1,3,p.shade);mark(x+1,y+3,2,1,p.light);
    }
  }
  tiles.set(stage,c);return c;
}
export function paintFloor(g,stage,x,y,w=g.canvas.width,h=g.canvas.height){
  g.save();g.translate(-x,-y);g.fillStyle=g.createPattern(floorTile(stage),'repeat');g.fillRect(x,y,w,h);g.restore();
}
