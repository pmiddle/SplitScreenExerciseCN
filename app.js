/* Independent MOVE/MIX CN: no production files or player instances are shared. */
(function(root,factory){
 'use strict';
 const core=factory();
 if(typeof module==='object'&&module.exports) module.exports=core;
 else {root.MoveMixCN=core;core.init();}
})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const ROLES={workout:'锻炼',entertainment:'娱乐'};
 const unsupported=Object.freeze({canPlayProgrammatically:false,canPauseProgrammatically:false,canMuteProgrammatically:false,canSetVolume:false,canGetCurrentTime:false,canDetectEnded:false,canSeek:false});
 function parseVideo(text){
  const textValue=text.trim();const av=textValue.match(/^av([1-9]\d*)$/i);if(av)return {platform:'Bilibili',id:'av'+av[1],aid:av[1],p:null};const bv=textValue.match(/^BV[0-9A-Za-z]{10}$/i);if(bv)return {platform:'Bilibili',id:'BV'+textValue.slice(2),p:null};
  const matched=textValue.match(/https?:\/\/[^\s<>"'【】《》]+/i);const raw=(matched?matched[0]:textValue).replace(/[，。；！？、）)\]》】]+$/u,'');const u=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('invalid URL');
  const host=u.hostname.toLowerCase();let id;
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(host)){
   id=host.endsWith('youtu.be')?u.pathname.split('/')[1]:u.pathname==='/watch'?u.searchParams.get('v'):/^\/(embed|shorts|live)\//.test(u.pathname)?u.pathname.split('/')[2]:null;
   const list=u.searchParams.get('list');const playlistId=list&&/^[A-Za-z0-9_-]{10,100}$/.test(list)?list:null;
   if(!/^[\w-]{11}$/.test(id||'')){if(u.pathname==='/playlist'&&playlistId)return {platform:'YouTube',id:null,playlistId};throw Error('invalid video ID');}
   return playlistId?{platform:'YouTube',id,playlistId}:{platform:'YouTube',id};
  }
  if(['bilibili.com','www.bilibili.com','m.bilibili.com'].includes(host)){
   const av=u.pathname.match(/^\/video\/av([1-9]\d*)(?:\/|$)/i);if(av){const p=u.searchParams.get('p');return {platform:'Bilibili',id:'av'+av[1],aid:av[1],p:p&&/^[1-9]\d*$/.test(p)?p:null};}
   id=u.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10})(?:\/|$)/)?.[1];if(!id)throw Error('invalid BV ID');
   const p=u.searchParams.get('p');return {platform:'Bilibili',id,p:p&&/^[1-9]\d*$/.test(p)?p:null};
  }
  throw Error('unsupported host');
 }
 function parseImport(text){
  const tokens=[];
  for(const line of text.split(/\r?\n/)){
   const urls=line.match(/https?:\/\/[^\s<>"'【】《》]+/gi);
   if(urls){tokens.push(...urls);continue;}
   const ids=line.match(/\b(?:BV[0-9A-Za-z]{10}|av[1-9]\d*)\b/gi);
   if(ids){tokens.push(...ids);continue;}
   if(/^(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be|bilibili\.com|b23\.tv)\//i.test(line.trim()))tokens.push(line.trim());
  }
  if(!tokens.length)throw Error('未识别到视频，请粘贴分享文字、完整链接或BV号。');
  if(tokens.length>100)throw Error('每个队列最多导入100项，请分批使用。');
  return tokens.map((token,index)=>{try{const video=parseVideo(token);const line=text.split(/\r?\n/).find(line=>line.includes(token));const prefix=line?.split(token)[0].trim().replace(/^[【\[]|[】\]]$/g,'').trim();if(prefix)video.title=prefix.slice(0,160);return video;}catch{
   if(/(?:https?:\/\/)?(?:www\.)?b23\.tv\//i.test(token))throw Error(`第${index+1}项是B站短链，请打开后复制完整视频网址，或填写BV号。`);
   throw Error(`第${index+1}项无法识别，请填写视频链接或BV号。`);
  }});
 }
 function bilibiliURL(video,muted){const u=new URL('https://player.bilibili.com/player.html');if(video.aid)u.searchParams.set('aid',video.aid);else u.searchParams.set('bvid',video.id);u.searchParams.set('autoplay','0');u.searchParams.set('muted',muted?'1':'0');u.searchParams.set('danmaku','0');if(video.p)u.searchParams.set('p',video.p);return u.href;}
 let ytPromise;
 function loadYouTubeAPI(){
  if(window.YT?.Player)return Promise.resolve();
  if(!ytPromise){
   ytPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');let settled=false;
    const complete=error=>{if(settled)return;settled=true;clearTimeout(timeout);if(error){script.remove();reject(error);}else resolve();};
    const timeout=setTimeout(()=>complete(Error('YouTube 连接超时，请检查网络后重新加载。')),20000);
    window.onYouTubeIframeAPIReady=()=>complete();script.src='https://www.youtube.com/iframe_api';script.onerror=()=>complete(Error('暂时无法连接 YouTube，请检查网络后重新加载。'));document.head.append(script);
   }).catch(error=>{ytPromise=null;throw error;});
  }return ytPromise;
 }
 class PlayerAdapter{
  constructor(mount,video,options={}){this.mount=mount;this.video=video;this.options=options;this.capabilities=unsupported;this.ready=false;this.destroyed=false;}
  play(){return false;} pause(){return false;} setMuted(){return false;} setVolume(){return false;} getCurrentTime(){return null;} getAudioState(){return null;} getPlayerState(){return null;} seek(){return false;}
  status(text){if(!this.destroyed)this.options.onStatus?.(text);}
  error(text){if(!this.destroyed)this.options.onError?.(text);}
  destroy(){this.destroyed=true;this.ready=false;this.mount.replaceChildren();}
 }
 class YouTubePlayerAdapter extends PlayerAdapter{
  constructor(mount,video,options){super(mount,video,options);this.capabilities=Object.freeze(Object.fromEntries(Object.keys(unsupported).map(k=>[k,true])));this.initialMuted=!!options.muted;this.volume=options.volume??80;}
  async load(){
   this.status('连接中');
   try{
    await loadYouTubeAPI();if(this.destroyed)return;
    const target=document.createElement('div');this.mount.replaceChildren(target);
    this.player=new YT.Player(target,{width:'100%',height:'100%',...(this.video.id?{videoId:this.video.id}:{}),playerVars:{origin:location.origin,playsinline:1,autoplay:0,controls:1},events:{
     onReady:event=>{if(this.destroyed)return;this.player=event.target;this.ready=true;this.player.setVolume(this.volume);this.setMuted(this.initialMuted);this.status('已就绪');clearTimeout(this.readyTimeout);if(this.video.playlistId){const list={listType:'playlist',list:this.video.playlistId,index:0};if(this.options.autoPlay)this.player.loadPlaylist(list);else this.player.cuePlaylist(list);}else if(this.options.autoPlay)this.player.playVideo();this.options.onReady?.();},
     onStateChange:event=>{if(this.destroyed)return;const state=({'-1':'待播放',0:'已结束',1:'播放中',2:'已暂停',3:'缓冲中',5:'待播放'})[event.data]||'状态更新';this.status(state);if(event.data===0&&!this.video.playlistId)this.options.onEnded?.();},
     onError:event=>{if(this.destroyed)return;clearTimeout(this.readyTimeout);this.ready=false;const errors={2:'视频链接无效，请更换链接。',5:'视频暂时无法播放，请重试。',100:'视频已删除或无法公开观看。',101:'这个视频不允许在站外播放，请更换视频。',150:'这个视频不允许在站外播放，请更换视频。',153:'播放器验证失败，请通过正常的 HTTP/HTTPS 网站打开，并检查浏览器的隐私或拦截设置。'};this.error(errors[event.data]||'YouTube 视频加载失败，请重试或更换视频。');},
     onAutoplayBlocked:()=>this.options.onNotice?.('浏览器阻止了自动播放，请在播放器中点击播放。')
    }});
    this.readyTimeout=setTimeout(()=>{if(!this.destroyed&&!this.ready)this.options.onNotice?.(`${ROLES[this.options.role]}视频仍未就绪，请检查网络或重新加载。`);},20000);
   }catch(e){this.error(e.message);}
  }
  play(){if(!this.ready)return false;this.player.playVideo();return true;}
  pause(){if(!this.ready)return false;this.player.pauseVideo();return true;}
  setMuted(muted){this.initialMuted=!!muted;if(!this.ready)return false;if(muted)this.player.mute();else this.player.unMute();return true;}
  setVolume(value){this.volume=value;if(!this.ready)return false;this.player.setVolume(value);return true;}
  getAudioState(){return this.ready?{muted:this.player.isMuted(),volume:this.player.getVolume()}:null;}
  getCurrentTime(){return this.ready?this.player.getCurrentTime():null;}
  getPlayerState(){return this.ready?this.player.getPlayerState():null;}
  seek(seconds){if(!this.ready)return false;this.player.seekTo(seconds,true);return true;}
  destroy(){clearTimeout(this.readyTimeout);this.destroyed=true;this.ready=false;try{this.player?.destroy();}finally{this.mount.replaceChildren();}}
 }
 class BilibiliPlayerAdapter extends PlayerAdapter{
  load(){
   this.status('请手动播放');const iframe=document.createElement('iframe');
   iframe.title=`${ROLES[this.options.role]} · Bilibili`;iframe.src=bilibiliURL(this.video,!!this.options.muted);iframe.allow='autoplay; fullscreen; picture-in-picture';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';
   iframe.addEventListener('load',()=>{if(this.destroyed)return;this.status('请使用底部控件');/* Document load is not playback readiness. */});
   iframe.addEventListener('error',()=>this.error('B站播放器加载遇到问题，请重新加载或更换视频。'));
   this.mount.replaceChildren(iframe);this.iframe=iframe;
  }
 }
 function createAdapter(mount,video,options){return video.platform==='YouTube'?new YouTubePlayerAdapter(mount,video,options):new BilibiliPlayerAdapter(mount,video,options);}
 // This clock never reads media time. A delayed callback finishes immediately.
 class QuickTimer{
  constructor({now=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),clear=id=>clearTimeout(id),beginDuck=()=>null,render=()=>{}}={}){Object.assign(this,{now,schedule,clear,beginDuck,render});this.end=null;this.handle=null;this.release=null;this.duckAttempted=false;}
  start(seconds){if(!Number.isInteger(seconds)||seconds<1||seconds>3600)return false;this.cancel(false);this.end=this.now()+seconds*1000;this.duckAttempted=false;this.tick();return true;}
  tick(){
   this.clear(this.handle);this.handle=null;if(this.end===null)return;const ms=this.end-this.now();
   if(ms<=0){this.cancel(false);this.render({running:false,finished:true,seconds:0,urgent:false});return;}
   if(ms<=1500&&!this.duckAttempted){this.duckAttempted=true;this.release=this.beginDuck();}
   this.render({running:true,finished:false,seconds:Math.ceil(ms/1000),urgent:ms<=2000});
   this.handle=this.schedule(()=>this.tick(),Math.max(10,Math.min(200,ms>1500?ms-1500:ms)));
  }
  cancel(render=true){this.clear(this.handle);this.handle=null;this.end=null;const release=this.release;this.release=null;if(release)release();if(render)this.render({running:false,finished:false,seconds:0,urgent:false});}
 }
 function beginAudioDuck(adapter,onActive=()=>{}){
  if(!adapter?.capabilities.canMuteProgrammatically||!adapter.ready)return null;
  const previous=adapter.getAudioState();if(!previous)return null;adapter.setMuted(true);onActive(true);
  return ()=>{try{if(!adapter.destroyed){adapter.setVolume(previous.volume);adapter.setMuted(previous.muted);}}finally{onActive(false);}};
 }
 function init(){
  const $=id=>document.getElementById(id);const adapters={};let queues={},indices={workout:0,entertainment:0},videos={},mainRole='entertainment',toastTimeout,finishTimeout;const KEY='move-mix-cn:setup:v1';
  function notice(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').hidden=true,6000);$('sessionStatus').textContent=text;}
  function detect(role){let queue=null;const value=$(role+'Url').value;try{queue=parseImport(value);}catch{}$(role+'Detected').textContent=queue?'已识别 '+queue.length+' 项 · '+[...new Set(queue.map(v=>v.platform))].join(' / '):value.trim()?'待识别：支持分享文字、完整链接或BV号':'可粘贴多条分享文字、链接或BV号，每行一条';return queue;}

  function save(){try{localStorage.setItem(KEY,JSON.stringify({workout:$('workoutUrl').value,entertainment:$('entertainmentUrl').value,muted:$('setupMute').checked}));}catch{}}
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){$('workoutUrl').value=typeof saved.workout==='string'?saved.workout:'';$('entertainmentUrl').value=typeof saved.entertainment==='string'?saved.entertainment:'';$('setupMute').checked=saved.muted!==false;}}catch{}
  for(const role of Object.keys(ROLES)){detect(role);$(role+'Url').addEventListener('input',()=>{detect(role);$(role+'Error').textContent='';$(role+'Url').removeAttribute('aria-invalid');save();});}
  $('setupMute').onchange=save;
  function failure(role,text){$(role+'State').textContent='加载遇到问题';$(role+'Failure').querySelector('p').textContent=text;$(role+'Failure').hidden=false;}
  function mount(role,autoPlay=false){
   document.dispatchEvent(new CustomEvent('cn:before-player-change',{detail:{role}}));
   adapters[role]?.destroy();$(role+'Failure').hidden=true;
   const video=videos[role];$(role+'Label').textContent=`${role==='workout'?'↗':'♫'} ${ROLES[role]} · ${video.platform}`;
   const muted=role==='workout'?$('sessionMute').checked:false;
   adapters[role]=createAdapter($(role+'Mount'),video,{role,muted,autoPlay,volume:role==='entertainment'?Number($('entertainmentVolume').value):65,onStatus:text=>$(role+'State').textContent=text,onError:text=>failure(role,text),onNotice:notice,onEnded:()=>{if(indices[role]+1<queues[role].length)changeItem(role,indices[role]+1,true);else notice(`${ROLES[role]}队列已播放完毕。`);},onReady:()=>{if(role==='entertainment')$('entertainmentVolume').disabled=false;}});
   adapters[role].load();updateQueueUI();document.dispatchEvent(new CustomEvent('cn:player-mounted',{detail:{role,video,beginDuck:()=>beginAudioDuck(adapters.entertainment,active=>{$('entertainmentVolume').disabled=active||!adapters.entertainment?.ready;})}}));if(role==='workout'){$('applyMute').hidden=true;updateMuteHelp();}
  }
  function updateQueueUI(){
   for(const role of Object.keys(ROLES)){
    const queue=queues[role]||[],select=$(role+'Queue');select.replaceChildren();
    queue.forEach((video,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`${index+1}. ${video.platform} · ${video.playlistId?'播放列表 '+video.playlistId:video.id}${video.p?' · 分P '+video.p:''}`;select.append(option);});
    select.value=String(indices[role]);$(role+'Previous').disabled=indices[role]<=0;$(role+'Next').disabled=indices[role]>=queue.length-1;
    $(role+'QueueNote').textContent=videos[role]?.platform==='Bilibili'?'B站需手动播放和切换；不会自动展开合集。':videos[role]?.playlistId?'合集内由YouTube自动联播；合集结束后手动切换下一项。':'当前视频结束后自动切换下一项；遇B站需手动播放。';
   }
   $('combo').textContent=`${videos.workout.platform} × ${videos.entertainment.platform}`;
   $('entertainmentVolumeRow').hidden=videos.entertainment.platform!=='YouTube';
   $('platformHelp').hidden=!Object.values(videos).some(v=>v.platform==='Bilibili');
   $('bilibiliVolumeHint').textContent=videos.entertainment.platform==='Bilibili'?'娱乐音量请在B站播放器中调整。计时仅用视觉提醒，不重载视频。':'';
  }
  function changeItem(role,index,autoPlay=false){
   if(index<0||index>=queues[role].length)return;
   if(role==='entertainment')timer.cancel();
   indices[role]=index;videos[role]=queues[role][index];
   if(role==='entertainment')$('entertainmentVolume').disabled=true;
   mount(role,autoPlay);notice(`已切换${ROLES[role]}第${index+1}项。${videos[role].platform==='Bilibili'?'请在B站播放器中点击播放。':''}`);
  }
  function updateMuteHelp(){const bili=videos.workout?.platform==='Bilibili';$('muteHelp').textContent=bili?'B站静音设置在加载时生效。修改后需点击重新载入，视频进度会重置。':'YouTube 可直接切换锻炼静音。';}
  function layout(){const small=mainRole==='entertainment'?'workout':'entertainment';$('stage').dataset.main=mainRole;for(const role of Object.keys(ROLES))$(role+'Shell').classList.toggle('small',role===small);}
  const timer=new QuickTimer({beginDuck:()=>beginAudioDuck(adapters.entertainment,active=>{$('entertainmentVolume').disabled=active||!adapters.entertainment?.ready;}),render:state=>{
   $('timerChoices').hidden=state.running;$('timerRunning').hidden=!state.running;$('remaining').textContent=state.seconds;$('overlayRemaining').textContent=state.seconds;$('timerOverlay').hidden=!state.running&&!state.finished;$('timerOverlay').classList.toggle('urgent',state.urgent);$('timerOverlay').classList.toggle('finished',state.finished);
   if(state.finished){$('timerResult').textContent='计时结束';$('overlayRemaining').textContent='完成';clearTimeout(finishTimeout);finishTimeout=setTimeout(()=>$('timerOverlay').hidden=true,2400);$('timerChoices').querySelector('button').focus({preventScroll:true});}
  }});
  document.addEventListener('cn:cue-start',()=>timer.cancel());
  function startTimer(seconds){document.dispatchEvent(new CustomEvent('cn:quick-start'));if(!Number.isInteger(seconds)||seconds<1||seconds>3600){$('customError').textContent='请输入 1 到 3600 之间的整数秒数。';return;}clearTimeout(finishTimeout);$('timerResult').textContent='';$('customError').textContent='';$('customForm').hidden=true;$('customToggle').setAttribute('aria-expanded','false');timer.start(seconds);$('cancelTimer').focus({preventScroll:true});}
  $('setupForm').onsubmit=event=>{
   event.preventDefault();const next={};let firstInvalid;
   for(const role of Object.keys(ROLES)){try{next[role]=parseImport($(role+'Url').value);$(role+'Error').textContent='';}catch(error){next[role]=null;$(role+'Error').textContent=error.message;}detect(role);$(role+'Url').setAttribute('aria-invalid',String(!next[role]));if(!next[role]&&!firstInvalid)firstInvalid=$(role+'Url');}
   if(firstInvalid){firstInvalid.focus();return;}timer.cancel();save();queues=next;indices={workout:0,entertainment:0};videos={workout:queues.workout[0],entertainment:queues.entertainment[0]};mainRole='entertainment';layout();$('setupView').hidden=true;$('sessionView').hidden=false;$('sessionMute').checked=$('setupMute').checked;$('combo').textContent=`${videos.workout.platform} × ${videos.entertainment.platform}`;
   $('entertainmentVolumeRow').hidden=videos.entertainment.platform!=='YouTube';$('entertainmentVolume').disabled=true;
   $('platformHelp').hidden=!Object.values(videos).some(v=>v.platform==='Bilibili');$('bilibiliVolumeHint').textContent=videos.entertainment.platform==='Bilibili'?'娱乐音量请在B站播放器中调整。快速计时以视觉方式提醒，不会中断或重载视频。':'';
   document.dispatchEvent(new CustomEvent('cn:session-start',{detail:{workouts:queues.workout}}));mount('entertainment');mount('workout');$('sessionStatus').textContent='准备好后点击“同时播放”；B站视频请在播放器内开始。';$('playBoth').focus({preventScroll:true});window.scrollTo(0,0);
  };
  function transport(action){if(action==='pause')document.dispatchEvent(new CustomEvent('cn:pause-all'));const bili=[],waiting=[];for(const [role,adapter] of Object.entries(adapters)){
   const cap=action==='play'?'canPlayProgrammatically':'canPauseProgrammatically';
   if(!adapter.capabilities[cap])bili.push(role);else try{if(!adapter[action]())waiting.push(ROLES[role]);}catch{waiting.push(ROLES[role]);}
  }
  const text=action==='play'?'请点击 B站播放器开始播放':'B站播放器需要在播放器控件中手动暂停';const readyText=action==='play'?'已发送播放请求；若浏览器阻止，请在播放器内点击播放。':'已向 YouTube 播放器发送暂停请求。';notice([bili.length?text:readyText,waiting.length?`${waiting.join('、')}视频尚未就绪，请稍后重试。`:''].filter(Boolean).join(' '));}
  $('playBoth').onclick=()=>transport('play');$('pauseBoth').onclick=()=>transport('pause');
  $('swap').onclick=()=>{mainRole=mainRole==='entertainment'?'workout':'entertainment';layout();notice(`${ROLES[mainRole]}已切换为大屏。`);};
  $('position').onchange=()=>$('stage').dataset.position=$('position').value;
  function sizePip(){const stage=$('stage');if(!stage.style.getPropertyValue('--pip-width'))return;const width=Math.max(200,Math.min(Number($('pipSize').value),stage.clientWidth-24));stage.style.setProperty('--pip-height',Math.max(238,width*.5625+36)+'px');$('pipSizeValue').textContent=Math.round(width)+'px';}
  $('pipSize').oninput=()=>{$('stage').style.setProperty('--pip-width',$('pipSize').value+'px');sizePip();};
  if(window.ResizeObserver)new ResizeObserver(sizePip).observe($('stage'));else window.addEventListener('resize',sizePip);
  for(const role of Object.keys(ROLES)){
   $(role+'Previous').onclick=()=>changeItem(role,indices[role]-1,true);
   $(role+'Next').onclick=()=>changeItem(role,indices[role]+1,true);
   $(role+'Queue').onchange=()=>changeItem(role,Number($(role+'Queue').value),true);
  }
  function immersive(active){document.body.classList.toggle('immersive',active);$('immerse').setAttribute('aria-pressed',String(active));$('immerse').textContent=active?'退出沉浸模式':'沉浸模式';}
  $('immerse').onclick=()=>immersive(!document.body.classList.contains('immersive'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('immersive')){immersive(false);$('immerse').focus();}});
  $('sessionMute').onchange=()=>{
   $('setupMute').checked=$('sessionMute').checked;save();const adapter=adapters.workout;if(!adapter)return;
   if(adapter.capabilities.canMuteProgrammatically){try{adapter.setMuted($('sessionMute').checked);notice(adapter.ready?'已更新锻炼静音设置。':'将在锻炼播放器就绪后应用静音设置。');}catch{notice('设置暂未生效，请重试。');}}
   else {$('applyMute').hidden=$('sessionMute').checked===!!adapter.options.muted;notice($('applyMute').hidden?'静音设置未改变。':'点击“重新载入锻炼视频以应用”，B站进度将重置。');}
  };
  $('applyMute').onclick=()=>{mount('workout');notice('已重新载入B站锻炼视频；请在播放器内确认静音并开始播放。');};
  $('entertainmentVolume').oninput=()=>{const volume=Number($('entertainmentVolume').value);$('volumeValue').textContent=volume+'%';const a=adapters.entertainment;if(a?.capabilities.canSetVolume){a.setVolume(volume);a.setMuted(volume===0);}};
  document.querySelectorAll('[data-seconds]').forEach(button=>button.onclick=()=>startTimer(Number(button.dataset.seconds)));
  $('cancelTimer').onclick=()=>{timer.cancel();$('timerResult').textContent='已取消计时';$('timerChoices').querySelector('button').focus({preventScroll:true});};
  $('customToggle').onclick=()=>{$('customForm').hidden=!$('customForm').hidden;$('customToggle').setAttribute('aria-expanded',String(!$('customForm').hidden));if(!$('customForm').hidden)$('customSeconds').focus();};
  $('customForm').onsubmit=e=>{e.preventDefault();startTimer(Number($('customSeconds').value));};
  document.querySelectorAll('[data-reload]').forEach(button=>button.onclick=()=>{const role=button.dataset.reload;if(role==='entertainment')timer.cancel();mount(role);notice(`已重新加载${ROLES[role]}视频，进度会重置。`);});
  $('back').onclick=()=>{document.dispatchEvent(new CustomEvent('cn:session-end'));
   timer.cancel();clearTimeout(finishTimeout);immersive(false);for(const role of Object.keys(adapters)){adapters[role].destroy();delete adapters[role];}save();$('sessionView').hidden=true;$('setupView').hidden=false;$('customForm').hidden=true;$('customToggle').setAttribute('aria-expanded','false');$('timerResult').textContent='';$('toast').hidden=true;$('workoutUrl').focus({preventScroll:true});window.scrollTo(0,0);
  };
  document.addEventListener('visibilitychange',()=>timer.tick());window.addEventListener('pageshow',()=>timer.tick());window.addEventListener('pagehide',()=>timer.cancel());
 }
 return {parseVideo,parseImport,bilibiliURL,PlayerAdapter,YouTubePlayerAdapter,BilibiliPlayerAdapter,createAdapter,QuickTimer,beginAudioDuck,init};
});
