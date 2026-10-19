# NOVA Clinical White Toothpaste

可编辑的 NOVA landing page，桌面约两屏，移动端自适应。无需安装依赖或构建。

## 页面与文件

解压整个文件夹后，打开 `index.html` 可浏览。`index.html` 编辑文字与价格；`styles.css` 编辑布局、配色和间距；`app.js` 负责交互；`tracking.js` 提供现有 DICE 兼容接口。两张产品原图均为 **1536 × 1024**，位于 `assets/`，未采用截图裁切或插值放大。

- Shop Now 滚动到购买区。
- Add to Bag 仅首次有效，更新为 Added to Bag ✓ 和 Bag (1)，不跳转、不自动展开购物袋。
- Bag 显示空袋或已添加商品、数量 1 和 AUD 6.00 小计。
- 购物袋通过 Close、Continue browsing、点击外侧或 Escape 收起。
- feature 第二项为 Fresh Breath；包装图片仍保留原有 24h FRESH 印字。
- 页面保留品牌页脚，无页面级 X、Return to study、How to use 或 Explore the toothpaste。

## 当前 DICE 接入方式

**现有 DICE 使用同源本地副本。** Feed 中的 NOVA 公开链接会被现有 `nova_landing.js` 拦截，实际加载 DICE 的 `/static/nova/index.html`，并追加本次访问参数。因此，发布 GitHub Pages 与更新本地 DICE 副本是两个步骤；不能只更新公开网站而保留旧副本。

部署到 DICE 时，将 `index.html`、`styles.css`、`app.js`、`tracking.js` 和 `assets/` 放入 DICE 的 `_static/nova/`。不要删除 `tracking.js`，不要改变以下接口或事件名称。现有后台、数据列和参与者数据库无需变更。

**不要把现有宿主的 `data-landing-url` 直接改成跨域 GitHub Pages URL。** 当前宿主同步读取 iframe 内的 `NOVAStudy`，只能用于同源页面。GitHub Pages 是公开预览与广告目标链接；当前 DICE 会加载其同源副本。若将来需要直接跨域嵌入，必须另行修改宿主握手、来源校验和关闭保存流程。

## DICE 固定接口

```js
window.NOVAStudy.activate();      // iframe 加载并显示后开始计时，返回累计快照
window.NOVAStudy.snapshot();      // 返回当前累计快照
window.NOVAStudy.finish(reason);  // 冻结最终快照；重复调用不会重复关闭或增加时间
window.NOVAStudy.download();      // 可选人工调试导出
```

DICE 传入的查询参数包括 `embed=dice`、`visit_id`、`click_at`、`pid`、`session`、`condition`、`ad_id`。访问身份及版本由宿主和后台管理，页面不会自行覆盖。

页面消息沿用原格式：

```js
{ type: 'nova-snapshot', snapshot: { /* cumulative visit */ } }
{ type: 'nova-close', reason: 'escape' }
```

累计快照包含 `visit_id`、`active_ms`、`wall_ms`、`details_ms`、`shop_ms`、`closed`、`events`。每条事件包含 `seq`、`type`、`elapsed_ms`、`at`，必要时附加 `reason` 或 `location`。

DICE 兼容事件：`ad_click`、`landing_view`、`shop_now_click`、`add_to_bag`、`bag_open`、`landing_close`、`page_exit`。其中 **加购事件是 `add_to_bag`**，不是 `add_to_bag_click`；访问事件是 **`landing_view`**，不是 `landing_page_view`。

只在 `activate()` 后记录 DICE 访问并累计停留；切换后台暂停。details/shop 沿用至少 50% 区域可见的门槛并排除固定导航遮挡。购物袋打开时暂停底层区块停留，整体页面停留仍继续。关闭时同步返回最终快照并冻结累计值，避免丢失最后一段停留或重复关闭。

Esc 优先关闭购物袋；没有打开的购物袋时发送原有 `nova-close`，让 DICE 宿主保存并关闭 overlay。DICE 外层返回按钮也通过 `finish()` 完成保存。

## 其他嵌入示例与诊断事件

`preview.html` / `preview.js` 是独立的通用 iframe 示例，并不是 DICE 生产宿主。通过 HTTP/HTTPS 打开可演示隐藏、恢复与保留滚动位置。示例外层的 Back 不属于品牌页面。

`window.NOVA`、`nova:event` CustomEvent 和带有 `source: 'nova-toothpaste'` 的 `nova:event` 消息保留用于通用嵌入或 UI 诊断。这里的 `add_to_bag_visible`、`bag_close` 等扩展事件不会写入 DICE 原有事件列表，以免触发后台白名单校验失败。几何可见性不是注意力或阅读证明。

需要指定宿主来源时，可在加载脚本前设置 `window.NOVA_CONFIG.parentOrigin`。默认从 referrer 推断，再回退到同源；不使用通配符。静态站点自身不向分析服务发送数据、不保存参与者数据、不使用 cookies 或 localStorage；DICE 宿主负责保存及重试队列。

## 验证

见 `VALIDATION.md`。测试使用现有 DICE 宿主脚本与后台 `ingest` / `export_summary` 函数，在隔离内存环境进行，没有使用真实参与者名额或修改研究数据。
