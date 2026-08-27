# License Decision

SideAsk 项目方已于 2026-08-27 选择 **MIT License**，仓库根目录的 `LICENSE` 为正式许可文本。

## Apache-2.0

- 宽松商用与修改。
- 包含明确专利授权和专利诉讼终止条款。
- 需要保留 License/NOTICE 等合规信息。
- 更适合希望把贡献者和使用者专利边界写清楚的项目。

## MIT

- 非常短，宽松商用与修改。
- 生态理解和合规成本最低。
- 没有 Apache-2.0 那样明确的专利条款。

## Decision

选择 MIT 的原因是文本短、生态认知度高、允许宽松商用与修改，适合当前零依赖的浏览器扩展 MVP。README、package metadata 和发布材料使用 SPDX identifier `MIT`。

后续新增第三方依赖或素材时，维护者仍需检查许可证兼容性并保留必要声明。
