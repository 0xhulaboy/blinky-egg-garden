const N=8, types=[{image:'egg-lava-card-face-v2.png',name:'Fire'},{image:'egg-space-card-face-v2.png',name:'Magic'},{image:'egg-pink-card-face-v2.png',name:'Pink'},{image:'egg-water-card-face-v2.png',name:'Water'},{image:'egg-tree-card-face-v2.png',name:'Leaf'},{image:'egg-light-card-face-v2.png',name:'Light'}];
const $=id=>document.getElementById(id), sleep=ms=>new Promise(r=>setTimeout(r,ms));let board=[],score=0,moves=45,selected=-1,busy=false,sound=false,audio;
const SAVE_KEY='blinky-garden-v2';
let level=1,mode='adventure',sessions={},saved=false;
let dailyDate='',rngState=0,bestCombo=0,dailyBests={};
const dayKey=()=>new Date().toISOString().slice(0,10);
function seedFor(date){let h=2166136261;for(const c of 'blinky-daily-v1:'+date)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function randomTile(){if(mode!=='daily')return Math.floor(Math.random()*6);rngState=(rngState+0x6D2B79F5)>>>0;let t=rngState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return Math.floor(((t^(t>>>14))>>>0)/4294967296*6);}
function validDaily(s){return valid(s)&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&s.moves<=30&&Number.isInteger(s.rng)&&s.rng>=0&&s.rng<=4294967295&&Number.isSafeInteger(s.combo)&&s.combo>=0;}
function recordDaily(){if(mode!=='daily'||moves!==0)return;const old=dailyBests[dailyDate];if(!old||score>old.score||score===old.score&&bestCombo>old.combo)dailyBests[dailyDate]={score,combo:bestCombo};}
function shareText(){const b=dailyBests[dailyDate];return b?`🥚 Blinky Daily · ${dailyDate} (UTC)\n${b.score.toLocaleString('en-US')} pts | Best combo ×${b.combo}\n30 moves · Daily best · v1`:'';}
async function copyResult(){const text=shareText();if(!text)return;try{await navigator.clipboard.writeText(text);$('shareStatus').textContent='Copied! Paste your result into Discord ♡';}catch{$('shareText').value=text;$('shareText').hidden=false;$('shareText').focus();$('shareText').select();$('shareStatus').textContent='Select and copy your result below.';}}
function updateDailyUI(){const isDaily=mode==='daily',b=dailyBests[dailyDate];$('modeHelp').textContent=isDaily?'30 moves. Aim for your best score, then share your daily result.':mode==='zen'?'Unlimited moves. Relax and keep your garden growing.':'45 moves per level. Reach the goal to explore the next garden.';$('dailyInfo').hidden=!isDaily;$('daily').setAttribute('aria-pressed',String(isDaily));$('dailyDate').textContent=dailyDate;$('dailyBest').textContent=b?b.score.toLocaleString('en-US')+' pts':'Finish a run to set your best';$('copyResult').disabled=!b||busy;$('dailyNotice').textContent=dailyDate===dayKey()?'Same start & egg sequence for everyone. Resets at 00:00 UTC.':'A new challenge is ready. Finish this run, then start today’s challenge.';}

const gardens=['The Starlight Garden','Rosepetal Meadow','Moonstone Grove','Crystal Lagoon','Sunbeam Orchard'];
const target=()=>8000+Math.min(level-1,10)*600;
const finished=()=>mode==='daily'?moves===0:mode==='adventure'&&(score>=target()||moves===0);
function snapshot(){return {board:[...board],score,moves,level,...(mode==='daily'?{date:dailyDate,rng:rngState,combo:bestCombo}:{})};}
function valid(s){return s&&Array.isArray(s.board)&&s.board.length===64&&s.board.every(t=>Number.isInteger(t)&&t>=0&&(t<=18||t>=24&&t<=29))&&Number.isSafeInteger(s.score)&&s.score>=0&&Number.isInteger(s.moves)&&s.moves>=0&&s.moves<=45&&Number.isSafeInteger(s.level)&&s.level>=1&&s.level<1000000&&matches(s.board).length===0;}
function save(){recordDaily();sessions[mode]=snapshot();try{localStorage.setItem(SAVE_KEY,JSON.stringify({mode,sessions,dailyBests}));saved=true;}catch{saved=false;}$('saveStatus').textContent=saved?'Progress saved on this device':'Progress available in this tab only';updateDailyUI();}
function restore(s){board=[...s.board];score=s.score;moves=s.moves;level=s.level;selected=-1;if(mode==='daily'){dailyDate=s.date;rngState=s.rng;bestCombo=s.combo;}}
function showResult(){if(mode==='daily'){recordDaily();$('resultTitle').textContent='Daily challenge complete! ✦';$('resultText').textContent=`${score.toLocaleString('en-US')} points · Best combo ×${bestCombo}. Your daily best: ${dailyBests[dailyDate].score.toLocaleString('en-US')} points.`;$('again').textContent=dailyDate===dayKey()?'Replay today →':'Play today’s challenge →';$('resultCopy').hidden=false;$('result').showModal();return;}$('resultCopy').hidden=true;const won=score>=target();$('resultTitle').textContent=won?`Level ${level} complete! ✦`:'A little more magic next time ♡';$('resultText').textContent=won?`${score.toLocaleString('en-US')} points! Your next garden is ready. Keep the adventure going.`:`You scored ${score.toLocaleString('en-US')} of ${target().toLocaleString('en-US')} points. Retry this level or switch to Endless Zen.`;$('again').textContent=won?'Next level →':'Try this level again ♡';$('result').showModal();}
function switchMode(next){if(busy||next===mode)return;save();mode=next;selected=-1;$('result').close();const prior=sessions[mode];if(mode==='daily'?validDaily(prior)&&prior.date===dayKey():valid(prior))restore(prior);else{reset();return;}if(!finished()&&!possible(board))board=fresh();render();save();$('status').textContent=mode==='zen'?'Unlimited moves. Make yourself at home ♡':'Select two adjacent eggs';if(finished())showResult();}
// Tile encoding keeps older numeric saves compatible: 0–5 normal,
// 6–11 row sweep, 12–17 column sweep, 18 rainbow, 24–29 bomb.
const color=t=>t==null||t===18?-1:t%6;
const special=t=>t===18?'rainbow':t>=24?'bomb':t>=12?'column':t>=6?'row':'';
function runs(b){const result=[];for(const axis of ['row','column'])for(let line=0;line<8;line++){let start=0;while(start<8){const index=k=>axis==='row'?line*8+k:k*8+line;const c=color(b[index(start)]);let end=start+1;while(c>=0&&end<8&&color(b[index(end)])===c)end++;if(c>=0&&end-start>=3)result.push({axis,c,cells:Array.from({length:end-start},(_,k)=>index(start+k))});start=end;}}return result;}
function matches(b){return [...new Set(runs(b).flatMap(r=>r.cells))];}
function matchPlan(b,preferred=[]){
 const groups=runs(b),creations=new Map(),visited=new Set();
 // Connected intersecting runs earn one reward: rainbow > bomb > stripe.
 for(let start=0;start<groups.length;start++){
  if(visited.has(start))continue;
  const component=[],queue=[start];visited.add(start);
  while(queue.length){const k=queue.pop(),run=groups[k];component.push(run);for(let j=0;j<groups.length;j++)if(!visited.has(j)&&groups[j].cells.some(i=>run.cells.includes(i))){visited.add(j);queue.push(j);}}
  const cells=[...new Set(component.flatMap(r=>r.cells))],longest=[...component].sort((a,b)=>b.cells.length-a.cells.length)[0];
  const crossing=component.some(r=>r.axis!==longest.axis);
  const reward=longest.cells.length>=5?18:crossing?24+longest.c:longest.cells.length===4?longest.c+(longest.axis==='row'?6:12):null;
  if(reward===null)continue;
  const eligible=(reward===18?longest.cells:cells).filter(i=>!special(b[i]));
  if(!eligible.length)continue;
  const intersection=eligible.find(i=>component.filter(r=>r.cells.includes(i)).length>1);
  const at=preferred.find(i=>eligible.includes(i))??intersection??eligible[Math.floor(eligible.length/2)];
  creations.set(at,reward);
 }
 return {cells:[...new Set(groups.flatMap(r=>r.cells))],creations};
}
function bombArea(i){const cells=[],row=Math.floor(i/8),col=i%8;for(let r=Math.max(0,row-1);r<=Math.min(7,row+1);r++)for(let c=Math.max(0,col-1);c<=Math.min(7,col+1);c++)cells.push(r*8+c);return cells;}
function swapPower(b,a,i){const x=b[a],y=b[i];if(x===18&&y===18)return Array.from({length:64},(_,k)=>k);if(x===18||y===18){const targetColor=color(x===18?y:x);return [...new Set([a,i,...b.flatMap((t,k)=>color(t)===targetColor?[k]:[])])];}if(special(x)&&special(y))return [a,i];return [];}
// Each original special is visited once, even when multiple blasts overlap.
function expandBlast(b,seeds,protectedCells=new Set(),directRainbows=new Set()){const hit=new Set(),queue=[...seeds],activated=[];while(queue.length){const i=queue.pop();if(hit.has(i)||protectedCells.has(i))continue;hit.add(i);const power=special(b[i]);if(!power)continue;activated.push({index:i,power});if(directRainbows.has(i))continue;if(power==='row')for(let c=0;c<8;c++)queue.push(Math.floor(i/8)*8+c);else if(power==='column')for(let r=0;r<8;r++)queue.push(r*8+i%8);else if(power==='bomb')queue.push(...bombArea(i));else{const counts=Array(6).fill(0);b.forEach(t=>{if(color(t)>=0)counts[color(t)]++});const c=counts.indexOf(Math.max(...counts));b.forEach((t,k)=>{if(color(t)===c)queue.push(k)});}}return {cells:[...hit],activated};}
function possible(b){for(let i=0;i<64;i++)for(const j of [i%8<7?i+1:-1,i<56?i+8:-1]){if(j<0)continue;[b[i],b[j]]=[b[j],b[i]];const ok=swapPower(b,i,j).length||matches(b).length;[b[i],b[j]]=[b[j],b[i]];if(ok)return[i,j];}return null;}
function fresh(){let b;do{b=[];for(let i=0;i<64;i++){let t;do{t=randomTile()}while(i%8>=2&&t===b[i-1]&&t===b[i-2]||i>=16&&t===b[i-8]&&t===b[i-16]);b.push(t)}}while(!possible(b));return b;}
function render(){
 const grid=$('board');
 if(!grid.children.length)grid.innerHTML=Array.from({length:64},(_,i)=>`<button class="cell" data-i="${i}"></button>`).join('');
 board.forEach((t,i)=>{
  const cell=grid.children[i];if(!cell?.dataset)return;
  const power=special(t),kind=types[color(t)<0?1:color(t)];
  cell.className='cell'+(i===selected?' selected':'');
  cell.setAttribute('aria-pressed',String(i===selected));
  cell.setAttribute('aria-label',`${power==='rainbow'?'Rainbow':kind.name+(power==='bomb'?' blast':power?' '+power+' sweep':'')} egg, row ${Math.floor(i/8)+1}, column ${i%8+1}`);
  if(cell.dataset.tile!==String(t)){
   cell.innerHTML=t==null?'':`<span class="piece ${power?'power-'+power:''}"><img class="egg" src="${kind.image}" alt="" draggable="false">${power?`<span class="power-badge" aria-hidden="true">${power==='rainbow'?'✦':power==='bomb'?'✹':power==='row'?'↔':'↕'}</span>`:''}</span>`;
   cell.dataset.tile=String(t);
  }
 });
 $('score').textContent=score.toLocaleString('en-US');$('moves').textContent=mode==='zen'?'∞':moves;$('goalLabel').textContent=mode==='daily'?'Challenge':'Goal';$('goal').textContent=mode==='daily'?'High score':mode==='zen'?'Just relax':target().toLocaleString('en-US');$('progress').style.width=(mode==='daily'?(30-moves)/30*100:mode==='zen'?100:Math.min(100,score/target()*100))+'%';$('level').textContent=mode==='daily'?'30 moves':mode==='zen'?'Endless Zen':`Level ${String(level).padStart(2,'0')}`;$('gardenTitle').textContent=mode==='daily'?'The Daily Garden':mode==='zen'?'Your Peaceful Garden':gardens[(level-1)%gardens.length];$('adventure').setAttribute('aria-pressed',String(mode==='adventure'));$('zen').setAttribute('aria-pressed',String(mode==='zen'));updateDailyUI();$('restart').textContent=mode==='daily'?(dailyDate===dayKey()?'↻ Replay today':'↻ Play today'):mode==='zen'?'↻ Fresh garden':'↻ Retry level';}
function note(freq=600){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.07,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.start();o.stop(audio.currentTime+.2)}catch{}}
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const piece=i=>$('board').children[i]?.querySelector?.('.piece');
const stepSize=()=>{const cells=$('board').children;return {x:cells[1]?.offsetLeft-cells[0]?.offsetLeft||52,y:cells[8]?.offsetTop-cells[0]?.offsetTop||52}};
function animate(el,frames,ms=300,delay=0){
 if(!el?.animate||reducedMotion())return Promise.resolve();
 const animation=el.animate(frames,{duration:ms,delay,easing:'cubic-bezier(.2,.7,.3,1)',fill:'both'});
 return animation.finished.catch(()=>{}).finally(()=>animation.cancel());
}
function toast(message){$('toast').textContent=message;$('toast').classList.remove('show');void $('toast').offsetWidth;$('toast').classList.add('show');}
function setBusy(value){busy=value;$('board').setAttribute('aria-busy',String(value));if(mode==='daily')updateDailyUI();}
async function swapAnimation(a,b){const step=stepSize(),x=(b%8-a%8)*step.x,y=(Math.floor(b/8)-Math.floor(a/8))*step.y;await Promise.all([animate(piece(a),[{transform:'translate(0,0)'},{transform:`translate(${x}px,${y}px)`}],180),animate(piece(b),[{transform:'translate(0,0)'},{transform:`translate(${-x}px,${-y}px)`}],180)]);}
// Every survivor carries its exact old row, even if neighboring eggs have the same color.
function collapse(b,random=randomTile){
 const next=Array(64),falls=[];
 for(let c=0;c<8;c++){
  const survivors=[];for(let r=7;r>=0;r--)if(b[r*8+c]!=null)survivors.push({tile:b[r*8+c],row:r});
  const missing=8-survivors.length;
  for(let r=7;r>=0;r--){const entry=survivors[7-r],from=entry?entry.row:r-missing;next[r*8+c]=entry?entry.tile:random();if(from!==r)falls.push({index:r*8+c,from,to:r,fresh:!entry});}
 }
 return {board:next,falls};
}
async function fallAnimation(falls){const step=stepSize();await Promise.all(falls.map(f=>animate(piece(f.index),[{transform:`translateY(${(f.from-f.to)*step.y}px)`},{transform:'translateY(0)'}],Math.min(480,230+(f.to-f.from)*32))));}
function point(i){const cell=$('board').children[i];return {x:(cell?.offsetLeft||0)+(cell?.offsetWidth||48)/2,y:(cell?.offsetTop||0)+(cell?.offsetHeight||48)/2};}
async function effect(className,x,y,frames,ms=400,styles={}){
 const layer=$('effects');if(!document.createElement||!layer?.appendChild||reducedMotion())return;
 const el=document.createElement('span');el.className='fx '+className;Object.assign(el.style,{left:x+'px',top:y+'px'},styles);layer.appendChild(el);try{await animate(el,frames,ms)}finally{el.remove()}
}
async function formation(creations,cells){
 await Promise.all([...creations].map(async([at,t])=>{
  const center=point(at),donors=cells.filter(i=>i!==at&&color(board[i])===color(t===18?board[at]:t));
  await Promise.all(donors.map(i=>{const start=point(i);return effect('spark-trail',start.x,start.y,[{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${center.x-start.x}px),calc(-50% + ${center.y-start.y}px)) scale(.35)`,opacity:.2}],220)}));
 }));
}
async function reveal(creations){await Promise.all([...creations.keys()].map(i=>animate(piece(i),[{transform:'scale(.75)',opacity:.55},{transform:'scale(1.28)',opacity:1,offset:.5},{transform:'scale(1)',opacity:1}],300)));}
async function powerEffects(activated){
 await Promise.all(activated.map(async({index,power})=>{
  const origin=point(index),step=stepSize(),grid=$('board');
  if(power==='row'||power==='column'){
   const horizontal=power==='row',size=horizontal?grid.clientWidth:grid.clientHeight,anchor=horizontal?origin.x:origin.y;
   await effect(horizontal?'beam-row':'beam-column',horizontal?0:origin.x,horizontal?origin.y:0,[{opacity:0,transform:horizontal?'scaleX(0)':'scaleY(0)'},{opacity:1,transform:horizontal?'scaleX(1)':'scaleY(1)',offset:.6},{opacity:0,transform:horizontal?'scaleX(1)':'scaleY(1)'}],360,{[horizontal?'width':'height']:size+'px',transformOrigin:horizontal?`${anchor}px center`:`center ${anchor}px`});
  }else if(power==='bomb'){
   await effect('blast-ring',origin.x,origin.y,[{transform:'translate(-50%,-50%) scale(.15)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:.85,offset:.65},{transform:'translate(-50%,-50%) scale(1.12)',opacity:0}],420,{width:step.x*3+'px',height:step.y*3+'px'});
  }else await effect('rainbow-ring',origin.x,origin.y,[{transform:'translate(-50%,-50%) scale(.2)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],440,{width:grid.clientWidth+'px',height:grid.clientHeight+'px'});
 }));
}
async function choose(i){
 if(busy||finished())return;
 if(selected<0){selected=i;render();note(420);return}
 if(selected===i){selected=-1;render();return}
 const a=selected;selected=-1;
 if(Math.abs(a%8-i%8)+Math.abs(Math.floor(a/8)-Math.floor(i/8))!==1){selected=i;render();return}
 setBusy(true);render();await swapAnimation(a,i);[board[a],board[i]]=[board[i],board[a]];render();
 let forced=swapPower(board,a,i),plan=matchPlan(board,[i,a]);
 if(!forced.length&&!plan.cells.length){await swapAnimation(a,i);[board[a],board[i]]=[board[i],board[a]];$('status').textContent='Try another pair. No move used ♡';render();setBusy(false);return}
 if(mode!=='zen')moves--;
 let combo=0,earned=false,triggered=false;
 while(forced.length||plan.cells.length){
  combo++;if(mode==='daily')bestCombo=Math.max(bestCombo,combo);
  // Direct special swaps clear their targets without manufacturing match rewards.
  const creations=forced.length?new Map():plan.creations;
  const protectedCells=new Set(creations.keys());
  const blast=expandBlast(board,forced.length?forced:plan.cells,protectedCells,forced.length?new Set([a,i].filter(j=>board[j]===18)):new Set());
  triggered ||= blast.activated.length>0;earned ||= creations.size>0;
  score+=blast.cells.length*60*combo;note(550+combo*130);
  const caption=blast.activated.some(p=>p.power==='bomb')?'Blast! ✹':blast.activated.length?'Magic unleashed! ✦':creations.size?'Special egg! ✦':combo>1?`Combo ×${combo} ✦`:`+${blast.cells.length*60} ✦`;
  toast(caption);
  await powerEffects(blast.activated);
  await Promise.all([
   formation(creations,plan.cells),
   ...blast.cells.map(j=>animate(piece(j),[{transform:'scale(1)',opacity:1},{transform:'scale(.2)',opacity:0}],200))
  ]);
  blast.cells.forEach(j=>board[j]=null);
  creations.forEach((t,j)=>board[j]=t);
  render();await reveal(creations);
  const gravity=collapse(board);board=gravity.board;render();await fallAnimation(gravity.falls);
  forced=[];plan=matchPlan(board);
 }
 $('speech').textContent=earned?'A special egg! Save it for a big moment ✦':triggered?'Wow! That was egg-stra magical! ♡':combo>1?'Amazing! Look at those sparkles ✦':'Keep going! Our garden is glowing ♡';
 $('status').textContent=earned?'Match arrows or bombs. Swap rainbows.':'Select two adjacent eggs';
 if(finished())showResult();else if(!possible(board)){board=fresh();render();$('status').textContent='Garden shuffled. New matches await!'}
 save();setBusy(false);
}
function reset(){if(busy)return;if(mode==='daily'){dailyDate=dayKey();rngState=seedFor(dailyDate);bestCombo=0;}board=fresh();score=0;moves=mode==='daily'?30:45;selected=-1;$('shareStatus').textContent='';$('shareText').hidden=true;$('result').close();$('speech').textContent='Let’s play together ♡';$('status').textContent='Select two adjacent eggs';render();save()}
$('board').addEventListener('click',e=>{const cell=e.target.closest('.cell');if(cell)choose(+cell.dataset.i).catch(()=>{selected=-1;board=fresh();setBusy(false);render();save();$('status').textContent='Garden refreshed. Your score is safe.'})});$('hint').onclick=()=>{if(busy||finished())return;selected=-1;render();const pair=possible(board);if(pair)pair.forEach(i=>$('board').children[i].classList.add('hint'));$('status').textContent='Swap the glowing eggs ✧'};$('restart').onclick=reset;$('again').onclick=()=>{if(busy)return;if(mode==='adventure'&&score>=target())level++;reset()};$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'♫ Sound on':'♫ Sound off';note()};
$('adventure').onclick=()=>switchMode('adventure');$('zen').onclick=()=>switchMode('zen');$('daily').onclick=()=>switchMode('daily');$('copyResult').onclick=copyResult;$('resultCopy').onclick=()=>{$('result').close();copyResult();};$('closeResult').onclick=()=> $('result').close();
try{const data=JSON.parse(localStorage.getItem(SAVE_KEY));if(data&&data.sessions){for(const key of ['adventure','zen'])if(valid(data.sessions[key]))sessions[key]=data.sessions[key];if(validDaily(data.sessions.daily)&&data.sessions.daily.date===dayKey())sessions.daily=data.sessions.daily;for(const [date,b] of Object.entries(data.dailyBests||{})){if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&b&&Number.isSafeInteger(b.score)&&b.score>=0&&Number.isSafeInteger(b.combo)&&b.combo>=0)dailyBests[date]=b;}if(data.mode==='zen'||data.mode==='daily')mode=data.mode;}}catch{}
if(mode==='daily'?validDaily(sessions.daily):valid(sessions[mode])){restore(sessions[mode]);if(!finished()&&!possible(board))board=fresh();render();save();$('status').textContent='Welcome back! Your garden is waiting ♡';if(finished())showResult();}else reset();

