'use strict';
const assert=require('node:assert/strict'),P=require('../parts.js'),C=require('../app.js');
// Synthetic metadata tests exercise behavior; these are not a real BV response.
const pages=[{page:1,cid:101,part:'第一集'},{page:2,cid:102,part:'第二集'},{page:3,cid:103,part:''}];
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
(async()=>{
 const video=C.parseVideo('https://www.bilibili.com/video/BV1mB4y127g8/?p=2');let calls=0;
 const loader=P.createLoader(async(url,options)=>{calls++;assert.equal(new URL(url).searchParams.get('bvid'),video.id);assert.equal(options.credentials,'omit');assert.equal(options.mode,'cors');return response({code:0,data:{title:'测试标题',pages}});});
 const [workout,entertainment]=await Promise.all([loader({...video,p:1}),loader(video)]);
 assert.equal(calls,1);assert.equal(workout.p,1);assert.equal(entertainment.p,2);assert.equal(workout.pages.length,3);assert.equal(workout.pages[1].title,'第二集');assert.equal(workout.pages[2].title,'');
 const third=P.selectPage(C,entertainment,3);assert.equal(third.p,3);assert.equal(entertainment.p,2);assert.equal(workout.p,1);assert.equal(third.sourceKey,'bilibili:BV1mB4y127g8:p3');assert.equal(third.originalUrl,video.originalUrl);assert.equal(third.title,'测试标题 · P3');assert.equal(new URL(C.bilibiliURL(third,true)).searchParams.get('p'),'3');
 const selected=P.selectPage(C,entertainment,2);assert.equal(selected.title,'测试标题 · 第二集');
 for(const invalid of ['0','-1','1.5','1e2','',9007199254740992])assert.throws(()=>P.selectPage(C,video,invalid));
 let attempts=[];const alternate=P.createLoader(async url=>{attempts.push(url);return url.includes('web-interface')?response({},412):response({code:0,data:pages});});
 const fallbackEndpoint=await alternate(video);assert.equal(attempts.length,2);assert.equal(fallbackEndpoint.pages.length,3);assert.equal(fallbackEndpoint.videoTitle,'');assert.equal(fallbackEndpoint.metadataEndpoint,P.endpoints[1]);
 const fail=P.createLoader(async()=>{throw TypeError('Failed to fetch');});const failed=await fail(video);assert.equal(failed.metadataStatus,'failed');assert.deepEqual(failed.pages,[]);assert.equal(failed.p,2);assert.equal(P.selectPage(C,failed,7).p,7);
 const denied=await P.createLoader(async()=>response({code:-403}))(video);assert.equal(denied.metadataStatus,'failed');
 const timed=await P.createLoader((_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout')))),1)(video);assert.equal(timed.metadataStatus,'failed');
 const yt=C.parseVideo('https://youtu.be/M7lc1UVf-VE');assert.equal(await P.createLoader(()=>assert.fail('YouTube must not fetch B metadata'))(yt),yt);
 for(const data of [{code:0,data:{pages:[]}},{code:0,data:{pages:[{page:0,cid:1}]}},{code:0,data:{pages:[{page:1,cid:1},{page:1,cid:2}]}}])assert.throws(()=>P.readMetadata(data));
 console.log('PASS metadata parsing/titles, all pages, P2 default, independent selection/identity, credential-free requests, inflight cache, alternate endpoint, CORS/HTTP/API/timeout failure, manual fallback and untouched YouTube.');
})().catch(e=>{console.error(e);process.exitCode=1;});
