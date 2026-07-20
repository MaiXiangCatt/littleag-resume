---
name: vega-brainstorm
description: 将模糊需求通过必要澄清、方案比较和明确假设转化为可验收的设计文档，并接入 Vega Harness 的 brainstorm 阶段。用于活跃需求处于 `brainstorm`、用户要求头脑风暴/需求澄清/方案探索/功能设计，或 `vega next --json` 返回 `vega-brainstorm` 时；必须在技术设计、OpenSpec、任务拆解或任何实现之前使用。
---

# Vega 头脑风暴

基于 Superpowers brainstorming 流程，增加 Vega Harness 的状态读取、产物路径和阶段路由。

## 硬门禁

<HARD-GATE>
在 brainstorm 阶段不得编写业务实现代码、实现测试、OpenSpec、技术设计或任务清单，不得调用实现类 Skill，也不得执行任何实现动作。
</HARD-GATE>

需求看起来简单也不能跳过设计。简单需求可以缩短设计，但必须产出可验收的设计文档。

## 默认自主推进

- 默认先基于现有 PRD、仓库事实和合理假设生成完整 brainstorm 文档，自检通过后登记文档并推进阶段。
- 不把用户批准作为写文档或 `vega complete` 的前置条件；用户验收发生在产物生成和阶段推进之后。
- 只有关键输入缺失会导致需求方向明显错误、存在多个互斥业务目标且无法用假设表达、或用户明确要求先停下讨论时，才向用户提问。
- 所有未确认但不阻塞生成的判断都写入文档的“假设 / 开放项 / 验收关注点”，并在最终摘要中提示用户验收。

## 必读资料

开始执行前完整读取：

- [Superpowers 原始流程](references/superpower-brainstorm.md)
- 需要浏览器原型、布局对比或图表时，再读取 [视觉伴侣指南](references/visual-companion.md)
- 需要独立审查设计文档时，使用 [规格审查模板](references/spec-document-reviewer-prompt.md)

本文件对上游流程有以下覆盖，冲突时以本文件为准：

- 产物写入 `.vega-harness/docs/brainstorm-<requirement>.md`；
- 不自动 commit；
- 不进入 `writing-plans`，而是通过 `vega complete` 路由到 Vega 下一阶段；
- Full 流程不在 brainstorm 中替代后续 `vega-tech-design`；
- Lite 流程也只形成足够进入 OpenSpec 的设计，不编写实现计划。

## 输入与产出

输入：

- `vega requirement status --json` 返回的活跃需求状态；
- 状态中已关联的文档；
- `.vega-harness/docs/prd-<name>.md` 等确定性路径下的未关联文档；
- 相关仓库文档、代码和近期提交；
- 用户在对话中的补充与决策。

产出：

- 可供用户验收的 `.vega-harness/docs/brainstorm-<name>.md`；
- `documents.brainstorm` 指向 brainstorm 文档；
- 完成自检并输出验收关注点；
- `brainstorm` 阶段完成；
- Lite 路由到 `vega-openspec`，Full 路由到 `vega-tech-design`。

## 执行流程

为以下步骤建立任务清单并按顺序推进。不要把非阻塞验收点当作暂停关卡。

### 1. 恢复 Vega 上下文

执行：

```bash
vega requirement status --json
vega next --json
git log -n 5 --oneline
```

只有同时满足以下条件才继续：

- 需求状态为 `in_progress`；
- `current_phase` 为 `brainstorm`；
- 当前阶段状态为 `in_progress`；
- 下一 Skill 为 `vega-brainstorm`。

异常处理：

- 没有活跃需求：停止并使用 `vega-requirement-init`；
- 仍处于 `init`：停止并完成需求初始化；
- 当前阶段为 `failed`：遵循 `vega next --json` 的恢复路由；
- 已进入后续阶段：不要倒退或重复完成阶段，先向用户说明当前状态。

### 2. 探索项目与需求上下文

1. 读取状态 `documents` 中所有非空且与当前需求相关的路径。
2. 使用 CLI 明确查询关键产物：
   ```bash
   vega doc get prd --json
   vega doc get brainstorm --json
   ```
3. 优先读取 `doc get` 或状态字段返回的非空路径。若旧状态尚未关联文档，再兜底检查：
   - `.vega-harness/docs/prd-<name>.md`
   - `.vega-harness/docs/brainstorm-<name>.md`
4. 阅读与需求直接相关的设计文档、代码结构和仓库约束。
5. 判断是否为续写：
   - 已有 brainstorm 文档时，先核对文档内容与当前状态，继续未完成关卡；
   - 不要无条件覆盖已有决策。
6. 先评估范围。如果包含多个可独立交付的子系统，默认按最小可交付边界收敛，并把被排除范围写入非目标；只有边界无法判断时才询问用户。

### 3. 决定是否提供视觉伴侣

预计会讨论 UI 布局、交互原型、视觉对比、架构图等视觉问题时，优先用文本设计继续推进。只有用户明确要求视觉原型，或视觉差异无法用文字说明时，才单独发送以下邀请，不附带上下文摘要或其他问题：

