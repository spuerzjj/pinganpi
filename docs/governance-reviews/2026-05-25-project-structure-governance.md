# 2026-05-25 工程结构治理审查

## 背景

用户确认需要调整工程目录结构，让各个工程边界更清晰。此次治理属于架构 / 平台边界变化，按项目固定节奏需要形成治理记录，并同步 AGENTS、roadmap 和相关计划。

## 结论

- 采用分区式结构，不引入 npm workspace，根目录继续保留统一 `package.json` 和统一命令入口。
- 当前微信小程序主线移动到 `apps/miniprogram/`。
- 旧 Capacitor / Vue App、iOS、Android 和旧 Vite 配置归档到 `apps/legacy-capacitor/`；根目录 `capacitor.config.ts` 仅作为 Capacitor CLI 路由配置指向旧 App 归档路径。
- 共享领域真实实现移动到 `packages/domain/src/`。
- 服务端模块移动到 `services/`。
- 构建、部署、smoke、审计和开发者工具自动化脚本移动到 `tools/scripts/`。
- Roadmap Viewer 移动到 `tools/roadmap-viewer/`。
- 新增 `docs/project-structure.md` 作为工程结构边界说明。
- 新增 `npm run structure:audit` 防止目录边界回退。

## 目录边界

| 路径 | 定位 |
| --- | --- |
| `apps/miniprogram/` | 微信小程序主线 |
| `apps/legacy-capacitor/` | 旧 App 归档与回归参考 |
| `packages/domain/src/` | 领域规则唯一真实实现 |
| `apps/miniprogram/shared/domain/` | 小程序根内领域副本 |
| `services/miniprogram-functions/` | 小程序 CloudBase event 函数入口 |
| `services/account-pair/` | 账号与双人关系服务 |
| `services/ai-scribe-proxy/` | AI 起稿服务 |
| `services/sync-proxy/` | 同步服务 |
| `tools/scripts/` | 自动化脚本 |
| `tools/roadmap-viewer/` | Roadmap 可视化工具 |

## 测试策略调整

- 常规验证增加 `npm run structure:audit`。
- 小程序检查继续使用 `npm run miniprogram:check`，其内部仍包含共享领域副本一致性检查。
- Roadmap Viewer 验证路径改为 `npm test -- tools/roadmap-viewer/src/roadmap.test.ts` 和 `npm run roadmap:build`。
- 旧 App 验证命令仍保留：`npm run typecheck`、`npm run build`、`npm run cap:sync`、`npm run cap:doctor`。
- 微信开发者工具打开路径改为 `apps/miniprogram/`，自动化脚本已随 `tools/scripts/` 迁移。

## 本次验证

- `npm run structure:audit`：通过。
- `npm test`：通过，59 个测试文件，395 个测试通过。
- `npm run miniprogram:check`：通过。
- `npm run typecheck`：通过。
- `npm run cap:sync`：通过，已按根 `capacitor.config.ts` 路由同步旧 App Android / iOS assets。
- `npm run cap:doctor`：通过。
- `npm run roadmap:build`：通过。
- `npm run cloudbase:build:miniprogram`：通过。
- `git diff --check`：通过。

## 风险

- 大规模 rename 会影响历史文档中的旧路径。当前只要求 AGENTS、roadmap、阶段 27 计划、协作规则和结构文档保持最新；历史实施计划可按当时路径理解。
- 旧 App 仍被服务端同步测试复用其模型类型，因此暂不删除 `apps/legacy-capacitor/`。
- 旧 App build / cap sync 仍有验证价值，但不再是新功能默认目标。

## 后续要求

- 后续任何新任务先读 `docs/project-structure.md`。
- 新增目录或迁移边界时必须更新 `npm run structure:audit`。
- 阶段 27 应按新路径执行，不再使用旧根目录 `miniprogram/`、`server/`、`scripts/` 或 `roadmap-viewer/`。
