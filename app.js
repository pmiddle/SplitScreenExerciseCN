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
 function normalizePage(value){if(typeof value==='string'&&!/^\d+$/.test(value))return 1;const number=Number(value);return Number.isSafeInteger(number)&&number>=1?number:1;}
 function sourceKey(video){return video.platform==='Bilibili'&&video.shortUrl?`bilibili:short:${video.shortUrl}`:video.platform==='Bilibili'?`bilibili:${video.id}:p${normalizePage(video.p)}`:`youtube:${video.playlistId?'playlist:'+video.playlistId:video.id}`;}
 function bilibiliSource(id,page,originalUrl,aid){const video={platform:'Bilibili',id,p:normalizePage(page),originalUrl};if(aid)video.aid=aid;video.sourceKey=sourceKey(video);return video;}
 function parseVideo(text){
  const textValue=text.trim().replace(/[\u200B-\u200D\uFEFF]/g,'');const av=textValue.match(/^av([1-9]\d*)$/i);if(av)return bilibiliSource('av'+av[1],1,textValue,av[1]);const bv=textValue.match(/^BV[0-9A-Za-z]{10}$/i);if(bv)return bilibiliSource('BV'+textValue.slice(2),1,textValue);
  const barePart=textValue.match(/^(BV[0-9A-Za-z]{10})\?(.*)$/i);if(barePart)return bilibiliSource('BV'+barePart[1].slice(2),new URLSearchParams(barePart[2]).get('p'),textValue);
  if(!/https?:\/\//i.test(textValue)&&!/(?:bilibili\.com|b23\.tv|bili2233\.cn)\//i.test(textValue)){const embedded=textValue.match(/\b(BV[0-9A-Za-z]{10}|av[1-9]\d*)\b/i);if(embedded&&embedded[0]!==textValue&&!/bilibili:\/\//i.test(textValue))return parseVideo(embedded[0]);}
  const matched=textValue.match(/(?:https?|bilibili):\/\/[^\s<>"'【】《》]+/i);const raw=(matched?matched[0]:textValue).replace(/[，。；！？、）)\]》】,;!.]+$/u,'');const u=new URL(/^(?:https?|bilibili):\/\//i.test(raw)?raw:raw.startsWith('//')?'https:'+raw:'https://'+raw);
  if(u.protocol==='bilibili:'){const id=u.searchParams.get('bvid')||u.pathname.split('/').filter(Boolean).pop()||u.hostname;if(/^BV[0-9A-Za-z]{10}$/i.test(id))return bilibiliSource(id,u.searchParams.get('p'),raw);const aid=u.searchParams.get('aid')||id;if(/^(?:av)?[1-9]\d*$/i.test(aid))return bilibiliSource('av'+aid.replace(/^av/i,''),u.searchParams.get('p'),raw,aid.replace(/^av/i,''));throw Error('unsupported Bilibili app link');}
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('invalid URL');
  const host=u.hostname.toLowerCase();let id;
  if(['b23.tv','www.b23.tv','bili2233.cn','www.bili2233.cn'].includes(host)){if(!/^\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))throw Error('invalid short URL');u.protocol='https:';return {platform:'Bilibili',id:null,shortUrl:u.href,originalUrl:raw};}
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(host)){
   id=host.endsWith('youtu.be')?u.pathname.split('/')[1]:u.pathname==='/watch'?u.searchParams.get('v'):/^\/(embed|shorts|live)\//.test(u.pathname)?u.pathname.split('/')[2]:null;
   const list=u.searchParams.get('list');const playlistId=list&&/^[A-Za-z0-9_-]{10,100}$/.test(list)?list:null;
   if(!/^[\w-]{11}$/.test(id||'')){if(u.pathname==='/playlist'&&playlistId)return {platform:'YouTube',id:null,playlistId};throw Error('invalid video ID');}
   return playlistId?{platform:'YouTube',id,playlistId}:{platform:'YouTube',id};
  }
  if(['bilibili.com','www.bilibili.com','m.bilibili.com','player.bilibili.com'].includes(host)){
   const queryId=u.searchParams.get('bvid')||u.searchParams.get('aid');if(queryId){const result=parseVideo(/^\d+$/.test(queryId)?'av'+queryId:queryId);return bilibiliSource(result.id,u.searchParams.get('p'),raw,result.aid);}
   const av=u.pathname.match(/^\/video\/av([1-9]\d*)(?:\/|$)/i);if(av){const p=u.searchParams.get('p');return bilibiliSource('av'+av[1],p,raw,av[1]);}
   id=u.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10})(?:\/|$)/)?.[1];if(!id)throw Error('invalid BV ID');
   const p=u.searchParams.get('p');return bilibiliSource(id,p,raw);
  }
  throw Error('unsupported host');
 }
 function parseImport(text){
  const tokens=[];
  for(const line of text.split(/\r?\n/)){
   const urls=line.match(/(?:(?:https?|bilibili):\/\/|(?:(?:www|m)\.)?(?:b23\.tv|bili2233\.cn|bilibili\.com|youtube\.com|youtu\.be)\/)[^\s<>"'【】《》]+/gi);
   if(urls){tokens.push(...urls);continue;}
   const bareParts=line.trim().match(/^BV[0-9A-Za-z]{10}\?[^\s]+$/i);if(bareParts){tokens.push(bareParts[0]);continue;}
   const ids=line.match(/\b(?:BV[0-9A-Za-z]{10}|av[1-9]\d*)\b/gi);
   if(ids){tokens.push(...ids);continue;}
   if(/^(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be|bilibili\.com|b23\.tv)\//i.test(line.trim()))tokens.push(line.trim());
  }
  if(!tokens.length)throw Error('未识别到视频，请粘贴分享文字、完整链接或BV号。');
  if(tokens.length>100)throw Error('每个队列最多导入100项，请分批使用。');
  return tokens.map((token,index)=>{try{const video=parseVideo(token);const line=text.split(/\r?\n/).find(line=>line.includes(token));const prefix=line?.split(token)[0].trim().replace(/^[【\[]|[】\]]$/g,'').trim();if(prefix)video.title=prefix.slice(0,160);return video;}catch{
   if(/(?:https?:\/\/)?(?:www\.)?b23\.tv\//i.test(token))throw Error(`第${index+1}项是B站短链，请打开后复制完整视频网址，或填写BV号。`);
   throw Error(`请检查第${index+1}项链接或视频号。`);
  }});
 }
 const shortCache=new Map();
 async function resolveVideo(video,fetcher=fetch){
  if(!video.shortUrl)return video;
  if(shortCache.has(video.shortUrl))return {...shortCache.get(video.shortUrl),originalUrl:video.originalUrl||video.shortUrl,resolvedUrl:shortCache.get(video.shortUrl).originalUrl,...(video.title?{title:video.title}:{})};
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{const response=await fetcher(video.shortUrl,{redirect:'follow',credentials:'omit',signal:controller.signal});const resolved=parseVideo(response.url);if(resolved.shortUrl||resolved.platform!=='Bilibili')throw Error('not a video redirect');shortCache.set(video.shortUrl,resolved);return {...resolved,originalUrl:video.originalUrl||video.shortUrl,resolvedUrl:resolved.originalUrl,...(video.title?{title:video.title}:{})};}
  catch{const error=Error('请打开短链，复制视频号或完整视频地址。');error.shortUrl=video.shortUrl;error.shortOriginal=video.originalUrl||video.shortUrl;throw error;}
  finally{clearTimeout(timeout);}
 }
 function bilibiliURL(video,muted){const u=new URL('https://player.bilibili.com/player.html');if(video.aid)u.searchParams.set('aid',video.aid);else u.searchParams.set('bvid',video.id);u.searchParams.set('autoplay','0');u.searchParams.set('muted',muted?'1':'0');u.searchParams.set('danmaku','0');u.searchParams.set('p',String(normalizePage(video.p)));return u.href;}
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
  constructor(mount,video,options={}){this.mount=mount;this.video=video;this.sourceKey=sourceKey(video);this.options=options;this.capabilities=unsupported;this.ready=false;this.destroyed=false;}
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
     onError:event=>{if(this.destroyed)return;clearTimeout(this.readyTimeout);this.ready=false;const errors={2:'视频链接无效，请更换链接。',5:'视频暂时无法播放，请重试。',100:'视频已删除或无法公开观看。',101:'这个视频不允许在站外播放，请更换视频。',150:'这个视频不允许在站外播放，请更换视频。',153:'请刷新后重试，或在YouTube打开观看。'};this.error(errors[event.data]||'YouTube 视频加载失败，请重试或更换视频。');},
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
   iframe.addEventListener('load',()=>{if(this.destroyed)return;this.status('在画面内播放');/* Document load is not playback readiness. */});
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
  const $=id=>document.getElementById(id);const adapters={};let queues={},indices={workout:0,entertainment:0},videos={},mainRole='entertainment',toastTimeout,finishTimeout,sessionId=null,pipAdjusted=false;const KEY='move-mix-cn:setup:v1';
  const parts=window.MoveMixParts.createController({parseImport,resolveVideo,sourceKey},(role,video)=>{if(role==='entertainment')captureEntertainment();const existing=queues[role].findIndex(v=>sourceKey(v)===sourceKey(video));if(existing>=0&&existing!==indices[role]){changeItem(role,existing);return;}queues[role][indices[role]]=video;videos[role]=video;mount(role);if(role==='workout')document.dispatchEvent(new CustomEvent('cn:workout-selected',{detail:{workouts:queues.workout,sessionId}}));});
  function captureEntertainment(){if(!sessionId||!videos.entertainment)return;const snapshot=window.MoveMixRecords?.entertainmentSnapshot(videos.entertainment,adapters.entertainment,sessionId);if(snapshot)document.dispatchEvent(new CustomEvent('cn:entertainment-progress',{detail:snapshot}));}
  const progressPoll=setInterval(captureEntertainment,5000);
  function notice(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').hidden=true,6000);$('sessionStatus').textContent=text;}
  function detect(role){let queue=null;const value=$(role+'Url').value;parts.refresh(role,value);try{queue=parseImport(value);}catch{}$(role+'Detected').textContent=queue?'已识别 '+queue.length+' 项'+(queue.some(v=>v.shortUrl)?'':'')+' · '+[...new Set(queue.map(v=>v.platform+(v.platform==='Bilibili'&&!v.shortUrl?' · P'+v.p:'')))].join(' / '):value.trim()?'待识别：支持分享文字、完整链接或BV号':'可粘贴多条分享文字、链接或BV号，每行一条';return queue;}

  function save(){try{localStorage.setItem(KEY,JSON.stringify({workout:$('workoutUrl').value,entertainment:$('entertainmentUrl').value,muted:$('setupMute').checked}));}catch{}}
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){$('workoutUrl').value=typeof saved.workout==='string'?saved.workout:'';$('entertainmentUrl').value=typeof saved.entertainment==='string'?saved.entertainment:'';$('setupMute').checked=true;}}catch{}
  for(const role of Object.keys(ROLES)){detect(role);$(role+'Url').addEventListener('input',()=>{detect(role);$(role+'Error').textContent='';$(role+'Url').removeAttribute('aria-invalid');save();});}
  $('setupMute').onchange=save;
  function failure(role,text){$(role+'State').textContent='加载遇到问题';$(role+'Failure').querySelector('p').textContent=text;$(role+'Failure').hidden=false;}
  function mount(role,autoPlay=false){
   document.dispatchEvent(new CustomEvent('cn:before-player-change',{detail:{role}}));
   adapters[role]?.destroy();$(role+'Failure').hidden=true;
   const video=videos[role];const external=$(role+'External');external.href=window.MoveMixLibrary.canonical(video);external.textContent=ROLES[role]+' · 在'+(video.platform==='Bilibili'?'B站':'YouTube')+'打开';$(role+'Label').textContent=`${role==='workout'?'↗':'♫'} ${ROLES[role]} · ${video.platform}${video.platform==='Bilibili'?' · P'+video.p:''}`;
   const muted=role==='workout'?$('sessionMute').checked:false;
   adapters[role]=createAdapter($(role+'Mount'),video,{role,muted,autoPlay,volume:role==='entertainment'?Number($('entertainmentVolume').value):65,onStatus:text=>$(role+'State').textContent=text,onError:text=>failure(role,text),onNotice:notice,onEnded:()=>{if(indices[role]+1<queues[role].length)changeItem(role,indices[role]+1,true);else notice(`${ROLES[role]}队列已播放完毕。`);},onReady:()=>{if(role==='entertainment'){$('entertainmentVolume').disabled=false;captureEntertainment();}}});
   adapters[role].load();sizePip();if(role==='entertainment')captureEntertainment();parts.session(role,video,indices[role]);updateQueueUI();document.dispatchEvent(new CustomEvent('cn:player-mounted',{detail:{role,video,beginDuck:beginCountdownCue}}));if(role==='workout'){$('applyMute').hidden=true;updateMuteHelp();}
  }
  function updateQueueUI(){
   for(const role of Object.keys(ROLES)){
    const queue=queues[role]||[],select=$(role+'Queue');select.replaceChildren();
    queue.forEach((video,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`${index+1}. ${video.videoTitle||video.baseTitle||video.title||(video.playlistId?'YouTube 播放列表':video.id)}${video.platform==='Bilibili'?' · P'+video.p+(video.partTitle?' · '+video.partTitle:''):''}`;select.append(option);});
    select.value=String(indices[role]);$(role+'Previous').disabled=indices[role]<=0;$(role+'Next').disabled=indices[role]>=queue.length-1;
    $(role+'QueueNote').textContent=videos[role]?.platform==='Bilibili'?'用“下一项”切换分P，在播放器内播放。':videos[role]?.playlistId?'合集自动联播，也可选择下一项。':'播放完会切换下一项。';
   }
   $('combo').textContent=`${videos.workout.platform} × ${videos.entertainment.platform}`;
   $('entertainmentVolumeRow').hidden=videos.entertainment.platform!=='YouTube';
   const hasBilibili=Object.values(videos).some(v=>v.platform==='Bilibili');$('platformHelp').hidden=!hasBilibili;$('playBoth').hidden=hasBilibili;$('pauseBoth').hidden=hasBilibili;$('manualPlaybackHint').hidden=!hasBilibili;
   $('bilibiliVolumeHint').textContent=videos.entertainment.platform==='Bilibili'?'娱乐音量请在B站播放器中调整。':'';
  }
  function changeItem(role,index,autoPlay=false){
   if(index<0||index>=queues[role].length)return;
   if(role==='entertainment'){captureEntertainment();if(videos[role]?.platform!=='Bilibili'||queues[role][index].platform!=='Bilibili')timer.cancel();}
   indices[role]=index;videos[role]=queues[role][index];
   if(role==='entertainment')$('entertainmentVolume').disabled=true;
   mount(role,autoPlay);notice(`已切换${ROLES[role]}第${index+1}项。${videos[role].platform==='Bilibili'?'请在B站播放器中点击播放。':''}`);
  }
  function updateMuteHelp(){const bili=videos.workout?.platform==='Bilibili';$('muteHelp').textContent=bili?'改动静音后，请重新载入；视频会从头开始。':'YouTube 可直接切换锻炼静音。';}
  function layout(){const small=mainRole==='entertainment'?'workout':'entertainment';$('stage').dataset.main=mainRole;for(const role of Object.keys(ROLES))$(role+'Shell').classList.toggle('small',role===small);}
  let audioContext=null;
  function prepareCueAudio(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audioContext ||= new Audio();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
  function beginCountdownCue(){
   const releases=Object.values(adapters).map(a=>beginAudioDuck(a,active=>{if(a===adapters.entertainment)$('entertainmentVolume').disabled=active||!a.ready;})).filter(Boolean),tones=[];
   {
    if(audioContext?.state==='running'){for(const offset of [0,.5,1]){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime+offset;oscillator.frequency.value=880;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.12,t+.015);gain.gain.linearRampToValueAtTime(0,t+.18);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(t);oscillator.stop(t+.2);tones.push({oscillator,gain});}}
    else $('timerResult').textContent='请留意倒计时高亮。';
   }
   return ()=>{for(const release of releases)release();for(const {oscillator,gain} of tones){try{oscillator.stop();}catch{}oscillator.disconnect();gain.disconnect();}};
  }
  const timer=new QuickTimer({beginDuck:beginCountdownCue,render:state=>{
   const select=$('quickTimerSelect');select.options[0].textContent=state.running?'计时 '+state.seconds+'秒':state.finished?'计时完成 · 选择新计时':'选择计时';$('cancelTimerOption').disabled=!state.running;
   $('overlayRemaining').textContent=state.seconds;$('timerOverlay').hidden=!state.running&&!state.finished;$('timerOverlay').classList.toggle('urgent',state.urgent);$('timerOverlay').classList.toggle('finished',state.finished);
   if(state.finished){$('timerResult').textContent='计时结束';$('overlayRemaining').textContent='完成';clearTimeout(finishTimeout);finishTimeout=setTimeout(()=>$('timerOverlay').hidden=true,2400);}
  }});
  document.addEventListener('cn:cue-start',()=>{prepareCueAudio();timer.cancel();});
  function startTimer(seconds){if(!Number.isInteger(seconds)||seconds<1||seconds>3600){$('customError').textContent='请输入1–3600之间的整数秒数。';return;}prepareCueAudio();document.dispatchEvent(new CustomEvent('cn:quick-start'));clearTimeout(finishTimeout);$('timerResult').textContent='';$('customError').textContent='';$('customForm').hidden=true;timer.start(seconds);$('quickTimerSelect').value='';$('quickTimerSelect').focus({preventScroll:true});}
  let importing=false;
  $('setupForm').onsubmit=async event=>{
   event.preventDefault();if(importing)return;importing=true;const startButton=$('setupForm').querySelector('[type=submit]');startButton.disabled=true;startButton.textContent='正在识别…';const sources={workout:$('workoutUrl').value,entertainment:$('entertainmentUrl').value};const next={};let firstInvalid;
   for(const role of Object.keys(ROLES)){try{$(role+'ShortFix').hidden=true;parseImport(sources[role]);next[role]=await parts.prepare(role,sources[role]);$(role+'Error').textContent='';}catch(error){next[role]=null;$(role+'Error').textContent=error.message;if(error.shortUrl){$(role+'ShortFix').hidden=false;$(role+'ShortLink').href=error.shortUrl;$(role+'ShortFix').dataset.shortUrl=error.shortOriginal||error.shortUrl;}}detect(role);$(role+'Url').setAttribute('aria-invalid',String(!next[role]));if(!next[role]&&!firstInvalid)firstInvalid=$(role+'Url');}
   importing=false;startButton.disabled=false;startButton.textContent='开始';if(Object.keys(ROLES).some(role=>$(role+'Url').value!==sources[role])){$('workoutError').textContent='输入已改变，请再次点击开始。';return;}if(firstInvalid){firstInvalid.focus();return;}timer.cancel();save();sessionId=Date.now().toString(36)+Math.random().toString(36).slice(2,8);queues=next;indices={workout:0,entertainment:0};videos={workout:queues.workout[0],entertainment:queues.entertainment[0]};mainRole='entertainment';layout();$('setupView').hidden=true;$('sessionView').hidden=false;$('sessionMute').checked=$('setupMute').checked;$('combo').textContent=`${videos.workout.platform} × ${videos.entertainment.platform}`;
   $('entertainmentVolumeRow').hidden=videos.entertainment.platform!=='YouTube';$('entertainmentVolume').disabled=true;
   const hasBilibili=Object.values(videos).some(v=>v.platform==='Bilibili');$('platformHelp').hidden=!hasBilibili;$('playBoth').hidden=hasBilibili;$('pauseBoth').hidden=hasBilibili;$('manualPlaybackHint').hidden=!hasBilibili;$('bilibiliVolumeHint').textContent=videos.entertainment.platform==='Bilibili'?'娱乐音量请在B站播放器中调整。':'';
   document.dispatchEvent(new CustomEvent('cn:session-start',{detail:{workouts:queues.workout,sessionId}}));mount('entertainment');mount('workout');$('sessionStatus').textContent=Object.values(videos).some(v=>v.platform==='Bilibili')?'请在各播放器内分别开始或暂停。':'准备好后点击“同时播放”。';$('quickTimerSelect').focus({preventScroll:true});window.scrollTo(0,0);
  };
  function transport(action){if(action==='pause')document.dispatchEvent(new CustomEvent('cn:pause-all'));const bili=[],waiting=[];for(const [role,adapter] of Object.entries(adapters)){
   const cap=action==='play'?'canPlayProgrammatically':'canPauseProgrammatically';
   if(!adapter.capabilities[cap])bili.push(role);else try{if(!adapter[action]())waiting.push(ROLES[role]);}catch{waiting.push(ROLES[role]);}
  }
  const text=action==='play'?'请点击 B站播放器开始播放':'B站播放器需要在播放器控件中手动暂停';const readyText=action==='play'?'请在播放器中确认播放。':'已暂停。';notice([bili.length?text:readyText,waiting.length?`${waiting.join('、')}视频尚未就绪，请稍后重试。`:''].filter(Boolean).join(' '));}
  $('playBoth').onclick=()=>transport('play');$('pauseBoth').onclick=()=>transport('pause');
  $('swap').onclick=()=>{mainRole=mainRole==='entertainment'?'workout':'entertainment';layout();notice(`${ROLES[mainRole]}已切换为大屏。`);};
  $('position').onchange=()=>$('stage').dataset.position=$('position').value;
  for(const role of Object.keys(ROLES))$(role+'ApplyId').onclick=()=>{try{const v=parseVideo($(role+'ReplacementId').value);if(v.platform!=='Bilibili'||v.shortUrl)throw Error();$(role+'Url').value=$(role+'Url').value.replace($(role+'ShortFix').dataset.shortUrl,window.MoveMixLibrary.canonical(v));$(role+'Url').dispatchEvent(new Event('input',{bubbles:true}));$(role+'ShortFix').hidden=true;}catch{$(role+'Error').textContent='请输入有效的BV号、av号或完整B站视频地址。';}};


  function sizePip(){
   const stage=$('stage'),workspace=$('playerWorkspace'),split=stage.classList.contains('split-stage'),side=split&&$('splitPosition').value.startsWith('side-');workspace.classList.toggle('side-workspace',side);
   const available=workspace.clientWidth;if(!available)return;const portrait=matchMedia('(max-width:600px) and (orientation:portrait)').matches;
   const minimum=portrait?Math.min(280,available-20):204,requested=pipAdjusted?Number($('pipSize').value):portrait?Math.max(280,available*.78):Number($('pipSize').value),width=Math.max(minimum,Math.min(requested,side?Math.max(minimum,available-220):available-20)),height=Math.max(portrait?242:238,width*.5625+36);
   if(!split)stage.style.setProperty('--pip-width',width+'px');
   stage.style.setProperty('--split-width',width+'px');stage.style.setProperty('--pip-height',height+'px');workspace.style.setProperty('--secondary-height',height+'px');workspace.style.setProperty('--primary-height',$('mainHeight').value+'px');
   if(split)stage.style.setProperty('--main-width',Math.max(204,Math.min(available*Number($('mainWidth').value)/100,side?available-width-16:available))+'px');
   $('pipSizeValue').textContent=Math.round(width)+'px';
  }
  $('pipSize').oninput=()=>{pipAdjusted=true;$('stage').style.setProperty('--pip-width',$('pipSize').value+'px');sizePip();};
  if(window.ResizeObserver){const observer=new ResizeObserver(sizePip);observer.observe($('stage'));observer.observe($('playerWorkspace'));}else window.addEventListener('resize',sizePip);
  for(const role of Object.keys(ROLES)){
   $(role+'Previous').onclick=()=>changeItem(role,indices[role]-1,true);
   $(role+'Next').onclick=()=>changeItem(role,indices[role]+1,true);
   $(role+'Queue').onchange=()=>changeItem(role,Number($(role+'Queue').value),true);
  }
  function immersive(active){
   const stage=$('stage');if(active&&!stage.classList.contains('split-stage')){$('mainWidth').value='100';stage.style.setProperty('--main-width','100%');$('mainHeight').value=Math.round(stage.getBoundingClientRect().height);stage.style.setProperty('--main-height',stage.getBoundingClientRect().height+'px');}
   stage.classList.toggle('split-stage',active);$('splitSettings').hidden=!active;$('position').closest('label').hidden=active;$('immerse').setAttribute('aria-pressed',String(active));$('immerse').textContent=active?'浮窗模式':'分屏';sizePip();
  }
  $('immerse').onclick=()=>immersive(!$('stage').classList.contains('split-stage'));
  $('mainWidth').oninput=sizePip;
  $('mainHeight').oninput=()=>{$('stage').style.setProperty('--main-height',$('mainHeight').value+'px');sizePip();};
  $('splitPosition').onchange=()=>{$('stage').dataset.splitPosition=$('splitPosition').value;sizePip();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('stage').classList.contains('split-stage'))immersive(false);});
  $('sessionMute').onchange=()=>{
   $('setupMute').checked=$('sessionMute').checked;save();const adapter=adapters.workout;if(!adapter)return;
   if(adapter.capabilities.canMuteProgrammatically){try{adapter.setMuted($('sessionMute').checked);notice(adapter.ready?'已更新锻炼静音设置。':'将在锻炼播放器就绪后应用静音设置。');}catch{notice('设置暂未生效，请重试。');}}
   else {$('applyMute').hidden=$('sessionMute').checked===!!adapter.options.muted;notice($('applyMute').hidden?'静音设置未改变。':'点击“重新载入锻炼视频以应用”，B站进度将重置。');}
  };
  $('applyMute').onclick=()=>{mount('workout');notice('已重新载入B站锻炼视频；请在播放器内确认静音并开始播放。');};
  $('entertainmentVolume').oninput=()=>{const volume=Number($('entertainmentVolume').value);$('volumeValue').textContent=volume+'%';const a=adapters.entertainment;if(a?.capabilities.canSetVolume){a.setVolume(volume);a.setMuted(volume===0);}};
  $('quickTimerSelect').addEventListener('pointerdown',prepareCueAudio);$('quickTimerSelect').addEventListener('keydown',prepareCueAudio);
  $('quickTimerSelect').onchange=()=>{const value=$('quickTimerSelect').value;$('quickTimerSelect').value='';if(value==='custom'){$('customForm').hidden=false;$('customSeconds').focus();}else if(value==='cancel'){timer.cancel();$('timerResult').textContent='已取消计时';}else if(value)startTimer(Number(value));};
  $('customForm').onsubmit=e=>{e.preventDefault();startTimer(Number($('customSeconds').value));};
  const lastTap=new WeakMap();document.addEventListener('click',event=>{const target=event.target.closest?.('.transport button,#immerse');if(!target||!event.isTrusted)return;const now=Date.now(),previous=lastTap.get(target)||0;if(now-previous<320){event.preventDefault();event.stopImmediatePropagation();return;}lastTap.set(target,now);},true);
  document.addEventListener('dblclick',event=>{if(event.target.closest?.('button,select,summary'))event.preventDefault();});
  document.querySelectorAll('[data-reload]').forEach(button=>button.onclick=()=>{const role=button.dataset.reload;if(role==='entertainment'){captureEntertainment();timer.cancel();}mount(role);notice(`已重新加载${ROLES[role]}视频，进度会重置。`);});
  $('back').onclick=()=>{captureEntertainment();sessionId=null;document.dispatchEvent(new CustomEvent('cn:session-end'));
   timer.cancel();clearTimeout(finishTimeout);immersive(false);for(const role of Object.keys(adapters)){adapters[role].destroy();delete adapters[role];}save();$('sessionView').hidden=true;$('setupView').hidden=false;$('customForm').hidden=true;$('timerResult').textContent='';$('toast').hidden=true;$('workoutUrl').focus({preventScroll:true});window.scrollTo(0,0);
  };
  document.addEventListener('visibilitychange',()=>{timer.tick();captureEntertainment();});window.addEventListener('pageshow',()=>timer.tick());window.addEventListener('pagehide',()=>{captureEntertainment();timer.cancel();});
 }
 return {parseVideo,parseImport,normalizePage,sourceKey,resolveVideo,bilibiliURL,PlayerAdapter,YouTubePlayerAdapter,BilibiliPlayerAdapter,createAdapter,QuickTimer,beginAudioDuck,init};
});