> 接下来有些内容可能用浏览器中的原型、图表或并排对比更直观。要启用视觉伴侣吗？它需要打开一个本地 URL，并会增加一些 token 消耗。

等待用户回答。用户同意后再读取视觉伴侣指南并启动工具；用户拒绝则继续纯文本流程。后续仍需逐问题判断是否真的适合视觉展示。

### 4. 必要澄清与假设

先从已有输入中提取以下内容，能合理推断的直接写成“当前假设”，不要逐项打断用户：

- 要解决的问题与目标用户；
- 范围、非目标和本次交付边界；
- 关键用户流程与业务规则；
- 约束、依赖和兼容性要求；
- 成功标准和可验证的验收条件；
- 关键异常、边界情况与失败预期；
- 需要用户后验收的假设。

只有未知项会直接改变需求方向、导致不可逆实现投入，或无法通过“假设 / 开放项”安全承载时，才提问。提问时每条消息只问一个问题；能用 2-3 个互斥选项表达时优先选择题，并把推荐项放在前面。

### 5. 比较方案

需求足够稳定后，在文档中提出 2-3 个真正不同的方案：

- 先给推荐方案和理由；
- 说明各方案的收益、代价、风险和适用条件；
- 严格执行 YAGNI，不把“以后可能需要”当成本次范围；
- 默认采用推荐方案继续生成，除非用户已明确选择其他方案。

出现新歧义时优先写成假设和开放项；只有歧义足以使推荐方案无效时才暂停澄清。

### 6. 生成设计内容

根据复杂度组织设计内容，通常覆盖：

1. 目标、非目标和成功标准；
2. 用户流程与关键交互；
3. 方案边界、组件职责和数据流；
4. 业务规则、错误处理和边界情况；
5. 验收与测试策略。

Full 工作流在此阶段描述“需要什么”和关键边界，保留详细技术选型、接口/数据结构和实施细节给 `vega-tech-design`。Lite 工作流可以补充进入 OpenSpec 所需的明确约束，但仍不生成任务计划。

### 7. 写入设计文档

写入：

```text
.vega-harness/docs/brainstorm-<name>.md
```

至少包含：

```markdown
# <需求标题> Brainstorm

## 背景与问题
## 目标与非目标
## 用户与核心场景
## 已确认需求
## 方案比较与最终选择
## 设计说明
## 业务规则与边界情况
## 验收标准
## 风险、依赖与开放项
## 用户验收关注点
## 决策记录
```

要求：

- 明确区分已知事实、合理假设和开放项；开放项必须明确负责人或后续解决阶段；
- 验收标准可观察、可验证；
- 不包含实现任务清单；
- 不自动执行 `git commit`。

### 8. 审查并标出验收点

先自检并直接修复：

- `TODO`、`TBD`、占位符和未闭合章节；
- 章节矛盾或与选定方案不一致；
- 可被两种方式理解的关键需求；
- 超出单次后续阶段可承载的范围；
- 未经请求的功能和过度设计。

有子代理能力时，可使用规格审查模板做一次独立审查；没有时按同一标准自行审查。

然后在文档中补充“用户验收关注点”小节，列出最需要用户后验收的假设、范围边界和风险。不要等待用户明确批准才推进状态；用户要求修改时，后续可回到 brainstorm 修订文档并重新推进。

### 9. 关联文档、完成阶段并验证路由

自检通过后，通过 CLI 关联 brainstorm 文档：

```bash
vega doc set brainstorm .vega-harness/docs/brainstorm-<name>.md
vega doc get brainstorm --json
```

确认 `doc get` 返回的 `path` 与写入路径一致。不要直接修改需求 JSON。

然后执行：

```bash
vega complete
vega requirement status --json
vega next --json
```

验证：

- Lite：当前阶段为 `openspec`，下一 Skill 为 `vega-openspec`；
- Full：当前阶段为 `tech_design`，下一 Skill 为 `vega-tech-design`。

默认在报告路由结果后停止。只有用户明确要求连续推进整个流程时，才调用下一 Skill。

## 失败与中断

- 关键输入缺失且无法用假设承载：保持 `brainstorm` 为 `in_progress`，向用户提出最小必要问题。
- 文档写入或必要上下文读取失败：先尝试修复；确实阻塞时才执行 `vega fail --reason "<具体原因>"`。
- 不把“等待用户验收非阻塞产物”标记为 failed。
- 恢复时重新读取状态、近期提交和已有产物，从未完成关卡继续。

## 完成标准

全部满足后才报告完成：

- 需求边界、方案和验收标准已明确；
- 设计文档已生成、登记，并标出用户验收关注点；
- 文档通过完整性、一致性、范围和 YAGNI 检查；
- `documents.brainstorm` 已通过 `vega doc set brainstorm` 关联；
- 未生成实现代码、技术设计、OpenSpec 或任务计划；
- CLI 已把 brainstorm 推进到正确的下一阶段。
