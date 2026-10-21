(function(){
'use strict';
const L=window.MoveMixLibrary,C=window.MoveMixCN,$=id=>document.getElementById(id),roles={workout:'锻炼',entertainment:'娱乐'};
const store=new L.Favorites({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},C.parseVideo);
function feedback(text){$('favoriteFeedback').textContent=text;}
function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
function element(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function notify(text){$('sessionStatus').textContent=text;feedback(text);}
function useVideo(url,role){const field=$(role+'Url');field.value=url;field.dispatchEvent(new Event('input',{bubbles:true}));field.focus({preventScroll:true});field.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});feedback(`已选作${roles[role]}，填写另一个视频后点击开始。`);}
function saveFavorite(url,title,role,group){try{store.add({url,title,role,group});renderFavorites();notify(store.failed?'已加入本次会话收藏；浏览器存储不可用，关闭后可能丢失。':'已加入'+roles[role]+'收藏。');}catch(e){feedback(e.message);}}
async function copy(url,input){try{await navigator.clipboard.writeText(url);notify('链接已复制。');}catch{input.hidden=false;input.focus();input.select();notify('无法自动复制，请复制已选中的链接。');}}
function linkField(url){const input=document.createElement('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label','完整视频链接');return input;}
for(const group of ['全身','上肢','臀腿','腰腹','拉伸','其它']){
 if(!L.workouts.some(w=>w.group===group))continue;
 const section=element('section',null,'recommendation-group');section.append(element('h3',group));const list=element('ul',null,'recommendation-rows');
 for(const item of L.workouts.filter(w=>w.group===group)){
  const row=element('li',null,'recommendation-row'),info=element('div',null,'recommendation-info');info.append(element('h4',item.title));if(item.plan)info.append(element('span',Array.isArray(item.plan)?'5段动作计时':'30秒动作 / 10秒休息','plan-badge'));
  const input=linkField(item.url);input.hidden=true;const actions=element('div',null,'actions');actions.append(button('选作锻炼',()=>useVideo(item.url,'workout')),button('复制链接',()=>copy(item.url,input)),button('收藏',()=>saveFavorite(item.url,item.title,'workout',item.group)));row.append(info,actions,input);list.append(row);
 }
 section.append(list);$('workoutRecommendations').append(section);
}

function renderFavorites(){
 const list=$('favoriteList'),platform=$('favoritePlatformFilter').value,role=$('favoriteRoleFilter').value,category=$('favoriteGroupFilter').value;list.replaceChildren();
 const filtered=store.items.filter(x=>(platform==='all'||x.platform===platform)&&(role==='all'||x.role===role)&&(category==='all'||(x.role==='workout'&&L.groupFor(x)===category)));
 $('favoriteCount').textContent=store.items.length+' 条';
 for(const group of [...L.workoutGroups,'娱乐']){
  const items=filtered.filter(x=>x.role==='entertainment'?group==='娱乐':L.groupFor(x)===group);if(!items.length)continue;
  const section=element('section',null,'recommendation-group');section.append(element('h3',group));const rows=element('ul',null,'recommendation-rows');
  for(const item of items){const row=element('li',null,'recommendation-row'),info=element('div',null,'recommendation-info');info.append(element('h4',item.title),element('span',item.platform+' · '+roles[item.role],'eyebrow'));const input=linkField(item.url);input.hidden=true;const actions=element('div',null,'actions');
   if(item.role==='workout'){const select=document.createElement('select');select.setAttribute('aria-label',item.title+'的锻炼种类');for(const value of L.workoutGroups){const option=element('option',value);option.value=value;select.append(option);}select.value=L.groupFor(item);select.onchange=()=>{item.group=select.value;store.save();renderFavorites();feedback(store.failed?'分类仅保留在本次会话，浏览器未能保存。':'已更新锻炼种类。');};actions.append(select);}
   actions.append(button('选作'+roles[item.role],()=>useVideo(item.url,item.role)),button('复制链接',()=>copy(item.url,input)),button('移除',()=>{store.remove(item.id);renderFavorites();feedback(store.failed?'已从本次会话移除，但浏览器未能保存修改。':'已移除收藏。');}));row.append(info,actions,input);rows.append(row);
  }section.append(rows);list.append(section);
 }
 if(!filtered.length)list.append(element('p','这里还没有符合条件的收藏。可添加自己的视频，或收藏推荐运动。','collection-note'));
}

$('favoriteForm').onsubmit=e=>{e.preventDefault();try{const parsed=C.parseImport($('favoriteUrl').value);if(parsed.length!==1)throw Error('每次收藏一个视频；播放队列仍支持批量导入。');const video=parsed[0],known=L.workouts.find(x=>x.id===video.id&&Number(x.p||1)===Number(video.p||1));saveFavorite(L.canonical(video),$('favoriteTitle').value||known?.title||video.id||(video.shortUrl?'B站短链（待解析）':'YouTube 播放列表'),$('favoriteRole').value,$('favoriteGroup').value);}catch(error){feedback(error.message);}};
$('favoriteRole').onchange=()=>{$('favoriteGroupLabel').hidden=$('favoriteRole').value!=='workout';};$('favoriteGroupFilter').onchange=renderFavorites;
$('favoritePlatformFilter').onchange=renderFavorites;$('favoriteRoleFilter').onchange=renderFavorites;renderFavorites();if(store.failed)feedback('浏览器无法读取收藏存储；仍可添加本次会话收藏。');
const current={};let active=null,duck=null,release=null,phaseKey=null,tickHandle=null,aligned=false;const clock=new L.Timeline();
function releaseAudio(){if(release){release();release=null;}}
function pauseCues(message='动作计时已暂停；视频暂停或拖动后请重新对齐。'){clock.pause();clearTimeout(tickHandle);releaseAudio();$('cueOverlay').hidden=true;if(active){$('cueReadout').textContent=message==='等待手动对齐'?message:'动作计时已暂停';$('cuePosition').textContent=message==='等待手动对齐'?'':message;}}
function resetCues(){aligned=false;pauseCues('等待手动对齐');clock.position=0;phaseKey=null;$('cueVideoTime').value='00:00';$('cuePosition').textContent='';}
function updateCuePanel(video){active=L.workouts.find(x=>x.id===video.id&&Number(x.p||1)===Number(video.p||1)&&x.plan)||null;resetCues();$('cuePanel').hidden=!active;if(!active)return;$('cueTitle').textContent='动作计时 · '+active.title;$('cuePlan').textContent=Array.isArray(active.plan)?active.plan.map(([s,e])=>`${L.formatTime(s)}–${L.formatTime(e)}（${e-s}秒）`).join('；'): `${L.formatTime(active.plan.start)}–${L.formatTime(active.plan.end)} · 30秒动作 + 10秒休息，最后一段按结束时间截断。`;$('cueReadout').textContent='等待手动对齐';}
function tick(){clearTimeout(tickHandle);if(!clock.running||!active)return;const time=clock.time(),phase=L.phaseAt(active.plan,time),key=phase.start+':'+phase.end+':'+phase.kind;if(key!==phaseKey){releaseAudio();phaseKey=key;}const labels={work:'动作',rest:'休息',wait:'距离下一个动作',done:'本组计时已完成'};const label=labels[phase.kind];$('cueReadout').textContent=label+(phase.kind==='done'?'':' '+phase.remaining+'秒');$('cuePosition').textContent='手动对齐估计的视频时间 '+L.formatTime(time)+' · 视频缓冲、暂停或拖动不会自动同步';$('cueOverlayPhase').textContent=label;$('cueOverlaySeconds').textContent=phase.kind==='done'?'完成':phase.remaining;$('cueOverlay').hidden=false;$('cueOverlay').classList.toggle('urgent',phase.kind==='work'&&phase.remaining<=2);if(phase.kind==='work'&&phase.end-time<=1.5&&!release&&duck)release=duck();if(phase.kind==='done'){clock.pause();releaseAudio();return;}tickHandle=setTimeout(tick,100);}
$('cueAlignForm').onsubmit=e=>{e.preventDefault();try{const position=L.parseTime($('cueVideoTime').value);if(position>86400)throw Error('视频时间过大，请检查。');document.dispatchEvent(new CustomEvent('cn:cue-start'));releaseAudio();phaseKey=null;aligned=true;clock.align(position);$('cueError').textContent='';tick();}catch(error){$('cueError').textContent=error.message;}};
$('cuePause').onclick=()=>pauseCues();$('cueResume').onclick=()=>{if(!active)return;if(!aligned){$('cueError').textContent='请先填写当前视频时间，点击对齐并开始计时。';return;}document.dispatchEvent(new CustomEvent('cn:cue-start'));clock.resume();tick();};$('cueReset').onclick=resetCues;
for(const role of ['workout','entertainment'])$(role==='workout'?'saveCurrentWorkout':'saveCurrentEntertainment').onclick=()=>{const v=current[role];if(!v)return;const known=L.workouts.find(x=>x.id===v.id&&Number(x.p||1)===Number(v.p||1));saveFavorite(L.canonical(v),known?.title||v.id||'YouTube 播放列表',role);};
document.addEventListener('cn:before-player-change',e=>{pauseCues();if(e.detail.role==='workout'){$('cuePanel').hidden=true;active=null;}});
document.addEventListener('cn:player-mounted',e=>{const {role,video,beginDuck}=e.detail;current[role]=video;duck=beginDuck;if(role==='workout')updateCuePanel(video);});
for(const event of ['cn:quick-start','cn:pause-all','cn:session-end'])document.addEventListener(event,()=>pauseCues());
document.addEventListener('visibilitychange',()=>{if(clock.running)tick();});window.addEventListener('pagehide',()=>pauseCues());
})();
