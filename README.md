# 山居秋暝 · 诗境

王维《山居秋暝》的交互式 3D 体素山水。八句诗、八个镜头，共处于一片连续的雨后秋山。

## 本地运行

需要 Node.js 20.19+ 或 22.12+，以及 pnpm。

```sh
pnpm install
pnpm dev
```

打开终端显示的本地地址。

```sh
pnpm build
pnpm preview
```

构建结果位于 `dist/`，可部署到任意静态网站服务。

## GitHub Pages 部署

部署成功后的在线地址：[山居秋暝 · 诗境](https://echo-dm.github.io/mountain-dusk/)。

首次部署时，在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。

将代码推送到 `main` 分支后，部署工作流会使用 Node.js 24 和 pnpm 11.23.0 安装锁定依赖、构建并发布 `dist/`。也可以在 **Actions → Deploy to GitHub Pages → Run workflow** 中手动触发；进度与部署地址可在对应工作流中查看。

Vite 使用 `base: './'` 生成相对资源路径，支持 `/mountain-dusk/` 子目录部署。本地可用 `pnpm build` 和 `pnpm preview` 检查生产构建。

## 游览

- 点击任一句诗，镜头约用 2 秒飞往对应景观。
- 拖动环顾，滚轮缩放；手机支持拖动和双指缩放。
- “返回全景”回到山谷全貌；暂停按钮控制水面、舟行、人物等景物动画。
- 尊重系统的减少动态效果设置，默认暂停景物动画，并直接切换镜头。

## 实现

Vite、TypeScript、Three.js。地形、树木、竹林、人物、渔舟、山居与像素材质均由代码生成，没有外部模型、声音或后端依赖。字体优先使用 Noto Serif SC；字体服务不可用时使用系统宋体。

诗句和镜头配置在 `src/poem.ts`；景观与漫游逻辑在 `src/world.ts`。重复方块使用实例化绘制，手机降低绘制分辨率、植被数量和阴影分辨率。建议使用启用硬件加速、支持 WebGL 2 的现代浏览器。

浏览器检查结果见 [验收记录](docs/acceptance.md)。
