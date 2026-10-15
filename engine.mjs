// Maple survivors rules: a Vampire Survivors-style top-down run. 8-way movement, client skills that fire
// on their own as weapons, client passives, meso drops that give EXP, minute-by-minute waves and four
// bosses ending with Jr. Balrog at 10:00. DOM-free so it runs in Node tests. Distances px, speeds px/s.

export const RUN_TIME=600;                 // the final boss arrives at 10:00; beating it clears the run
export const MAX_WEAPONS=6,MAX_PASSIVES=6,WEAPON_MAX=8,PASSIVE_MAX=5;
export const PLAYER={hp:100,speed:125,pickup:48,invincible:.4,radius:14};  // 125 = client walkSpeed
const DESPAWN=1100;
// Difficulty knobs on top of the per-stage tables (raised after "체감 난이도가 쉬운거 같아").
export const TUNING={mobHp:1.25,hpGrowth:.8,mobDamage:1.3,spawnRate:1.15,mobMax:1.15,bossHp:1.25};
const SHOT_EXTRA=120;
const WEAK={taken:1.2,dealt:.7};   // Threaten: a threatened monster takes +20% damage and hits 30% softer

// Weapons are client skills. base = level 1, ups[i] = what level i+2 adds. range = how close a monster
// must be before the weapon fires; projectiles fly SHOT_EXTRA further so moving targets still get hit.
export const WEAPONS={
  '0001000':{name:'달팽이 세마리',kind:'shell',desc:'가장 가까운 적에게 달팽이 껍질을 던집니다.',
    base:{damage:10,cooldown:1,count:1,pierce:1,speed:420,range:240},
    ups:[{count:1},{damage:6},{damage:4},{count:1},{damage:6,cooldown:-.15},{count:1},{damage:6,pierce:1}]},
  '2001004':{name:'에너지 볼트',kind:'bolt',desc:'적을 끝까지 쫓아가는 마법 구체를 쏩니다.',
    base:{damage:16,cooldown:1.2,count:1,pierce:1,speed:360,range:300},
    ups:[{damage:6},{count:1},{cooldown:-.2},{damage:8},{count:1},{damage:10},{count:1,cooldown:-.15}]},
  '4001344':{name:'럭키 세븐',kind:'star',desc:'가까운 적들에게 표창을 날립니다.',
    base:{damage:12,cooldown:1.1,count:2,pierce:1,speed:560,range:260},
    ups:[{damage:5},{count:1},{pierce:1},{damage:6},{count:1},{cooldown:-.25},{damage:6,count:1}]},
  '3001004':{name:'에로우 블로우',kind:'arrow',desc:'가까운 적 쪽으로 적을 꿰뚫는 화살을 쏩니다.',
    base:{damage:16,cooldown:1.5,count:1,pierce:2,speed:650,range:320},
    ups:[{pierce:1},{damage:6},{count:1},{cooldown:-.1},{damage:6},{count:1},{pierce:1,damage:4}]},
  '1001004':{name:'파워 스트라이크',kind:'strike',desc:'바라보는 방향의 적들을 크게 벱니다.',
    base:{damage:26,cooldown:1.4,count:1,area:1},
    ups:[{damage:16},{count:1},{area:.15},{damage:18},{cooldown:-.25},{area:.15},{damage:35}]},
  '1001005':{name:'슬래시 블러스트',kind:'blast',desc:'주변의 모든 적을 베어 냅니다.',
    base:{damage:18,cooldown:2.2,area:1,radius:120},
    ups:[{area:.15},{damage:8},{cooldown:-.3},{area:.15},{damage:10},{cooldown:-.3},{area:.2,damage:14}]},
  '2001005':{name:'매직 클로',kind:'claw',desc:'주변의 무작위 적을 마법 발톱으로 두 번 할큅니다.',
    base:{damage:14,cooldown:1.8,count:1,range:280},
    ups:[{count:1},{damage:6},{count:1},{cooldown:-.3},{damage:8},{count:1},{damage:12,count:1}]},
  '4001334':{name:'더블 스탭',kind:'stab',desc:'가장 가까운 적을 재빠르게 두 번 찌릅니다.',
    base:{damage:15,cooldown:.9,count:1,area:1,range:150},
    ups:[{damage:12},{area:.2},{count:1},{cooldown:-.2},{damage:14},{count:1},{damage:25,cooldown:-.15}]},
  // Pirate 1st job: Double Fire (gun) and Somersault Kick (knuckle).
  '5001003':{name:'더블 파이어',kind:'arrow',desc:'가까운 적 쪽으로 총알을 두 발씩 쏩니다.',
    base:{damage:11,cooldown:1,count:2,pierce:1,speed:700,range:300,spread:.05,interval:.08},
    ups:[{damage:5},{count:1},{cooldown:-.15},{damage:6},{pierce:1},{count:1},{damage:8}]},
  '5001002':{name:'써머솔트 킥',kind:'blast',desc:'공중제비를 돌며 주변의 적 여러 마리를 걷어찹니다.',
    base:{damage:24,cooldown:1.4,area:1,radius:130,targets:6},
    ups:[{damage:9},{targets:2},{cooldown:-.2},{area:.15},{damage:11},{targets:3},{damage:16,cooldown:-.15}]},
  // Aran 1st job (KMS 1.2.95): Double Swing, a polearm swing that hits twice.
  '21000002':{name:'더블 스윙',kind:'strike',desc:'폴암을 두 번 휘둘러 바라보는 방향의 적들을 벱니다.',
    base:{damage:14,cooldown:1.3,count:1,area:1,hits:2},
    ups:[{damage:6},{count:1},{area:.15},{damage:7},{cooldown:-.2},{area:.15},{damage:10}]},
  // Evan 1st job (KMS 1.2.95): Magic Missile. The dragon Mir casts Evan's skills and grows with each job (drawn by app).
  '22001001':{name:'매직 미사일',kind:'nova',desc:'미르가 가까운 적들에게 마법 탄을 두 번씩 쏩니다.',
    base:{damage:10,cooldown:1.1,count:1,targets:6,radius:260,hits:2},
    ups:[{damage:4},{count:1},{cooldown:-.15},{damage:4},{count:1},{damage:5},{count:1,damage:4}]},
  // Wind Archer 1st job (Cygnus Knights): Double Shot.
  '13001003':{name:'더블 샷',kind:'arrow',desc:'가까운 적 쪽으로 적을 꿰뚫는 화살을 두 발씩 쏩니다.',
    base:{damage:11,cooldown:1.3,count:2,pierce:2,speed:750,range:340,spread:.06,interval:.07},
    ups:[{damage:4},{pierce:1},{cooldown:-.15},{damage:4},{count:1},{pierce:1},{damage:5}]},
};
export const START_WEAPON='0001000';
// Passives are client skills too (names as in String.wz). Each level adds `per`.
export const PASSIVES={
  '1101006':{name:'분노',stat:'might',per:.1,text:v=>`공격력 +${v*100}%`},
  '1101004':{name:'소드 부스터',stat:'haste',per:.08,text:v=>`쿨타임 -${v*100}%`},
  '4101004':{name:'헤이스트',stat:'speed',per:.1,text:v=>`이동 속도 +${v*100}%`},
  '1301007':{name:'하이퍼 바디',stat:'maxHp',per:.2,text:v=>`최대 HP +${v*100}%`},
  '1000000':{name:'HP 회복력 향상',stat:'regen',per:.3,text:v=>`초당 HP ${v.toFixed(1)} 회복`},
  '2001002':{name:'매직 가드',stat:'armor',per:.07,text:v=>`받는 피해 -${Math.round(v*100)}%`},
  '3000001':{name:'크리티컬 샷',stat:'crit',per:.07,text:v=>`치명타 확률 +${Math.round(v*100)}%`},
  '4000001':{name:'킨 아이즈',stat:'magnet',per:.3,text:v=>`메소 줍는 범위 +${Math.round(v*100)}%`},
  '1100000':{name:'소드 마스터리',stat:'area',per:.1,text:v=>`공격 범위 +${Math.round(v*100)}%`},
  '4000000':{name:'님블 바디',stat:'dodge',per:.05,text:v=>`회피 확률 +${Math.round(v*100)}%`},
  '3000000':{name:'아마존의 축복',stat:'growth',per:.1,text:v=>`획득 경험치 +${Math.round(v*100)}%`},
};
// Job advancement: a boss reward (not the final boss) can advance a 1st-job skill that is high enough into its
// 2nd, 3rd and 4th-job client skills. tiers[i] is the (i+2)th job: mult multiplies the skill's damage, set
// replaces stats (a function gets the 1st-job stats at that level), kind picks the behaviour. Balance rule: at Lv.8 every tier's measured DPS (scripts/balance.mjs)
// is TIER_DPS[i] times the 1st-job skill's, so each line is tuned against one curve (checked in tests).
export const ADV_LEVEL=[4,6,8];          // skill level needed for the 2nd, 3rd and 4th job
export const TIER_DPS=[1.7,2.8,4.5];
export const JOBS={
  // Power Strike. Fighter: Final Attack follow-ups, Shout (stuns a crowd), Brandish (two big slashes both ways).
  // Page: Threaten (threatened monsters take more damage and hit softer), Charge Blow (stuns all around), Sanctuary.
  // Warriors have no 2nd-job attack skill in the client, so the 2nd job adds Final Attack / Threaten to Power Strike.
  '1001004':[
    {id:'fighter',job:'파이터',tiers:[
      {skill:'1100002',kind:'strike',mult:1.06,set:{follow:.6,look:'1001004'},desc:'파워 스트라이크 뒤에 60% 확률로 한 번 더 벱니다.'},
      {skill:'1111008',kind:'nova',mult:1.69,set:{count:4,targets:6,radius:210,stun:1.5},desc:'큰 소리를 질러 주변 적 최대 6마리에게 피해를 주고 1.5초 동안 기절시킵니다.'},
      {skill:'1121008',kind:'strike',mult:2.3,set:{count:2,hits:2},desc:'앞뒤의 적들을 크게 두 번씩 벱니다.'},
    ]},
    {id:'page',job:'페이지',tiers:[
      {skill:'1201006',kind:'strike',mult:1.56,set:{weaken:4,look:'1001004'},desc:'벤 적을 4초 동안 위협합니다. 위협당한 적은 받는 피해 +20%, 주는 피해 -30%.'},
      {skill:'1211002',kind:'blast',mult:1.51,set:{radius:150,stun:1},desc:'속성을 담은 일격으로 주변의 적 모두를 공격하고 1초 동안 기절시킵니다.'},
      {skill:'1221011',kind:'blast',mult:1.77,set:{radius:220,cooldown:b=>b.cooldown*3},desc:'커다란 망치로 땅을 내리쳐 넓은 범위의 적 모두를 공격합니다.'},
    ]},
  ],
  // Double Fire → Gunslinger: Throwing Bomb (bursts on impact), Homing (bullets chase), Battleship Cannon.
  '5001003':[
    {id:'gunslinger',job:'건슬링거',tiers:[
      {skill:'5201002',kind:'arrow',mult:0.96,set:{count:b=>b.count-1,spread:.3,splash:90,targets:b=>b.pierce+3,speed:480,pierce:1},desc:'맞은 자리에서 터지는 폭탄을 던져 주변의 적들에게 피해를 줍니다.'},
      {skill:'5211006',kind:'bolt',mult:4.47,set:{count:b=>b.count+1,speed:520,pierce:1},desc:'적을 끝까지 쫓아가는 유도탄을 쏩니다.'},
      {skill:'5221007',kind:'arrow',mult:2.13,set:{count:4,spread:.09,interval:.1,pierce:b=>b.pierce+2,speed:800,range:360},desc:'배틀쉽의 대포를 네 발 쏩니다. 포탄은 적을 꿰뚫습니다.'},
    ]},
  ],
  // Somersault Kick → Brawler: Backspin Blow (stuns), Shockwave (a wider ring), Dragon Strike (a burning line).
  '5001002':[
    {id:'brawler',job:'인파이터',tiers:[
      {skill:'5101002',kind:'blast',mult:1.96,set:{stun:1},desc:'몸을 회전시키며 주변의 적들을 쳐서 1초 동안 기절시킵니다.'},
      {skill:'5111006',kind:'blast',mult:1.53,set:{radius:b=>b.radius*1.3,targets:b=>b.targets+2},desc:'땅을 내리쳐 충격파로 더 넓은 범위의 적들을 공격합니다.'},
      {skill:'5121001',kind:'lance',mult:1.87,set:{count:1,width:120,pierce:8,range:240,beam:'fire'},desc:'용의 기운을 실어 앞에 있는 한 줄의 적들을 강하게 내려칩니다.'},
    ]},
    {id:'thunderbreaker',job:'스트라이커',tiers:[
      {skill:'15101005',kind:'blast',mult:2.82,set:{targets:6},desc:'번개의 기운을 모아 주변의 적 최대 6마리를 강하게 칩니다.'},
      {skill:'15111004',kind:'stab',mult:1.95,set:{count:2,hits:6,range:150},desc:'가까운 적 두 마리에게 주먹을 여섯 번씩 날립니다.'},
      {skill:'15111007',kind:'arrow',mult:2.18,set:{count:1,pierce:5,speed:560,range:360},desc:'상어 모양의 번개를 날려 한 줄의 적 최대 5마리를 꿰뚫습니다.'},
    ]},
  ],
  // Double Swing → Aran: Triple Swing, Combo Fenrir (a wolf that runs through a line), Combo Tempest (freezes, then shatters).
  '21000002':[
    {id:'aran',job:'아란',tiers:[
      {skill:'21100001',kind:'strike',mult:1.18,set:{hits:3},desc:'폴암을 세 번 휘둘러 앞의 적들을 공격합니다.'},
      {skill:'21110004',kind:'arrow',mult:2.22,set:{count:1,pierce:6,speed:620,range:360},desc:'늑대의 기운을 날려 한 줄의 적 최대 6마리를 꿰뚫습니다.'},
      {skill:'21120006',kind:'blast',mult:2.35,set:{radius:260,targets:15,hits:2,freeze:1.5,cooldown:b=>b.cooldown*3},desc:'주변의 적 최대 15마리를 얼린 뒤 부숴 두 번 공격합니다.'},
    ]},
  ],
  // Magic Missile → Evan: Mir's Fire Circle, Dragon Thrust (a charge through a line) and Blaze (bursting fire).
  '22001001':[
    {id:'evan',job:'에반',tiers:[
      {skill:'22101000',kind:'blast',mult:4.24,set:{radius:150,targets:b=>b.count+3},desc:'미르가 불의 고리를 둘러 주변의 적들을 태웁니다.'},
      {skill:'22141001',kind:'lance',mult:4.08,set:{count:1,width:110,pierce:6,range:280,beam:'rush'},desc:'미르가 앞으로 돌진해 한 줄의 적 최대 6마리를 공격합니다.'},
      {skill:'22181001',kind:'arrow',mult:2.84,set:{count:2,spread:.25,splash:110,targets:6,speed:520,range:320,pierce:1},desc:'미르가 불꽃을 내뿜어 맞은 자리 주변의 적 최대 6마리를 태웁니다.'},
    ]},
  ],
  // Double Shot (Wind Archer, Cygnus Knights): Nymph's Breath, Arrow Rain, Magnum Shot.
  '13001003':[
    {id:'windarcher',job:'윈드브레이커',tiers:[
      {skill:'13101005',kind:'nova',mult:1.93,set:{targets:b=>b.count*b.pierce,count:b=>b.count*b.pierce,radius:240,hits:2},desc:'바람의 숨결로 주변의 적들을 두 번씩 공격합니다.'},
      {skill:'13111000',kind:'rain',mult:2.32,set:{count:1,radius:120,waves:2,targets:b=>b.pierce+3},desc:'가까운 적이 있는 곳에 화살비를 두 번 쏟아붓습니다.'},
      {skill:'13111006',kind:'arrow',mult:3.1,set:{pierce:6,speed:900,spread:.08},desc:'강력한 화살로 한 줄의 적 최대 6마리를 꿰뚫습니다.'},
    ]},
  ],
  // Slash Blast → Spearman: Final Attack, Dragon Roar (a huge circle), Rush (a charge that shoves a whole line back).
  '1001005':[
    {id:'spearman',job:'스피어맨',tiers:[
      {skill:'1300002',kind:'blast',mult:1.08,set:{follow:.6,look:'1001005'},desc:'슬래시 블러스트 뒤에 60% 확률로 한 번 더 공격합니다.'},
      {skill:'1311006',kind:'blast',mult:1.85,set:{radius:b=>b.radius*1.45,cooldown:b=>b.cooldown*1.8},desc:'거대한 용의 포효로 넓은 범위의 적 모두를 공격합니다.'},
      {skill:'1321003',kind:'lance',mult:2.11,set:{count:1,width:130,pierce:15,range:260,push:110,beam:'rush'},desc:'앞으로 거칠게 돌격해 한 줄의 적 최대 15마리를 공격하고 밀어냅니다.'},
    ]},
    // Cygnus Knights (1st-3rd job in the client): the 4th tier is their strongest 3rd-job skill.
    {id:'soulmaster',job:'소울마스터',tiers:[
      {skill:'11101004',kind:'arrow',mult:1.34,set:{count:1,pierce:b=>Math.round(b.area**2*3),speed:600,range:300},desc:'검기를 날려 한 줄의 적들을 꿰뚫습니다.'},
      {skill:'11111003',kind:'blast',mult:5.68,set:{targets:8,stun:1.5,look:'11001003'},desc:'주변의 적 최대 8마리를 베고 1.5초 동안 기절시킵니다.'},
      {skill:'11111006',kind:'blast',mult:5.37,set:{radius:b=>b.radius*1.3,targets:10,cooldown:b=>b.cooldown*1.6},desc:'빛의 기운을 담은 일격으로 넓은 범위의 적 최대 10마리를 공격합니다.'},
    ]},
  ],
  '2001004':[
    {id:'icelightning',job:'위자드(썬,콜)',tiers:[
      {skill:'2201005',kind:'nova',mult:1.7,set:{targets:6,radius:260},desc:'주변의 적 최대 6마리에게 번개를 내리칩니다.'},
      {skill:'2211003',kind:'lance',mult:2.8,set:{count:2,width:70,pierce:2},desc:'가까운 적 쪽으로 두 마리까지 꿰뚫는 번개 창을 두 번 날립니다.'},
      {skill:'2221006',kind:'chain',mult:4.5,set:{count:1,jumps:5,jump:170,cooldown:1.3},desc:'번개가 적 사이를 튀며 최대 6마리를 감전시킵니다.'},
    ]},
    {id:'firepoison',job:'위자드(불,독)',tiers:[
      {skill:'2101004',kind:'bolt',mult:1.7,set:{},desc:'적을 끝까지 쫓아가는 불화살을 쏩니다.'},
      {skill:'2111002',kind:'blast',mult:2.8,set:{radius:165},desc:'주변을 폭발시켜 닿는 적 모두에게 피해를 줍니다.'},
      {skill:'2121007',kind:'meteor',mult:5,set:{targets:12,cooldown:3},desc:'넓은 범위의 적 최대 12마리에게 운석을 떨어뜨립니다.'},
    ]},
  ],
  // Magic Claw. Ice freezes monsters in place (bosses are immune); Cleric heals the player on every cast.
  '2001005':[
    {id:'ice',job:'위자드(썬,콜)',tiers:[
      {skill:'2201004',kind:'claw',mult:1.8,set:{freeze:1},desc:'주변의 적을 냉기로 두 번 공격하고 1초 동안 얼립니다.'},
      {skill:'2211002',kind:'blast',mult:4.5,set:{radius:165,freeze:1.5,cooldown:.9},desc:'주변의 적 모두에게 얼음 기둥을 솟구치게 해 1.5초 동안 얼립니다.'},
      {skill:'2221007',kind:'meteor',mult:6.1,set:{targets:12,cooldown:3,freeze:2},desc:'넓은 범위의 적 최대 12마리에게 눈보라를 내려 2초 동안 얼립니다.'},
    ]},
    {id:'cleric',job:'클레릭',tiers:[
      {skill:'2301005',kind:'bolt',mult:1.87,set:{speed:420,pierce:1,heal:1,cooldown:.9},desc:'적을 쫓아가는 성스러운 화살을 쏘고 HP를 1 회복합니다.'},
      {skill:'2311004',kind:'nova',mult:3.24,set:{targets:6,radius:260,heal:2,cooldown:.9},desc:'주변의 적 최대 6마리에게 빛을 내리고 HP를 2 회복합니다.'},
      {skill:'2321008',kind:'meteor',mult:5.4,set:{targets:12,cooldown:3,heal:5},desc:'넓은 범위의 적 최대 12마리에게 성스러운 빛을 내리고 HP를 5 회복합니다.'},
    ]},
    {id:'blazewizard',job:'플레임위자드',tiers:[
      {skill:'12101002',kind:'bolt',mult:2.38,set:{count:b=>b.count+1,speed:420,pierce:1},desc:'적을 끝까지 쫓아가는 불화살을 쏩니다.'},
      {skill:'12111006',kind:'arrow',mult:1.32,set:{count:b=>Math.ceil(b.count/2),spread:.25,splash:90,targets:6,speed:520,range:300,pierce:1},desc:'불꽃 탄을 날려 맞은 자리 주변의 적 최대 6마리를 태웁니다.'},
      {skill:'12111003',kind:'meteor',mult:4.55,set:{targets:15,cooldown:3},desc:'넓은 범위의 적 최대 15마리에게 운석을 떨어뜨립니다.'},
    ]},
  ],
  // Arrow Blow. Hunter blows up crowds (splash, area rain, a stream of arrows); Crossbowman shoots farther and
  // pierces whole lines.
  '3001004':[
    {id:'hunter',job:'헌터',tiers:[
      {skill:'3101005',kind:'arrow',mult:1.55,set:{splash:80,targets:b=>b.pierce,pierce:1},desc:'맞은 자리에서 터지는 화살을 쏴 주변 적에게도 피해를 줍니다.'},
      {skill:'3111004',kind:'rain',mult:2.65,set:{count:1,radius:120,waves:3,targets:b=>Math.max(2,Math.round(b.count*b.pierce/3))},desc:'가까운 적이 있는 곳에 화살비를 세 번 쏟아붓습니다.'},
      {skill:'3121004',kind:'arrow',mult:4.5,set:{count:b=>b.count*b.pierce,spread:.05,interval:.04,pierce:1,speed:900},desc:'폭풍처럼 화살을 쉬지 않고 쏘아 댑니다.'},
    ]},
    {id:'crossbow',job:'사수',tiers:[
      {skill:'3201005',kind:'arrow',mult:1.4,set:{pierce:b=>b.pierce+1,range:400,speed:800},desc:'더 멀리 있는 적까지 쏘고, 더 많은 적을 꿰뚫습니다.'},
      {skill:'3211004',kind:'rain',mult:2.55,set:{radius:140,waves:1,targets:b=>b.pierce,range:400},desc:'멀리 있는 적들 발밑에서 화살이 솟구쳐 주변을 한꺼번에 공격합니다.'},
      {skill:'3221001',kind:'arrow',mult:4.5,set:{count:2,pierce:b=>Math.max(2,Math.round(b.count*b.pierce/2)),range:460,speed:1000,spread:.05,interval:.15},desc:'아주 멀리까지 적을 꿰뚫는 거대한 화살을 두 발 쏩니다.'},
    ]},
  ],
  // Lucky Seven → Assassin: critical hits (bigger numbers more often) and Drain heals. One line, as in the client.
  '4001344':[
    {id:'assassin',job:'어쌔신',tiers:[
      {skill:'4101005',kind:'star',mult:1.55,set:{crit:.2,heal:1},desc:'표창으로 HP를 흡수합니다(시전마다 HP 1). 치명타 확률 +20%.'},
      {skill:'4111005',kind:'arrow',mult:2.45,set:{crit:.3,spin:true,spread:.18,speed:620},desc:'거대한 표창이 회전하며 적을 꿰뚫습니다. 치명타 확률 +30%.'},
      {skill:'4121007',kind:'star',mult:3.6,set:{crit:.4,count:b=>b.count+3,cooldown:b=>b.cooldown*1.5},desc:'표창을 세 갈래로 연달아 던집니다. 치명타 확률 +40%.'},
    ]},
    {id:'nightwalker',job:'나이트워커',tiers:[
      {skill:'14101006',kind:'nova',mult:1.34,set:{targets:6,radius:240,hits:3,heal:1},desc:'어둠의 기운으로 주변 적들을 세 번씩 공격하고 HP를 1 흡수합니다.'},
      {skill:'14111006',kind:'arrow',mult:4.22,set:{count:1,splash:100,targets:6,speed:420,pierce:1},desc:'독 폭탄을 던져 맞은 자리 주변의 적 최대 6마리에게 피해를 줍니다.'},
      {skill:'14111005',kind:'star',mult:3.5,set:{count:b=>b.count+3,cooldown:b=>b.cooldown*1.2},desc:'표창을 세 갈래로 연달아 던집니다.'},
    ]},
  ],
  // Double Stab → Bandit: close-range flurries, and Steal: kills may drop an extra meso.
  '4001334':[
    {id:'bandit',job:'시프',tiers:[
      {skill:'4201005',kind:'stab',mult:1.4,set:{hits:6,cooldown:b=>b.cooldown*3.5,steal:.15},desc:'가까운 적을 여섯 번 연속으로 벱니다. 처치 시 15% 확률로 메소를 더 훔칩니다.'},
      {skill:'4211004',kind:'nova',mult:3.15,set:{targets:b=>b.count,radius:200,cooldown:b=>b.cooldown*1.5,steal:.2},desc:'동료 도적들이 나타나 주변 적들을 습격합니다. 처치 시 20% 확률로 메소를 더 훔칩니다.'},
      {skill:'4221007',kind:'stab',mult:3.9,set:{range:175,cooldown:b=>b.cooldown*1.8,steal:.25},desc:'부메랑처럼 돌진해 주변 적들을 두 번씩 벱니다. 처치 시 25% 확률로 메소를 더 훔칩니다.'},
    ]},
    // Dual Blade (KMS 1.2.95): Triple Stab, Bloody Storm (a whirl around the player), Sudden Raid (a huge burst).
    {id:'dualblade',job:'듀얼블레이드',tiers:[
      {skill:'4301001',kind:'stab',mult:1.12,set:{hits:3},desc:'가까운 적들을 양손의 칼로 세 번씩 찌릅니다.'},
      {skill:'4331000',kind:'blast',mult:1.57,set:{radius:150,targets:b=>b.count+4,hits:2,cooldown:b=>b.cooldown*1.5},desc:'칼날의 폭풍으로 주변의 적들을 두 번 벱니다.'},
      {skill:'4341004',kind:'blast',mult:1.9,set:{radius:240,targets:15,cooldown:b=>b.cooldown*3},desc:'순식간에 주변을 습격해 넓은 범위의 적 최대 15마리를 공격합니다.'},
    ]},
  ],
};
// Monsters join minute by minute. rate = spawns per second, max = monsters alive. WAVES/BOSSES/SWARMS are
// Henesys (stage 2); every stage is listed in STAGES below.
export const WAVES=[
  {pool:['0100100','0100101'],rate:1.2,max:30},
  {pool:['0100101','0120100','0130101'],rate:1.7,max:50},
  {pool:['0130101','0130100','0210100'],rate:2.2,max:70},
  {pool:['0210100','1210100','1210102'],rate:2.7,max:90},
  {pool:['1210102','1210101','1110100','1110101'],rate:3.2,max:115},
  {pool:['1110100','2220100','2110200'],rate:3.6,max:140},
  {pool:['2110200','1130100','1120100'],rate:4.1,max:165},
  {pool:['1120100','2230101','2230102'],rate:4.6,max:195},
  {pool:['2230102','2230100','2300100'],rate:5.1,max:225},
  {pool:['2230100','2130100','2130103','2300100'],rate:5.6,max:260},
];
export const BOSSES=[
  {at:150,id:'2220000',hp:900,damage:14,speed:55,patterns:['slam','summon'],summon:'0100101'},
  {at:300,id:'6130101',hp:3500,damage:22,speed:60,patterns:['slam','summon','slam','burst'],summon:'1210102',bullet:'#ffa64a'},
  {at:450,id:'6300005',hp:8000,damage:30,speed:66,patterns:['slam','burst','summon','volley'],summon:'2230101',bullet:'#a8e05a'},
  {at:RUN_TIME,id:'8130100',hp:18000,damage:42,speed:78,final:true,patterns:['dash','burst','volley','slam'],bullet:'#ff7a2a'},
];
// Boss patterns: each boss cycles through its own list. Every pattern shows a red warning first so it can be
// dodged: dash = charge in a line, slam = hit everything close, burst = a ring of bullets, volley = aimed
// bullets twice, summon = call minions (summon id). bullet = bullet colour.
// The warning always shows exactly where the attack lands (charge path, slam circle, bullet lanes); aim is locked
// when the warning starts, so stepping out of the red area dodges it ("플레이어가 반응하고 피할 수 있게").
export const BOSS_PATTERNS={dash:{warn:1,act:.6},slam:{warn:1.1,act:.25},burst:{warn:1,act:.5},volley:{warn:.9,act:.6},summon:{warn:.8,act:.2}};
const BURST_SPEED=165,VOLLEY_SPEED=240,VOLLEY_SPREAD=.22,BULLET_DAMAGE=.4;
const DASH_SPEED=420,SLAM_RADIUS=150;
export const SWARMS=[90,240,390,540];      // a ring of monsters closes in
// Stage 1, Lith Harbor: the snails, stumps and pigs on the road out of the harbor, octopuses on the shore,
// Mano of the beach thicket, Iron Hog of Pig Beach, then the crabs of Florina Beach. Weaker than Henesys.
const LITH_WAVES=[
  {pool:['0100100','0100101'],rate:1.1,max:28},
  {pool:['0100101','0130101'],rate:1.5,max:45},
  {pool:['0130101','0130100','1210100'],rate:2,max:62},
  {pool:['1210100','1210102','0130100'],rate:2.4,max:80},
  {pool:['1210100','1210101','1210102'],rate:2.8,max:100},
  {pool:['1210101','1120100','1110101'],rate:3.2,max:120},
  {pool:['1120100','1110101','1210101'],rate:3.6,max:140},
  {pool:['1120100','1110101','1130100'],rate:4,max:165},
  {pool:['1130100','1110101','1120100'],rate:4.4,max:190},
  {pool:['1130100','1120100','1110100'],rate:4.8,max:215},
];
const LITH_BOSSES=[
  {at:150,id:'2220000',hp:800,damage:12,speed:55,patterns:['slam','summon'],summon:'0100100'},
  {at:300,id:'4090000',hp:2400,damage:18,speed:62,scale:1.4,patterns:['dash','slam','dash']},
  {at:450,id:'4230104',hp:5000,damage:24,speed:66,scale:1.6,patterns:['dash','burst'],bullet:'#8fd8ff'},
  {at:RUN_TIME,id:'5220000',hp:11000,damage:32,speed:72,final:true,patterns:['burst','dash','summon','slam'],summon:'1120100',bullet:'#8fd8ff'},
];
// Stage 3, Ellinia: from the north field (snails, slimes) through the tree dungeons (stumps, mushrooms,
// Bubblings, Fairies, Evil/Curse Eyes) to the Monkey Forest and the Forest of Evil (Lupins, Zombie Lupins), where
// Faust waits. Harder than Henesys. Bosses that are normally field monsters are drawn larger (scale).
const ELLINIA_WAVES=[
  {pool:['0100101','0130101'],rate:1.3,max:30},
  {pool:['0130101','0210100'],rate:1.6,max:48},
  {pool:['0210100','1110101','1110100'],rate:2,max:64},
  {pool:['1110100','1210103','1130100'],rate:2.4,max:82},
  {pool:['1130100','2110200','1210103'],rate:2.8,max:100},
  {pool:['2110200','3000003','2230100'],rate:3.1,max:118},
  {pool:['3000003','2230100','2110200'],rate:3.5,max:140},
  {pool:['2230100','3210800','3000003'],rate:3.9,max:162},
  {pool:['3210800','3230100','2230100'],rate:4.3,max:190},
  {pool:['3230100','4230101','3210800'],rate:4.7,max:215},
];
const ELLINIA_BOSSES=[
  {at:150,id:'2230100',hp:1500,damage:18,speed:58,scale:1.8,patterns:['volley','burst'],bullet:'#c58cff'},
  {at:300,id:'4230101',hp:5000,damage:28,speed:64,scale:1.7,patterns:['volley','dash','volley'],bullet:'#ffd84a'},
  {at:450,id:'3230100',hp:11000,damage:36,speed:66,scale:2,patterns:['burst','volley','summon'],summon:'2230100',bullet:'#c58cff'},
  {at:RUN_TIME,id:'5220002',hp:26000,damage:50,speed:76,final:true,patterns:['dash','volley','slam','summon','burst'],summon:'3210800',bullet:'#7a5cff'},
];
// bgm/bossBgm are keys of combat.json bgm, maxJob the highest job advancement allowed. Clearing a stage unlocks the next one.
export const STAGES=[
  {id:'lith',num:1,name:'리스항구',title:'리스항구 해안가',waves:LITH_WAVES,bosses:LITH_BOSSES,swarms:SWARMS,bgm:'harbor',bossBgm:'boss',maxJob:2},
  {id:'henesys',num:2,name:'헤네시스',title:'헤네시스 들판',waves:WAVES,bosses:BOSSES,swarms:SWARMS,bgm:'field',bossBgm:'boss',maxJob:3},
  {id:'ellinia',num:3,name:'엘리니아',title:'엘리니아 숲',waves:ELLINIA_WAVES,bosses:ELLINIA_BOSSES,swarms:SWARMS,bgm:'ellinia',bossBgm:'boss',maxJob:4},
];
export const stageById=id=>STAGES.find(s=>s.id===id)??STAGES[0];
export const POTION_CHANCE=.004;
// EXP needed to leave level n (Vampire Survivors' curve scaled to Maple EXP values).
export function expNeed(level){return Math.round(10+(level-1)*12+Math.max(0,level-20)*10+Math.max(0,level-40)*16);}

