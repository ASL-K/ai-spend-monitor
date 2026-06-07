# ai-spend-monitor

> 我 AI 套餐 49 元，这个月烧了多少？
> 100% 本地部署的个人 AI Token 成本仪表盘

## 状态

🚧 **开发中** —— v0.0.0 init scaffold

## 计划功能

- [ ] 反向代理：接 OpenAI 兼容请求，转发到真实 provider，记一条到 SQLite
- [ ] Web UI：单页仪表盘（本月已花 / 按 provider 拆 / 时间序列）
- [ ] CLI：`aism start` / `aism status` / `aism today` / `aism log`

## 开发

```bash
# 装依赖
npm install

# 跑测试
npm test

# 编译
npm run build

# 启动
npm start
# 或
.\run.bat
```

## License

MIT © 2026 ASL-K
