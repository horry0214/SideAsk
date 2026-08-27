# SideAsk 隐私说明

SideAsk v0.2.5 是 local-first 浏览器扩展，没有账户、遥测、广告 SDK 或云数据库。

## 本地保存

- Provider 配置与 API Key。
- Learning Session / Branch、消息、Anchor。
- Knowledge Item、Weakness Item 和理解状态。

这些数据保存在浏览器扩展私有 IndexedDB。旧 `sideaskHistory` 只用于一次性非破坏迁移。

## 发送给 Provider

- 用户主动选择的文本。
- 当前可读块和少量前后内容。
- 当前支线最近消息。
- 去除 username/password/query/hash 的来源 URL。

## 默认排除

密码字段、input、textarea、select、contenteditable、textbox、显式 private/sensitive 节点、脚本/样式、整页浏览记录和其它对话历史。

Provider 可在管理页逐条删除。移除 SideAsk 浏览器扩展会清除该扩展的本地存储。
