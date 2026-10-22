# v4 自动分P更新与实际验证

更新日期：2026-10-21。直接修改现有v4，无新压缩包。原YouTube项目和Compatibility Lab未修改。

## 实现

粘贴可识别的BV、标准/手机/App链接后自动查询公开metadata；可展开的短链先展开再查询。多项导入时每项有自己的选择器。多个分P用原生下拉框显示“P编号 · part标题”；单P不显示选择器。带p链接默认保留其p。两个角色各自维护选择，播放页切换只重建对应的iframe，不取消Quick Timer。返回设置保留原始输入与选择，收藏和记录仍用包含p的规范链接区分source。

数据结构沿用现有字段：`platform: 'Bilibili'`、`id`、数字`p`、`sourceKey: bilibili:BVxxx:pN`、`originalUrl`，新增`videoTitle`、`pages: [{page,cid,title}]`、`metadataStatus`、成功时的`metadataEndpoint`。不把pages当作播放队列自动联播。

所有标题通过textContent显示。请求只读取基本metadata，`mode: cors`、`credentials: omit`，每个接口4.5秒超时；成功缓存10分钟，失败缓存30秒，相同BV并行查询合并。未添加Cookie、登录、视频流解析、第三方代理或权限绕过。

## 实际使用的接口

1. `https://api.bilibili.com/x/web-interface/view?bvid=BV1mB4y127g8`：读取`data.title`和`data.pages`。
2. 首接口不可用时尝试`https://api.bilibili.com/x/player/pagelist?bvid=BV1mB4y127g8`：读取`data`数组；无总标题时不编造标题。

现有av输入仍按aid查询。两个接口失败时不阻止B站播放，显示“暂时无法自动获取分P，可手动输入分P编号。”与原生数字输入。传入p继续有效。

iframe只构造官方播放器参数bvid（或aid）、p、autoplay、muted、danmaku，不传分享追踪参数，不传可能覆盖p的cid。[官方播放器文档](https://player.bilibili.com/)说明p从1计数，传cid时p不生效。

## 真实环境结果

测试视频：BV1mB4y127g8。

- 浏览器直接访问view接口：显示Bilibili“错误号412 / 安全风控策略拒绝”。
- 本地静态网页Origin `http://127.0.0.1:8773`，真实匿名浏览器fetch测试：view与pagelist均返回`TypeError: Failed to fetch`，没有可读取的JSON。请求使用`credentials: omit`，未使用用户Cookie。
- 跨域读取测试失败；仅凭TypeError不能进一步断定全部原因都是CORS头缺失，风控/网络也可能参与。没有采用no-cors读取（其opaque响应不能提供pages）。
- **该BV实际pages数据未取得。不能报告真实分P数量、cid、逐P标题正确，也没有将模拟列表冒充真实数据。**
- 正式v4已在同样环境显示手动备用，BV-only识别为P1，带p=2链接保留P2，能进入两个官方iframe。
- 官方iframe的p=1、p=2、p=3地址及独立重建已检查，P2与P3请求的播放器均可见视频时间持续推进（P2从约0.20秒至16.26秒，P3从约0.20秒至8.62秒，paused=false）。页面能看到“历史文化系列纪录片-《河西走廊》”。但没有真实pages/cid可核对，不能仅凭外链播放器加载或同一总标题判定其内容一定对应正确集数，因此P1/P2/后续P的逐集正确播放尚未全部验收。

## 界面与回归验证

使用明确标注“模拟数据”的测试服务器验证了成功分支，未将模拟数据写进正式网页或缓存为真实pages：

- 三个模拟分P完整显示标题；BV-only默认P1；带p=2默认P2。
- 锻炼选P3、娱乐选P2后，两个iframe分别含p=3与p=2。
- 娱乐切P1只替换娱乐iframe；锻炼iframe节点保持原节点；60秒Quick Timer继续递减。
- 交换画面与分屏不替换iframe、不丢分P。
- 返回设置保留BV输入、原始?p=2链接和当前选择。
- 单P模拟metadata隐藏分P选择器。
- 390px浏览器视口覆盖未实际生效（读取仍1280px），所以不声称完成真机或390px浏览器验收。新增控件已使用100%宽度、min-width:0、16px字号及手机单列CSS。

自动测试全部通过：原有parser/adapter、计时与音量恢复、收藏、运动记录、短链测试；新增pages.cjs与pages-controller.cjs覆盖metadata结构、标题、缺失标题、API/HTTP/CORS/超时失败、备用接口、并发缓存、独立选择、保存恢复、单P隐藏和过期异步响应不覆盖新输入。代码比对确认YouTube adapter、QuickTimer、音量duck、分屏尺寸与交换布局函数没有改动。

## GitHub Pages结论

前端文件可作为静态网页运行，失败备用方式不需要后端。但**无法确认自动全分P查询在GitHub Pages直接可用**：当前两个公开接口的匿名跨域读取已失败，部署到GitHub Pages不会自动解除B站的跨域/风控限制。没有提供或部署真实GitHub Pages测试站，因此未在github.io Origin实测，也不将本地测试冒充GitHub Pages验证。

若必须保证自动列表可靠可用，需要额外验证并提供允许跨域的metadata服务/受控后端；本次没有擅自添加服务或第三方代理。当前实现是“自动尝试，失败可继续手动使用”，不是已保证静态部署自动成功。

## 修改文件

parts.js（新增）、app.js、index.html、styles.css、library-ui.js、records-ui.js、tests/pages.cjs（新增）、tests/pages-controller.cjs（新增）、README.md、本文。
