'use strict';
const assert=require('node:assert/strict');
const {parseVideo,parseImport,bilibiliURL,createAdapter,YouTubePlayerAdapter,BilibiliPlayerAdapter,QuickTimer,beginAudioDuck}=require('../app.js');
let checks=0;function test(name,run){run();checks++;console.log('PASS '+name);}
const yt='M7lc1UVf-VE',bv='BV1B7411m7LV';
test('URL parsing: HTTPS, no scheme, watch, short, mobile, embed, live, BV and part',()=>{
 for(const url of [`youtube.com/watch?v=${yt}`,`https://youtu.be/${yt}`,`https://m.youtube.com/watch?v=${yt}`,`https://www.youtube.com/shorts/${yt}`,`https://youtube.com/embed/${yt}`,`https://youtube.com/live/${yt}`])assert.equal(parseVideo(url).id,yt);
 assert.deepEqual(parseVideo(`https://www.bilibili.com/video/${bv}/?p=2`),{platform:'Bilibili',id:bv,p:'2'});
 for(const url of ['', 'javascript:alert(1)',`https://youtube.com.evil.test/watch?v=${yt}`,`https://youtube.com@evil.test/watch?v=${yt}`,`https://user:pass@youtube.com/watch?v=${yt}`,'https://www.youtube.com/watch?v=short','https://bilibili.com/video/no'])assert.throws(()=>parseVideo(url));
});
test('Bilibili share text, punctuation, BV/av numbers and multiline import',()=>{
 assert.equal(parseVideo('【分享标题】https://www.bilibili.com/video/'+bv+'/。').id,bv);
 assert.equal(parseVideo(bv).id,bv);assert.equal(parseVideo('bv1B7411m7LV').id,bv);
 assert.equal(parseVideo('av170001').aid,'170001');assert.equal(new URL(bilibiliURL(parseVideo('av170001'),true)).searchParams.get('aid'),'170001');
 const items=parseImport('【运动标题】\nhttps://www.bilibili.com/video/'+bv+'/\n'+bv+'\nhttps://youtu.be/'+yt);assert.equal(items.length,3);assert.equal(items[2].platform,'YouTube');
 assert.equal(parseImport('av170001 '+bv).length,2);
 assert.equal(parseImport('【分享】https://b23.tv/abc')[0].shortUrl,'https://b23.tv/abc');
 assert.throws(()=>parseImport('https://evil.test/video/'+bv));
 assert.throws(()=>parseImport(Array(101).fill(bv).join('\n')),/100/);
});
test('Official YouTube playlist links are recognized without Data API',()=>{
 const list='PLBCF2DAC6FFB574DE';assert.equal(parseVideo('https://www.youtube.com/playlist?list='+list).playlistId,list);
 assert.equal(parseVideo('https://www.youtube.com/watch?v='+yt+'&list='+list).playlistId,list);
 assert.throws(()=>parseVideo('https://www.youtube.com/playlist?list=<bad>'));
});
test('All four platform orders route through independent adapters',()=>{
 for(const a of ['YouTube','Bilibili'])for(const b of ['YouTube','Bilibili']){
 const mount={replaceChildren(){}};const x=createAdapter(mount,{platform:a,id:a==='YouTube'?yt:bv},{role:'workout'});const y=createAdapter(mount,{platform:b,id:b==='YouTube'?yt:bv},{role:'entertainment'});
 assert.equal(x instanceof YouTubePlayerAdapter,a==='YouTube');assert.equal(y instanceof BilibiliPlayerAdapter,b==='Bilibili');assert.notEqual(x,y);
 for(const adapter of [x,y])for(const supported of Object.values(adapter.capabilities))assert.equal(supported,adapter.video.platform==='YouTube');
 }
});
test('Bilibili documented initial flags and unsupported runtime methods',()=>{
 const video={platform:'Bilibili',id:bv,p:'2'};for(const muted of [true,false]){const u=new URL(bilibiliURL(video,muted));assert.equal(u.origin,'https://player.bilibili.com');assert.equal(u.searchParams.get('muted'),muted?'1':'0');assert.equal(u.searchParams.get('autoplay'),'0');assert.equal(u.searchParams.get('danmaku'),'0');assert.equal(u.searchParams.get('p'),'2');}
 const adapter=new BilibiliPlayerAdapter({},video,{});for(const method of ['play','pause','setMuted','setVolume','seek'])assert.equal(adapter[method](true),false);assert.equal(adapter.getCurrentTime(),null);
 assert.equal(beginAudioDuck(adapter),null);
});
function fixture(){let now=0,ducks=0,releases=0,view;const timer=new QuickTimer({now:()=>now,schedule:()=>1,clear:()=>{},beginDuck:()=>{ducks++;return()=>releases++;},render:s=>view=s});return {timer,set:t=>now=t,get view(){return view},get ducks(){return ducks},get releases(){return releases}};}
test('Elapsed-time countdown and precisely one final 1.5s duck/restoration',()=>{const f=fixture();assert(f.timer.start(30));f.set(28000);f.timer.tick();assert.equal(f.view.seconds,2);assert(f.view.urgent);assert.equal(f.ducks,0);f.set(28500);f.timer.tick();assert.equal(f.ducks,1);f.set(29000);f.timer.tick();assert.equal(f.ducks,1);f.set(30000);f.timer.tick();assert(f.view.finished);assert.equal(f.releases,1);});
test('Background delayed callback finishes without late duck',()=>{const f=fixture();f.timer.start(45);f.set(80000);f.timer.tick();assert(f.view.finished);assert.equal(f.ducks,0);});
test('Cancellation, restart, invalid duration and no video time dependency',()=>{const f=fixture();assert.equal(f.timer.start(0),false);assert.equal(f.timer.start(1.2),false);assert.equal(f.timer.start(3601),false);f.timer.start(1);assert.equal(f.ducks,1);f.timer.cancel();assert.equal(f.releases,1);f.timer.start(60);f.set(10000);f.timer.tick();assert.equal(f.view.seconds,50);f.timer.start(30);assert.equal(f.view.seconds,30);});
test('YouTube audio state restores original mute + volume; cancellation same restore',()=>{for(const muted of [true,false]){const a={capabilities:{canMuteProgrammatically:true},ready:true,muted,volume:37,getAudioState(){return{muted:this.muted,volume:this.volume}},setMuted(v){this.muted=v},setVolume(v){this.volume=v}};const release=beginAudioDuck(a);assert(a.muted);a.volume=0;release();assert.equal(a.muted,muted);assert.equal(a.volume,37);}});
test('Destroyed entertainment adapter never receives delayed restoration',()=>{let writes=0;const a={capabilities:{canMuteProgrammatically:true},ready:true,getAudioState:()=>({muted:false,volume:20}),setMuted:()=>writes++,setVolume:()=>writes++};const release=beginAudioDuck(a);a.destroyed=true;release();assert.equal(writes,1);});
// Adapter contract test: official API calls are exercised against a controlled test double,
// not claimed as live playback. Live player verification is recorded separately.
(async()=>{
 const methods=[];let callbacks,player;
 global.window={YT:{Player:true}};global.document={createElement:()=>({})};global.location={origin:'http://localhost:8766'};
 global.YT={Player:function(target,config){callbacks=config.events;player=this;for(const name of ['playVideo','pauseVideo','mute','unMute','setVolume','seekTo','destroy','cuePlaylist','loadPlaylist'])this[name]=(...args)=>methods.push([name,...args]);this.isMuted=()=>false;this.getVolume=()=>37;this.getCurrentTime=()=>12;this.getPlayerState=()=>2;return this;}};
 const a=new YouTubePlayerAdapter({replaceChildren(){}},{id:yt,platform:'YouTube'},{role:'entertainment',muted:false,volume:80});await a.load();callbacks.onReady({target:player});assert(a.play());assert(a.pause());a.setMuted(true);a.setVolume(55);a.seek(10);assert.equal(a.getCurrentTime(),12);assert.equal(a.getPlayerState(),2);assert(methods.some(v=>v[0]==='playVideo'));assert(methods.some(v=>v[0]==='pauseVideo'));a.destroy();assert.equal(a.play(),false);checks++;console.log('PASS YouTube adapter official-method contract (test double)');
 let ended=0;const playlist=new YouTubePlayerAdapter({replaceChildren(){}},{id:null,playlistId:'PLBCF2DAC6FFB574DE',platform:'YouTube'},{role:'entertainment',onEnded:()=>ended++});await playlist.load();callbacks.onReady({target:player});assert(methods.some(m=>m[0]==='cuePlaylist'));callbacks.onStateChange({data:0});assert.equal(ended,0);playlist.destroy();
 const next=new YouTubePlayerAdapter({replaceChildren(){}},{id:yt,platform:'YouTube'},{role:'workout',autoPlay:true,onEnded:()=>ended++});await next.load();callbacks.onReady({target:player});callbacks.onStateChange({data:0});assert.equal(ended,1);next.destroy();checks++;console.log('PASS native playlist cue, runtime auto-play and ended callback contract');console.log(`${checks} test groups passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});