// Monster stats from combat.json (client Mob.wz info) plus a body radius from the sprite.
export function rulesFrom(combat){
  const mobs={};
  for(const [id,m] of Object.entries(combat.mobs)){
    const a=m.actions,f=(a.move??a.fly??a.stand)?.[0],img=f?combat.images[f.img]:null;
    mobs[id]={name:m.name,hp:m.stats.maxHP??10,pad:m.stats.PADamage??10,exp:m.stats.exp??1,speedStat:m.stats.speed??0,
      radius:img?Math.max(10,Math.min(70,Math.round(img.w*.34))):16,height:img?.h??40,flying:!!a.fly};
  }
  return {mobs};
}

export function seededRandom(seed=65){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
const dist2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;

// job = {branch, tier} once the skill has advanced (tier 1 = 2nd job). kind/skill say how it fires and looks.
export function weaponStats(id,level,job=null){
  const w=WEAPONS[id],s={...w.base,kind:w.kind,skill:id};
  for(let i=0;i<Math.min(level,WEAPON_MAX)-1;i++)for(const [k,v]of Object.entries(w.ups[i]))s[k]=(s[k]??0)+v;
  const t=job&&JOBS[id]?.[job.branch]?.tiers[job.tier-1];
  // A set value can be a function of the 1st-job stats at this level, so a tier keeps the skill's volume as it levels.
  if(t){const b={...s};s.damage=Math.round(s.damage*t.mult);for(const [k,v]of Object.entries(t.set))s[k]=typeof v==='function'?v(b):v;s.kind=t.kind;s.skill=t.skill;}
  return s;
}
const UP_TEXT={targets:v=>`최대 대상 +${v}`,damage:v=>`피해 +${v}`,count:v=>`투사체 +${v}`,pierce:v=>v>=50?'모든 적 관통':`관통 +${v}`,cooldown:v=>`쿨타임 ${v}초`,area:v=>`범위 +${Math.round(v*100)}%`};
export function upgradeText(id,nextLevel){const up=WEAPONS[id].ups[nextLevel-2];return up?Object.entries(up).map(([k,v])=>UP_TEXT[k](v)).join(', '):'';}

export class Game{
  constructor(rules,random=Math.random,stage=STAGES[0].id){this.rules=rules;this.random=random;this.stage=stageById(stage);this.mode='menu';this.view={w:900,h:600};this.reset();}
  reset(){
    this.player={x:0,y:0,face:-1,dir:{x:-1,y:0},moving:false,level:1,exp:0,hp:PLAYER.hp,invincible:0,regenAcc:0};
    this.weapons={[START_WEAPON]:1};this.passives={};this.cooldowns={[START_WEAPON]:.4};
    this.mobs=[];this.projectiles=[];this.hazards=[];this.drops=[];this.effects=[];this.numbers=[];this.events=[];
    this.time=0;this.kills=0;this.serial=0;this.spawnAcc=0;this.boss=null;this.bossIndex=0;this.swarmIndex=0;
    this.choices=[];this.pendingLevels=0;this.choiceKind='upgrade';this.won=false;this.jobs={};
  }
  start(stage){if(stage)this.stage=stageById(stage);this.reset();this.mode='playing';for(let i=0;i<6;i++)this.spawn();}
  emit(type,data={}){this.events.push({type,...data});}
  get expNeed(){return expNeed(this.player.level);}
  stat(name){let v=0;for(const [id,lv]of Object.entries(this.passives))if(PASSIVES[id].stat===name)v+=PASSIVES[id].per*lv;return v;}
  get maxHp(){return Math.round(PLAYER.hp*(1+this.stat('maxHp')));}
  get moveSpeed(){return PLAYER.speed*(1+this.stat('speed'));}
  get pickupRadius(){return PLAYER.pickup*(1+this.stat('magnet'));}
  get wave(){const w=this.stage.waves;return w[Math.min(w.length-1,Math.floor(this.time/60))];}
  get bosses(){return this.stage.bosses;}
  stats(id){return weaponStats(id,this.weapons[id]??1,this.jobs[id]);}
  skillOf(id){return this.stats(id).skill;}   // the client skill a weapon slot currently shows
  // Monsters toughen a little within the run on top of the stronger species that join each minute.
  get hpScale(){return TUNING.mobHp*(1+TUNING.hpGrowth*Math.min(this.time,RUN_TIME)/RUN_TIME);}

  // ---------- update ----------
  update(delta,input={}){
    if(this.mode!=='playing')return;
    const dt=Math.max(0,Math.min(delta,.05));this.time+=dt;
    this.updatePlayer(dt,input);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateMobs(dt);
    if(this.mode==='playing')this.updateHazards(dt);
    if(this.mode!=='playing')return;
    this.updateDrops(dt);
    this.updateSpawns(dt);
    for(const e of this.effects)e.t+=dt;this.effects=this.effects.filter(e=>e.t<e.life);
    for(const n of this.numbers)n.t+=dt;this.numbers=this.numbers.filter(n=>n.t<1);
    if(this.pendingLevels&&this.mode==='playing')this.openChoices();
  }
  updatePlayer(dt,input){
    const p=this.player;let x=input.x??0,y=input.y??0;const len=Math.hypot(x,y);
    if(len>1){x/=len;y/=len;}
    p.moving=len>.1;
    if(p.moving){p.x+=x*this.moveSpeed*dt;p.y+=y*this.moveSpeed*dt;const l=Math.hypot(x,y);p.dir={x:x/l,y:y/l};if(Math.abs(x)>.15)p.face=x>0?1:-1;}
    p.invincible=Math.max(0,p.invincible-dt);
    p.regenAcc+=this.stat('regen')*dt;if(p.regenAcc>=1){const n=Math.floor(p.regenAcc);p.regenAcc-=n;p.hp=Math.min(this.maxHp,p.hp+n);}
  }

  // ---------- weapons ----------
  updateWeapons(dt){
    const haste=Math.max(.35,1-this.stat('haste'));
    for(const [id,level]of Object.entries(this.weapons)){
      this.cooldowns[id]=(this.cooldowns[id]??0)-dt;
      if(this.cooldowns[id]>0)continue;
      const s=weaponStats(id,level,this.jobs[id]);
      if(this.fire(id,level,s)){this.cooldowns[id]=s.cooldown*haste;this.emit('fire',{weapon:id,skill:s.skill});if(s.heal)this.heal(s.heal);}
      else this.cooldowns[id]=.1; // nothing to aim at yet
    }
  }
  heal(n){const p=this.player,before=p.hp;p.hp=Math.min(this.maxHp,p.hp+n);if(p.hp>before)this.numbers.push({x:p.x,y:p.y-70,value:Math.round(p.hp-before),kind:'heal',t:0});}
  alive(){return this.mobs.filter(m=>!m.dying);}
  nearest(count,range=Infinity,from=this.player){
    const r2=range*range;return this.alive().map(m=>[dist2(m,from),m]).filter(([d])=>d<=r2).sort((a,b)=>a[0]-b[0]).slice(0,count).map(([,m])=>m);
  }
  fire(id,level,s){
    const p=this.player,kind=s.kind,fx=s.skill,area=(s.area??1)*(1+this.stat('area')),freeze=s.freeze??0;
    const on={freeze,crit:s.crit??0,steal:s.steal??0,stun:s.stun??0,weaken:s.weaken??0,push:s.push??0};   // carried by every hit of this cast
    const look=s.look??fx;   // the cast animation (Final Attack / Threaten have none of their own: Power Strike's is shown)
    // Final Attack: each monster hit may be struck once more right after.
    const follow=(mobs,delay)=>{if(s.follow)for(const m of mobs)if(this.random()<s.follow)this.damageMob(m,s.damage,fx,{delay:delay+.28,hitIndex:1,...on});};
    const shot=(angle,extra={})=>this.projectiles.push({weapon:id,skill:fx,kind,on,spin:!!s.spin,splash:s.splash??0,splashTargets:(s.targets??1)-1,x:p.x,y:p.y-28,vx:Math.cos(angle)*s.speed,vy:Math.sin(angle)*s.speed,speed:s.speed,angle,
      life:(s.range+SHOT_EXTRA)/s.speed,damage:s.damage,pierce:s.pierce,hit:new Set(),tier:level>=6?2:level>=3?1:0,...extra});
    if(kind==='shell'){
      const [t]=this.nearest(1,s.range);if(!t)return false;
      const a=Math.atan2(t.y-t.height/2-(p.y-28),t.x-p.x);
      for(let i=0;i<s.count;i++)shot(a,{delay:i*.1}); // one straight line, shell after shell
      return true;
    }
    if(kind==='bolt'){
      const targets=this.nearest(s.count,s.range);if(!targets.length)return false;
      for(let i=0;i<s.count;i++){const t=targets[i%targets.length];shot(Math.atan2(t.y-p.y,t.x-p.x),{target:t.id,delay:i*.1});}
      return true;
    }
    if(kind==='star'){
      const targets=this.nearest(s.count,s.range);if(!targets.length)return false;
      for(let i=0;i<s.count;i++){const t=targets[i%targets.length];shot(Math.atan2(t.y-t.height/2-(p.y-28),t.x-p.x)+(i>=targets.length?(this.random()-.5)*.4:0),{delay:i*.07});}
      return true;
    }
    if(kind==='arrow'){
      const [t]=this.nearest(1,s.range);if(!t)return false;
      const a=Math.atan2(t.y-t.height/2-(p.y-28),t.x-p.x),spread=s.spread??.12,gap=s.interval??.05;
      for(let i=0;i<s.count;i++)shot(a+(i-(s.count-1)/2)*spread,{delay:i*gap});
      return true;
    }
    if(kind==='strike'){
      if(!this.nearest(1,160*area).length)return false;
      const w=150*area,h=70*area;
      for(let i=0;i<s.count;i++){const face=i?-p.face:p.face;
        const box={x1:face>0?p.x:p.x-w,x2:face>0?p.x+w:p.x,y1:p.y-30-h/2,y2:p.y-30+h/2};
        this.effects.push({kind:'skill',skill:look,x:p.x,y:p.y,face,t:-i*.12,life:1.2,follow:true});
        const hit=this.alive().filter(m=>m.x+m.radius>=box.x1&&m.x-m.radius<=box.x2&&m.y>=box.y1&&m.y-m.height<=box.y2);
        for(let h=0;h<(s.hits??1);h++)for(const m of hit)this.damageMob(m,s.damage,fx,{delay:i*.12+h*.14,hitIndex:h,...on});
        follow(hit,i*.12);
      }
      return true;
    }
    if(kind==='blast'){
      const r=(s.radius??95)*area;if(!this.nearest(1,r+15).length)return false;
      this.effects.push({kind:'skill',skill:look,x:p.x,y:p.y,face:p.face,t:0,life:1,follow:true,radius:r});
      let hit=this.alive().filter(m=>dist2(m,p)<=(r+m.radius)**2);
      if(s.targets)hit=hit.sort((a,b)=>dist2(a,p)-dist2(b,p)).slice(0,s.targets);   // Somersault Kick line: at most N monsters
      for(let h=0;h<(s.hits??1);h++)for(const m of hit)this.damageMob(m,s.damage,fx,{delay:h*.12,hitIndex:h,...on});
      follow(hit,0);
      return true;
    }
    if(kind==='rain'){      // Arrow Rain / Arrow Eruption: arrows strike every monster around the nearest ones
      const spots=this.nearest(s.count,s.range);if(!spots.length)return false;
      const r=s.radius*area;
      this.effects.push({kind:'skill',skill:fx,x:p.x,y:p.y,face:p.face,t:0,life:1,follow:true});
      spots.forEach((t,i)=>{const cx=t.x,cy=t.y;
        this.effects.push({kind:'zone',x:cx,y:cy,r,t:-i*.1,life:.35+s.waves*.2});
        const near=this.alive().map(m=>[(m.x-cx)**2+(m.y-cy)**2,m]).filter(([d,m])=>d<=(r+m.radius)**2).sort((a,b)=>a[0]-b[0]).slice(0,s.targets).map(([,m])=>m);
        for(let w=0;w<s.waves;w++)near.forEach(m=>this.damageMob(m,s.damage,fx,{delay:.25+i*.1+w*.2,hitIndex:w,...on}));});
      return true;
    }
    if(kind==='nova'){      // Thunder Bolt: strike several monsters around the caster (more as the skill levels)
      const targets=this.nearest(Math.min(s.targets,s.count+2),s.radius*area);if(!targets.length)return false;
      this.effects.push({kind:'skill',skill:fx,x:p.x,y:p.y,face:p.face,t:0,life:1,follow:true});
      targets.forEach((m,i)=>{for(let h=0;h<(s.hits??1);h++)this.damageMob(m,s.damage,fx,{delay:.12+i*.04+h*.12,hitIndex:h,...on});});
      return true;
    }
    if(kind==='lance'){     // Thunder Spear: a piercing line toward the nearest monsters
      const targets=this.nearest(s.count,s.range);if(!targets.length)return false;
      const len=s.range+SHOT_EXTRA,half=s.width*area/2,ox=p.x,oy=p.y-28;
      this.effects.push({kind:'skill',skill:fx,x:p.x,y:p.y,face:p.face,t:0,life:1.3,follow:true});
      for(let i=0;i<s.count;i++){
        const t=targets[i%targets.length],a=Math.atan2(t.y-t.height/2-oy,t.x-ox),dx=Math.cos(a),dy=Math.sin(a);
        this.effects.push({kind:'beam',skill:fx,x:ox,y:oy,x2:ox+dx*len,y2:oy+dy*len,width:half*2,t:-.1-i*.15,life:.35,tint:s.beam});
        const line=[];for(const m of this.alive()){const mx=m.x-ox,my=m.y-m.height/2-oy,along=mx*dx+my*dy;if(along>0&&along<len&&Math.abs(mx*dy-my*dx)<half+m.radius)line.push([along,m]);}
        line.sort((a,b)=>a[0]-b[0]).slice(0,s.pierce).forEach(([,m])=>this.damageMob(m,s.damage,fx,{delay:.1+i*.15,...on}));
      }
      return true;
    }
    if(kind==='chain'){     // Chain Lightning: jumps from monster to monster
      const starts=this.nearest(s.count,s.range);if(!starts.length)return false;
      this.effects.push({kind:'skill',skill:fx,x:p.x,y:p.y,face:p.face,t:0,life:1,follow:true});
      for(const first of starts){
        const hit=[first],r2=(s.jump*area)**2;let cur=first;
        while(hit.length<=s.jumps){let next=null,best=r2;for(const m of this.alive())if(!hit.includes(m)){const d=dist2(m,cur);if(d<best){best=d;next=m;}}if(!next)break;hit.push(next);cur=next;}
        this.effects.push({kind:'chain',skill:fx,points:[{x:p.x,y:p.y-28},...hit.map(m=>({x:m.x,y:m.y-m.height/2}))],t:0,life:.4});
        hit.forEach((m,i)=>this.damageMob(m,s.damage,fx,{delay:i*.05,...on}));
      }
      return true;
    }
    if(kind==='meteor'){    // Meteor: rocks fall on many monsters across a wide area
      const pool=this.nearest(Infinity,s.range*1.4*area);if(!pool.length)return false;
      this.effects.push({kind:'skill',skill:fx,x:p.x,y:p.y,face:p.face,t:0,life:2.4,follow:true});
      for(let i=0;i<s.targets&&pool.length;i++){const m=pool.splice(Math.floor(this.random()*pool.length),1)[0];this.damageMob(m,s.damage,fx,{delay:.6+i*.05,...on});}
      return true;
    }
    if(kind==='claw'){
      const pool=this.nearest(Infinity,s.range);if(!pool.length)return false;
      for(let i=0;i<s.count&&pool.length;i++){const m=pool.splice(Math.floor(this.random()*pool.length),1)[0];
        for(let h=0;h<2;h++)this.damageMob(m,s.damage,fx,{hitIndex:h,delay:i*.1+h*.12,...on});}
      return true;
    }
    if(kind==='stab'){
      const targets=this.nearest(s.count,s.range*area);if(!targets.length)return false;
      if(s.skill!==id)this.effects.push({kind:'skill',skill:fx,x:p.x,y:p.y,face:p.face,t:0,life:1.2,follow:true});
      const hits=s.hits??2;
      targets.forEach((m,i)=>{for(let h=0;h<hits;h++)this.damageMob(m,s.damage,fx,{hitIndex:h,delay:i*.08+h*(hits>2?.07:.1),...on});});
      return true;
    }
    return false;
  }
  hitArea(test,damage,id,opts={}){let n=0;for(const m of this.alive())if(test(m)){this.damageMob(m,damage,id,opts);n++;}return n;}
  rollDamage(base,critBonus=0){
    const crit=this.random()<.05+this.stat('crit')+critBonus;let v=base*(1+this.stat('might'))*(.9+this.random()*.2);if(crit)v*=1.5;
    return {value:Math.max(1,Math.round(v)),crit};
  }
  // Damage lands now, or after `delay` seconds for multi-hit skills (the hit queue drains in updateMobs).
  damageMob(m,base,weapon,opts={}){
    const {hitIndex=0,delay=0,freeze=0,quiet=false,crit:critBonus=0,steal=0,stun=0,weaken=0,push=0}=opts;
    if(delay>0){(m.queued??=[]).push({base,weapon,opts:{...opts,delay:0},t:delay});return;}
    if(m.dying)return;
    let {value,crit}=this.rollDamage(base,critBonus);
    if(m.weak>0)value=Math.round(value*WEAK.taken);   // Threaten
    m.hp-=value;
    this.numbers.push({x:m.x,y:m.y-m.height-hitIndex*22,value,crit,kind:'dealt',t:0});
    if(!quiet)this.effects.push({kind:'hit',skill:weapon,x:m.x,y:m.y-m.height/2,face:this.player.face,t:0,life:3}); // app stops at the last frame
    if(m.hp<=0){
      // Steal (Bandit line): a kill may drop a second meso.
      if(steal&&!m.boss&&this.random()<steal){this.drops.push({kind:'meso',x:m.x+14,y:m.y+4,value:m.exp,id:++this.serial});this.emit('steal');}
      this.kill(m);return;}
    m.flash=.15;
    if(!m.boss){
      if(freeze){m.frozen=Math.max(m.frozen??0,freeze);m.stun=false;}
      else if(stun&&!(m.frozen>stun)){m.frozen=stun;m.stun=true;}   // stunned: held in place, not icy
      if(push){const d=Math.sqrt(dist2(m,this.player))||1;m.kb={x:(m.x-this.player.x)/d*push/.2,y:(m.y-this.player.y)/d*push/.2,t:.2};}
    }
    if(weaken)m.weak=Math.max(m.weak??0,weaken);
    if(!m.boss){const d=Math.sqrt(dist2(m,this.player))||1;m.x+=(m.x-this.player.x)/d*7;m.y+=(m.y-this.player.y)/d*7;}
    this.emit('mobHit',{mob:m.type});
  }
  kill(m){
    m.hp=0;m.dying=.001;m.queued=null;this.kills++;
    this.emit('kill',{mob:m.type,boss:!!m.boss});
    this.drops.push({kind:'meso',x:m.x,y:m.y,value:m.exp,id:++this.serial});
    if(m.boss){
      this.drops.push({kind:'potion',item:'02000005',x:m.x+24,y:m.y,id:++this.serial});
      if(this.boss===m)this.boss=null;
      this.emit('bossDown',{mob:m.type,final:!!m.final});
      if(m.final){this.won=true;this.mode='won';this.emit('end',{won:true});return;}
      this.pendingLevels++;this.choiceKind='reward';
    }else if(this.random()<POTION_CHANCE)this.drops.push({kind:'potion',item:'02000000',x:m.x,y:m.y,id:++this.serial});
  }

  // ---------- projectiles ----------
  updateProjectiles(dt){
    const p=this.player;
    for(const b of this.projectiles){
      if(b.delay>0){b.delay-=dt;b.x=p.x;b.y=p.y-28;continue;}
      b.life-=dt;
      if(b.target!=null){const t=this.mobs.find(m=>m.id===b.target&&!m.dying);
        if(t){const dx=t.x-b.x,dy=t.y-t.height/2-b.y,d=Math.hypot(dx,dy)||1;b.vx=dx/d*b.speed;b.vy=dy/d*b.speed;b.angle=Math.atan2(dy,dx);}
        else{const [n]=this.nearest(1,300,b);b.target=n?.id??null;}}
      b.x+=b.vx*dt;b.y+=b.vy*dt;
      for(const m of this.mobs){
        if(m.dying||b.hit.has(m.id))continue;
        if((m.x-b.x)**2+(m.y-m.height/2-b.y)**2>(m.radius+8)**2)continue;
        b.hit.add(m.id);this.damageMob(m,b.damage,b.skill??b.weapon,b.on);
        // Arrow Bomb: bursts where it lands, hurting everything around (one explosion drawn).
        if(b.splash){
          this.alive().filter(o=>!b.hit.has(o.id)&&(o.x-m.x)**2+(o.y-m.y)**2<=(b.splash+o.radius)**2).sort((a,c)=>dist2(a,m)-dist2(c,m))
            .slice(0,b.splashTargets).forEach(o=>{b.hit.add(o.id);this.damageMob(o,b.damage,b.skill,{...b.on,quiet:true});});
          b.life=0;break;}
        if(b.hit.size>=b.pierce){b.life=0;break;}
      }
    }
    this.projectiles=this.projectiles.filter(b=>b.life>0);
  }

  // ---------- monsters ----------
  spawn(type){
    const wave=this.wave;type??=wave.pool[Math.floor(this.random()*wave.pool.length)];
    if(this.alive().length>=wave.max*TUNING.mobMax)return null;
    const a=this.random()*Math.PI*2;
    return this.addMob(type,a,this.spawnDistance());
  }
  spawnDistance(){return Math.hypot(this.view.w/2,this.view.h/2)+60;}
  addMob(type,angle,distance,extra={}){
    const r=this.rules.mobs[type];if(!r)return null;const p=this.player;
    const hp=Math.max(1,Math.round(r.hp**.72*this.hpScale));
    const m={id:++this.serial,type,x:p.x+Math.cos(angle)*distance,y:p.y+Math.sin(angle)*distance,hp,maxHp:hp,exp:r.exp,
      damage:Math.round((4+r.pad*.15)*TUNING.mobDamage),speed:Math.max(28,60*(1+r.speedStat/150)),radius:r.radius,height:r.height,flying:r.flying,
      face:-1,anim:this.random()*1000,flash:0,dying:0,boss:false,...extra};
    this.mobs.push(m);return m;
  }
  spawnBoss(def){
    const r=this.rules.mobs[def.id],scale=def.scale??1;
    const hp=Math.round(def.hp*TUNING.bossHp);
    const m=this.addMob(def.id,this.random()*Math.PI*2,this.spawnDistance(),{boss:true,final:!!def.final,hp,maxHp:hp,damage:Math.round(def.damage*TUNING.mobDamage),speed:def.speed,exp:Math.round(r.exp*.5),
      scale,radius:Math.round(r.radius*scale),height:Math.round(r.height*scale),patterns:def.patterns??[],summon:def.summon,bullet:def.bullet??'#ff6a5a',patCd:2.5});
    if(m){this.boss=m;this.emit('boss',{mob:def.id,final:!!def.final});}
    return m;
  }
  swarm(){
    const pool=this.wave.pool,type=pool[0],n=22+this.swarmIndex*6;
    for(let i=0;i<n;i++)this.addMob(type,i/n*Math.PI*2,Math.min(this.view.w,this.view.h)*.55+40,{swarm:true});
    this.emit('swarm',{count:n});
  }
  updateSpawns(dt){
    const b=this.stage.bosses[this.bossIndex];
    if(b&&this.time>=b.at){this.bossIndex++;this.spawnBoss(b);}
    const sw=this.stage.swarms;
    if(sw[this.swarmIndex]!=null&&this.time>=sw[this.swarmIndex]){this.swarm();this.swarmIndex++;}
    this.spawnAcc+=dt*this.wave.rate*TUNING.spawnRate;
    while(this.spawnAcc>=1){this.spawnAcc--;this.spawn();}
  }
  updateMobs(dt){
    const p=this.player,cell=48,grid=new Map(),key=(x,y)=>`${Math.floor(x/cell)},${Math.floor(y/cell)}`;
    for(const m of this.mobs)if(!m.dying){const k=key(m.x,m.y);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(m);}
    for(const m of this.mobs){
      m.anim+=dt*1000;
      if(m.dying){m.dying+=dt;continue;}
      if(m.queued?.length){for(const q of m.queued)q.t-=dt;const due=m.queued.filter(q=>q.t<=0);m.queued=m.queued.filter(q=>q.t>0);
        for(const q of due){this.damageMob(m,q.base,q.weapon,q.opts);if(m.dying)break;}if(m.dying)continue;}
      m.flash=Math.max(0,m.flash-dt);
      if(m.weak>0)m.weak-=dt;
      if(m.kb){m.x+=m.kb.x*dt;m.y+=m.kb.y*dt;if((m.kb.t-=dt)<=0)m.kb=null;continue;}   // shoved back (Rush)
      // A frozen monster neither moves nor hurts the player.
      if(m.frozen>0){m.frozen-=dt;continue;}
      const dx=p.x-m.x,dy=p.y-m.y,d=Math.hypot(dx,dy)||1;
      // Far behind the player: move ahead of them instead (no EXP), like the original game.
      if(d>DESPAWN&&!m.boss){const a=Math.atan2(p.dir.y,p.dir.x)+(this.random()-.5)*1.6,r=this.spawnDistance();m.x=p.x+Math.cos(a)*r;m.y=p.y+Math.sin(a)*r;continue;}
      if(!(m.boss&&this.updateBoss(m,dt))){   // a boss pattern holds or moves the boss itself
        const speed=m.speed*(m.flash>0?.3:1);
        m.x+=dx/d*speed*dt;m.y+=dy/d*speed*dt;if(Math.abs(dx)>4)m.face=dx>0?1:-1;
      }
      // Monsters push each other apart so crowds spread out.
      const cx=Math.floor(m.x/cell),cy=Math.floor(m.y/cell);
      for(let gx=cx-1;gx<=cx+1;gx++)for(let gy=cy-1;gy<=cy+1;gy++)for(const o of grid.get(`${gx},${gy}`)??[]){
        if(o===m||o.dying)continue;const ox=m.x-o.x,oy=m.y-o.y,min=(m.radius+o.radius)*.7,dd=ox*ox+oy*oy;
        if(dd>=min*min||dd===0)continue;const l=Math.sqrt(dd),push=(min-l)/2;
        const wm=m.boss?.1:o.boss?.9:.5;m.x+=ox/l*push*2*wm;m.y+=oy/l*push*2*wm;
      }
      // Contact damage with a short invincibility after each hit.
      if(p.invincible===0&&(m.x-p.x)**2+(m.y-p.y)**2<=(m.radius*.8+PLAYER.radius)**2){this.hurt(m.weak>0?{damage:m.damage*WEAK.dealt,type:m.type}:m);if(this.mode!=='playing')return;}
    }
    this.mobs=this.mobs.filter(m=>!(m.dying&&m.dying>1.2));
  }
  // ---------- boss patterns ----------
  updateBoss(m,dt){
    if(!m.patterns?.length)return false;
    const p=this.player;
    if(!m.pat){
      m.patCd-=dt;if(m.patCd>0||dist2(m,p)>560**2)return false;
      m.patIndex=((m.patIndex??-1)+1)%m.patterns.length;
      const kind=m.patterns[m.patIndex],a=Math.atan2(p.y-m.y,p.x-m.x);
      m.pat={kind,t:0,fired:false,dir:{x:Math.cos(a),y:Math.sin(a)}};
      const P=BOSS_PATTERNS[kind],life=P.warn;
      if(kind==='dash')this.effects.push({kind:'warn',shape:'line',x:m.x,y:m.y,x2:m.x+m.pat.dir.x*DASH_SPEED*P.act,y2:m.y+m.pat.dir.y*DASH_SPEED*P.act,width:m.radius*1.6,t:0,life});
      else if(kind==='slam')this.effects.push({kind:'warn',shape:'ring',x:m.x,y:m.y,r:SLAM_RADIUS+m.radius,t:0,life});
      else{
        const mid={x:m.x,y:m.y-m.height/2};
        this.effects.push({kind:'warn',shape:'glow',x:mid.x,y:mid.y,r:m.radius+20,color:m.bullet,t:0,life});
        // bullet lanes, fixed now: burst = a ring (final bosses add a second ring in the gaps), volley = 3 aimed lanes
        if(kind==='burst'){const n=m.final?14:10,off=this.random()*Math.PI;
          m.pat.angles=[...Array(n)].map((_,i)=>off+i/n*Math.PI*2);m.pat.angles2=m.final?m.pat.angles.map(a=>a+Math.PI/n):[];}
        if(kind==='volley'){const a=Math.atan2(p.y-28-mid.y,p.x-mid.x);m.pat.angles=[-1,0,1].map(i=>a+i*VOLLEY_SPREAD);m.pat.angles2=[];}
        if(m.pat.angles)this.effects.push({kind:'warn',shape:'lanes',x:mid.x,y:mid.y,angles:[...m.pat.angles,...m.pat.angles2],len:kind==='burst'?380:620,width:22,t:0,life});
      }
      this.emit('bossSkill',{mob:m.type,kind});
    }
    const pt=m.pat,P=BOSS_PATTERNS[pt.kind];pt.t+=dt;
    if(pt.t<P.warn)return true;                          // winding up in place
    if(!pt.fired){pt.fired=true;this.bossAct(m);}
    if(pt.kind==='dash'&&pt.t<P.warn+P.act){m.x+=pt.dir.x*DASH_SPEED*dt;m.y+=pt.dir.y*DASH_SPEED*dt;m.face=pt.dir.x>0?1:-1;}
    if(pt.t>=P.warn+P.act){m.pat=null;m.patCd=m.final?2.4:3.2;}
    return true;
  }
  bossAct(m){
    const p=this.player,kind=m.pat.kind,mid={x:m.x,y:m.y-m.height/2};
    const bullet=(angle,speed,delay=0)=>this.hazards.push({x:mid.x,y:mid.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:10,delay,life:4,
      damage:Math.round(m.damage*BULLET_DAMAGE),type:m.type,color:m.bullet});
    if(kind==='slam'){
      const r=SLAM_RADIUS+m.radius;this.effects.push({kind:'shock',x:m.x,y:m.y,r,t:0,life:.45});
      if(p.invincible===0&&dist2(m,p)<=(r+PLAYER.radius)**2)this.hurt({damage:Math.round(m.damage*1.3),type:m.type});
    }else if(kind==='burst'){
      for(const a of m.pat.angles)bullet(a,BURST_SPEED);
      for(const a of m.pat.angles2)bullet(a,BURST_SPEED,.45);
    }else if(kind==='volley'){
      for(let w=0;w<2;w++)for(const a of m.pat.angles)bullet(a,VOLLEY_SPEED,w*.3);   // two waves down the warned lanes
    }else if(kind==='summon'&&m.summon&&this.rules.mobs[m.summon]){
      const n=m.final?6:4;
      for(let i=0;i<n;i++){const a=i/n*Math.PI*2,c=this.addMob(m.summon,0,0);if(c){c.x=m.x+Math.cos(a)*(m.radius+50);c.y=m.y+Math.sin(a)*(m.radius+30);}}
      this.effects.push({kind:'shock',x:m.x,y:m.y,r:m.radius+60,t:0,life:.35,color:'#fff2b0'});
    }
  }
  updateHazards(dt){
    const p=this.player;
    for(const h of this.hazards){
      if(h.delay>0){h.delay-=dt;continue;}
      h.life-=dt;h.x+=h.vx*dt;h.y+=h.vy*dt;
      if(p.invincible===0&&(h.x-p.x)**2+(h.y-(p.y-28))**2<=(h.r+PLAYER.radius)**2){h.life=0;this.hurt(h);if(this.mode!=='playing')return;}
    }
    this.hazards=this.hazards.filter(h=>h.life>0);
  }
  hurt(m){
    const p=this.player;p.invincible=PLAYER.invincible;
    if(this.random()<this.stat('dodge')){this.numbers.push({x:p.x,y:p.y-70,value:'MISS',kind:'miss',t:0});return;}
    const dmg=Math.max(1,Math.round(m.damage*(1-Math.min(.6,this.stat('armor')))*(.9+this.random()*.2)));
    p.hp=Math.max(0,p.hp-dmg);
    this.numbers.push({x:p.x,y:p.y-70,value:dmg,kind:'taken',t:0});this.emit('hurt',{mob:m.type});
    if(p.hp<=0){this.mode='lost';this.emit('end',{won:false});}
  }

  // ---------- drops ----------
  updateDrops(dt){
    const p=this.player,r2=this.pickupRadius**2;
    for(const d of this.drops){
      d.t=(d.t??0)+dt;
      const dd=(d.x-p.x)**2+(d.y-p.y)**2;
      if(!d.pull&&dd<=r2)d.pull=120;
      if(d.pull){d.pull=Math.min(900,d.pull+1100*dt);const l=Math.sqrt(dd)||1,step=Math.min(l,d.pull*dt);d.x-=(d.x-p.x)/l*step;d.y-=(d.y-p.y)/l*step;}
      if((d.x-p.x)**2+(d.y-p.y)**2<16*16){d.taken=true;this.collect(d);}
    }
    this.drops=this.drops.filter(d=>!d.taken);
    // Keep the field readable: merge the oldest small mesos into one bag.
    if(this.drops.length>400){const old=this.drops.filter(d=>d.kind==='meso'&&!d.pull).slice(0,100),sum=old.reduce((s,d)=>s+d.value,0);
      this.drops=this.drops.filter(d=>!old.includes(d));if(sum)this.drops.push({kind:'meso',x:old[0].x,y:old[0].y,value:sum,id:++this.serial});}
  }
  collect(d){
    if(d.kind==='potion'){const p=this.player,heal=d.item==='02000005'?this.maxHp:30;p.hp=Math.min(this.maxHp,p.hp+heal);this.emit('potion',{item:d.item,heal});return;}
    this.emit('pickup',{value:d.value});this.gainExp(d.value*(1+this.stat('growth')));
  }
  gainExp(v){
    const p=this.player;p.exp+=v;
    while(p.exp>=this.expNeed){p.exp-=this.expNeed;p.level++;this.pendingLevels++;this.emit('level',{level:p.level});}
  }

  // ---------- level-up choices ----------
  choicePool(){
    const pool=[],nw=Object.keys(this.weapons).length,np=Object.keys(this.passives).length;
    for(const id of Object.keys(WEAPONS)){const lv=this.weapons[id];
      if(lv&&lv<WEAPON_MAX)pool.push({type:'weapon',id,level:lv+1});else if(!lv&&nw<MAX_WEAPONS)pool.push({type:'weapon',id,level:1});}
    for(const id of Object.keys(PASSIVES)){const lv=this.passives[id];
      if(lv&&lv<PASSIVE_MAX)pool.push({type:'passive',id,level:lv+1});else if(!lv&&np<MAX_PASSIVES)pool.push({type:'passive',id,level:1});}
    return pool;
  }
  // Job advancements a boss reward can offer: skills with a job line, high enough, below the stage's limit.
  // A skill not yet advanced offers every branch (as Maple's 2nd-job choice).
  advanceChoices(){
    const out=[],limit=(this.stage.maxJob??4)-1;
    for(const [id,lv]of Object.entries(this.weapons)){
      const lines=JOBS[id],job=this.jobs[id],tier=job?.tier??0;
      if(!lines||tier>=Math.min(limit,lines[0].tiers.length)||lv<ADV_LEVEL[tier])continue;
      if(job)out.push({type:'advance',id,branch:job.branch,tier:tier+1});else lines.forEach((l,b)=>out.push({type:'advance',id,branch:b,tier:1}));
    }
    return out;
  }
  openChoices(){
    const pool=this.choicePool();this.choices=[];
    if(this.choiceKind==='reward')this.choices.push(...this.advanceChoices().slice(0,3));
    // Early on, always offer a new weapon so the build grows.
    const fresh=pool.filter(c=>c.type==='weapon'&&c.level===1);
    if(fresh.length&&Object.keys(this.weapons).length<3&&this.choices.length<3)this.choices.push(fresh[Math.floor(this.random()*fresh.length)]);
    const rest=pool.filter(c=>!this.choices.includes(c));
    while(this.choices.length<3&&rest.length)this.choices.push(rest.splice(Math.floor(this.random()*rest.length),1)[0]);
    if(!this.choices.length)this.choices.push({type:'heal',id:'02000000'},{type:'exp',id:'09000003'});
    this.mode=this.choiceKind==='reward'?'reward':'upgrade';
  }
  choose(index){
    if(!['upgrade','reward'].includes(this.mode)||!this.choices[index])return false;
    const c=this.choices[index],p=this.player;
    if(c.type==='weapon'){this.weapons[c.id]=c.level;this.cooldowns[c.id]??=.3;}
    else if(c.type==='passive'){const before=this.maxHp;this.passives[c.id]=c.level;if(this.maxHp>before)p.hp+=this.maxHp-before;}
    else if(c.type==='heal')p.hp=Math.min(this.maxHp,p.hp+30);
    else if(c.type==='advance'){this.jobs[c.id]={branch:c.branch,tier:c.tier};this.emit('advance',{weapon:c.id,skill:this.skillOf(c.id),tier:c.tier});}
    // A boss reward also restores HP.
    if(this.mode==='reward')p.hp=this.maxHp;
    this.emit('choose',{choice:c});this.choices=[];this.choiceKind='upgrade';
    this.pendingLevels=Math.max(0,this.pendingLevels-1);
    this.mode='playing';if(this.pendingLevels)this.openChoices();
    return true;
  }
  pause(){if(this.mode==='playing')this.mode='paused';else if(this.mode==='paused')this.mode='playing';}
  snapshot(){
    const p=this.player;
    return {stage:this.stage.id,mode:this.mode,time:this.time,kills:this.kills,level:p.level,exp:p.exp,expNeed:this.expNeed,hp:p.hp,maxHp:this.maxHp,x:p.x,y:p.y,
      mobs:this.alive().length,drops:this.drops.length,projectiles:this.projectiles.length,hazards:this.hazards.length,boss:this.boss?{id:this.boss.type,hp:this.boss.hp,maxHp:this.boss.maxHp}:null,
      weapons:{...this.weapons},passives:{...this.passives},jobs:structuredClone(this.jobs)};
  }
}
