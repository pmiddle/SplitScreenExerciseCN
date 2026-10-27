(function(){
'use strict';
const MODES=['bilibili-cn','youtube-en'],PREFERENCE='move-mix:experience:v1';
const params=new URL(location.href).searchParams;let remembered=null;try{remembered=localStorage.getItem(PREFERENCE);}catch{}
const requested=params.get('mode'),selected=MODES.includes(requested)?requested:MODES.includes(remembered)?remembered:null;
const mode=selected||'bilibili-cn';
function storageKey(key){return mode==='youtube-en'?key.replace(/^move-mix-cn:/,'move-mix-en:'):key;}
const expectedPlatform=mode==='youtube-en'?'YouTube':'Bilibili';
function validateSources(videos){if(videos.some(v=>v.platform!==expectedPlatform))throw Error(mode==='youtube-en'?'This experience uses YouTube. Paste a YouTube link, or switch to 中文 · Bilibili.':'当前为 Bilibili 版本，请粘贴B站链接或BV号；YouTube视频请切换至 English · YouTube。');return videos;}
window.MoveMixExperience={mode,storageKey,expectedPlatform,validateSources};
if(selected)try{localStorage.setItem(PREFERENCE,selected);}catch{}
// Copy compatible legacy data only when the destination does not exist. Never remove a legacy key.
if(mode==='youtube-en')try{
 const old=JSON.parse(localStorage.getItem('move-mix-v1')||'null');
 if(!localStorage.getItem(storageKey('move-mix-cn:setup:v1'))&&old){localStorage.setItem(storageKey('move-mix-cn:setup:v1'),JSON.stringify({workout:old.workoutUrl||'',entertainment:old.entertainmentUrl||'',muted:true}));}
 if(!localStorage.getItem(storageKey('move-mix-cn:favorites:v1'))){
  const cn=JSON.parse(localStorage.getItem('move-mix-cn:favorites:v1')||'[]');
  const items=Array.isArray(cn)?cn.filter(i=>i?.platform==='YouTube'):[];
  for(const f of Array.isArray(old?.favorites)?old.favorites:[]){if(!['workout','entertainment'].includes(f.category)||typeof f.name!=='string'||!/^[\w-]{11}$/.test(f.videoId||''))continue;const url='https://www.youtube.com/watch?v='+f.videoId;if(!items.some(i=>i.url===url&&i.role===f.category))items.push({id:'legacy-'+f.videoId+'-'+f.category,url,title:f.name,platform:'YouTube',role:f.category,group:'其它'});}
  localStorage.setItem(storageKey('move-mix-cn:favorites:v1'),JSON.stringify(items.slice(0,500)));
 }
}catch{}
const $=id=>document.getElementById(id),dialog=$('experienceDialog'),switcher=$('experienceSwitch');
let hasSelection=!!selected;
function open(){ $('experienceCancel').hidden=!hasSelection;dialog.showModal(); }
function choose(next){
 try{localStorage.setItem(PREFERENCE,next);}catch{}
 if(next===mode){hasSelection=true;const url=new URL(location.href);url.searchParams.set('mode',next);history.replaceState(null,'',url);dialog.close();openGuide();}
 else{const url=new URL(location.href);url.searchParams.set('mode',next);url.searchParams.set('guide','1');url.hash='';location.assign(url.href);}
}
for(const button of dialog.querySelectorAll('[data-mode]'))button.onclick=()=>choose(button.dataset.mode);
const home=new URL(location.href);home.searchParams.set('mode',mode);home.hash='';document.querySelector('header a.logo').href=home.href;
switcher.onclick=open;$('experienceCancel').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(!hasSelection)e.preventDefault();});
if(mode==='youtube-en'){
 document.documentElement.lang='en';document.title='MOVE/MIX — Move your body. Make it your mix.';
 document.querySelector('meta[name=description]').content='Pair your workout with what you love on YouTube. Queues, favorites, timers and activity history in one MOVE/MIX.';
 for(const el of document.querySelectorAll('[data-cn-only]'))el.hidden=true;
 window.MoveMixI18n.localizeDOM(document.body);
 document.querySelector('.edition').textContent='English · YouTube';
 // Bilibili-specific recovery instructions are not part of the YouTube experience.
 $('platformHelp').hidden=true;
 $('guideSection').querySelector('h3:nth-of-type(2)').textContent='Two independent queues';
 const queueGuide=$('guideSection').querySelector('h3:nth-of-type(2) + p');queueGuide.textContent='Each player has its own queue. A finished YouTube video advances to the next item. Playlists stay inside the official YouTube player until they finish. Use the queue dropdown or Previous / Next to switch just that player.';
}else{
 for(const el of document.querySelectorAll('#workoutDetected,#entertainmentDetected'))el.textContent='Bilibili · 粘贴链接或BV号';
}
// Platform follows the experience; users choose purpose and body area, not arbitrary platform pairs.
$('favoritePlatformFilter').value=expectedPlatform;$('favoritePlatformFilter').closest('label').hidden=true;
switcher.textContent=mode==='youtube-en'?'中文 / English':'中文 / English';
// The inline guide is the single content source for both the page and the modal.
const guideDialog=$('guideDialog');
function openGuide(){
 const content=$('guideSection').querySelector('.guide-content');
 $('guideDialogContent').replaceChildren(content.cloneNode(true));
 if(!guideDialog.open)guideDialog.showModal();
}
$('closeGuide').onclick=()=>guideDialog.close();
for(const link of document.querySelectorAll('.section-index a[href="#guideSection"]'))link.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openGuide();});
const showGuide=params.get('guide')==='1';
if(showGuide){const clean=new URL(location.href);clean.searchParams.delete('guide');history.replaceState(null,'',clean);}
if(!selected)open();else if(showGuide)openGuide();
})();
