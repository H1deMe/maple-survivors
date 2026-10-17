// Field data is separate from combat STAGES. Henesys uses newly created artwork only.
import {loadOriginalFieldArt} from './original-field-art.mjs';
import {loadRegionalArt} from './regional-art.mjs';
let definitions;
export async function loadBattlefield(){
  if(definitions)return;
  const read=async src=>{const r=await fetch(src);if(!r.ok)throw new Error(`전장 데이터를 읽지 못했습니다: ${src}`);return r.json();};
  const [catalog,henesys]=await Promise.all([read('assets/battlefield/props.json'),read('assets/battlefield/regions/henesys.json')]);
  for(const t of henesys.templates)for(const [id]of t.props)if(!catalog.props[id])throw new Error(`정의되지 않은 전장 소품: ${id}`);
  await loadOriginalFieldArt();await loadRegionalArt();definitions={props:catalog.props,regions:{henesys}};
}
export function regionDefinition(id){return definitions?.regions[id]??null;}
export function propDefinitions(){return definitions?.props??{};}
