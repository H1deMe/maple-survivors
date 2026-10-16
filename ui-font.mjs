// Numeric glyphs are original UI.wz canvases, not a substitute vector font.
let glyphs;const rendered=new WeakMap();
export async function loadUiFont(){const response=await fetch('assets/ui/ui.json');if(!response.ok)throw new Error('UI 글꼴 목록을 읽지 못했습니다.');glyphs=(await response.json()).entries;}
export function uiNumber(node,value,kind='number'){
  const text=String(value),key=kind+text;if(rendered.get(node)===key)return;rendered.set(node,key);
  node.setAttribute('aria-label',text);node.classList.add('native-number');
  const label=document.createElement('span');label.className='sr-only';label.textContent=text;
  const visual=document.createElement('span');visual.className='native-digits';visual.setAttribute('aria-hidden','true');
  for(const char of text){
    const name=({'/':'slash','%':'percent','[':'Lbracket',']':'Rbracket'})[char]??char;
    const f=glyphs?.[`${kind}-${name}`],span=document.createElement('span');span.className=f?'native-digit':'native-char';
    if(f){span.style.setProperty('--glyph-width',f.w);span.style.setProperty('--glyph-height',f.h);span.style.backgroundImage=`url(assets/ui/${f.src})`;}
    else span.dataset.char=char;
    visual.append(span);
  }
  node.replaceChildren(label,visual);
}
