# 无人机反制预警系统

基于Vue3和Cesium的无人机反制预警系统，用于监测和显示进入防空区域的无人机，并提供预警功能。

## 特点

- 基于Vue3和TypeScript开发
- 使用Cesium显示3D地图
- 实时显示无人机位置
- 支持设置反制雷达覆盖范围
- 入侵预警提醒
- WebSocket实时数据通信

## 安装与使用

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
npm install
npm run dev
```

## 项目结构

- `frontend/` - Vue3前端项目
  - `src/` - 源代码
    - `components/` - 组件
    - `views/` - 页面
    - `store/` - Pinia存储
    - `router/` - Vue Router
- `backend/` - Node.js后端项目
  - `src/` - 源代码
    - `index.js` - 主入口文件

## 功能

1. 显示3D地图
2. 添加反制雷达
3. 实时显示无人机位置
4. 检测无人机入侵并发出预警
5. 分辨危险和普通无人机 