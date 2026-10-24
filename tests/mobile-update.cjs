'use strict';
const assert=require('node:assert/strict'),C=require('../app.js');
(async()=>{
 for(const input of ['【标题】b23.tv/abcdef','【标题】https://b23.tv/abcdef','【标题】https://www.bilibili.com/video/BV1kts5zoErK/','视频号：BV1kts5zoErK','bilibili://video/170001','https://player.bilibili.com/player.html?bvid=BV1kts5zoErK','https://m.bilibili.com/video/BV1kts5zoErK'])assert.equal(C.parseImport(input)[0].platform,'Bilibili');
 const short=C.parseImport('【标题】b23.tv/abcdef')[0];assert.equal(short.originalUrl,'b23.tv/abcdef');let called=0;
 const resolved=await C.resolveVideo(short,async(url,options)=>{called++;assert.equal(options.credentials,'omit');return {url:'https://www.bilibili.com/video/BV1kts5zoErK/'};});assert.equal(resolved.id,'BV1kts5zoErK');assert.equal(resolved.title,'标题');assert.equal(called,1);
 await C.resolveVideo(short,()=>{throw Error('cache should prevent request')});
 const partLink='https://www.bilibili.com/video/BV1kts5zoErK/?vd_source=x&p=7&t=120';const partShort=C.parseVideo('https://b23.tv/multipart');const part=await C.resolveVideo(partShort,async()=>({url:partLink}));assert.equal(part.p,7);assert.equal(part.originalUrl,partShort.originalUrl);assert.equal(part.resolvedUrl,partLink);assert.equal((await C.resolveVideo(partShort,()=>{throw Error('cache')})).p,7);
 for(const input of ['bilibili://video/BV1kts5zoErK?p=7','bilibili://video/170001?p=7','https://player.bilibili.com/player.html?bvid=BV1kts5zoErK&p=7']){const v=C.parseVideo(input);assert.equal(v.p,7);assert.equal(v.originalUrl,input);assert(v.sourceKey.endsWith(':p7'));}
 const other=C.parseVideo('https://b23.tv/blocked');await assert.rejects(()=>C.resolveVideo(other,async()=>{throw Error('CORS')}),error=>error.shortUrl==='https://b23.tv/blocked');
 await assert.rejects(()=>C.resolveVideo(C.parseVideo('https://b23.tv/badredirect'),async()=>({url:'https://unrelated.test/'})),/请打开短链/);
 assert.equal(new URL(C.bilibiliURL({id:'BV1kts5zoErK'},true)).searchParams.get('muted'),'1');
 console.log('PASS: app/share/BV/av/mobile/player URL recognition, short-link redirect/cache/failure metadata, and initial mute parameter. Redirects use a test double; real-browser CORS remains device-dependent.');
})().catch(error=>{console.error(error);process.exitCode=1;});
