const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// 创建Express应用
const app = express();
app.use(cors());
app.use(express.json());

// 创建HTTP服务器
const server = http.createServer(app);

// 创建Socket.IO服务器
const io = new Server(server, {
  cors: {
    origin: "*", // 允许所有来源连接
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,         // 允许Engine.IO 3版本客户端
  transports: ['polling', 'websocket'],  // 允许polling回退
  pingTimeout: 60000,      // 增加ping超时
  pingInterval: 10000,     // 增加ping间隔
  connectTimeout: 30000,   // 增加连接超时
  maxHttpBufferSize: 1e8   // 增加缓冲区大小
});

// 存储无人机数据
const uavs = new Map();

// 雷达信息
const radar = {
  latitude: 37.761196,
  longitude: 112.531004,
  altitude: 200,
  radius: 2000 // 单位：米
};

// 模拟无人机数据生成
function generateRandomUAV() {
  // 在雷达范围内生成随机位置
  // 随机生成极坐标角度和距离
  const angle = Math.random() * 2 * Math.PI; // 0-2π的随机角度
  const distance = Math.random() * radar.radius; // 0-雷达半径的随机距离
  
  // 将极坐标转换为经纬度偏移量
  // 注意：这里假设1度经度约等于111km，但实际上经度的距离会随纬度变化
  // 在实际应用中可能需要更精确的计算
  const latOffset = (distance / 111000) * Math.cos(angle);
  const lonOffset = (distance / (111000 * Math.cos(radar.latitude * Math.PI / 180))) * Math.sin(angle);
  
  // 计算最终的经纬度
  const latitude = radar.latitude + latOffset;
  const longitude = radar.longitude + lonOffset;
  
  // 随机高度，在雷达高度上下波动
  const altitude = radar.altitude + (Math.random() - 0.5) * 100;
  
  // 随机判断是否为危险无人机(增加危险无人机概率)
  const isDangerous = Math.random() > 0.5;
  
  return {
    id: uuidv4(),
    latitude,
    longitude,
    altitude,
    timestamp: Date.now(),
    isDangerous
  };
}

// 更新无人机位置
function updateUAVPosition(uav) {
  // 随机小幅度移动
  const latDelta = (Math.random() - 0.5) * 0.005;
  const lonDelta = (Math.random() - 0.5) * 0.005;
  const altDelta = (Math.random() - 0.5) * 5;
  
  // 计算新位置
  let newLat = uav.latitude + latDelta;
  let newLon = uav.longitude + lonDelta;
  let newAlt = uav.altitude + altDelta;
  
  // 计算新位置到雷达中心的距离
  const distance = calculateDistance(
    newLat, newLon,
    radar.latitude, radar.longitude
  );
  
  // 如果超出雷达范围，则将方向反转（朝向雷达中心）
  if (distance > radar.radius) {
    // 计算从雷达中心到无人机的方向向量
    const dirLat = radar.latitude - newLat;
    const dirLon = radar.longitude - newLon;
    
    // 根据方向向量调整位置（向雷达中心移动）
    newLat = uav.latitude + (Math.random() * 0.002 * Math.sign(dirLat));
    newLon = uav.longitude + (Math.random() * 0.002 * Math.sign(dirLon));
  }
  
  // 更新无人机位置
  uav.latitude = newLat;
  uav.longitude = newLon;
  uav.altitude = newAlt;
  uav.timestamp = Date.now();
  
  // 随机改变危险状态（低概率）
  if (Math.random() > 0.95) {
    uav.isDangerous = !uav.isDangerous;
  }
  
  return uav;
}

// 计算两点之间的距离（米）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径，单位米
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 客户端连接事件
io.on('connection', (socket) => {
  console.log('客户端已连接:', socket.id);
  
  // 发送当前所有无人机数据
  for (const uav of uavs.values()) {
    socket.emit('uav-update', uav);
  }
  
  // 客户端断开连接
  socket.on('disconnect', () => {
    console.log('客户端已断开连接:', socket.id);
  });
});

// API路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uavCount: uavs.size });
});

// 初始化生成一些无人机
function initializeUAVs(count) {
  console.log(`初始化生成 ${count} 架无人机...`);
  for (let i = 0; i < count; i++) {
    const newUAV = generateRandomUAV();
    uavs.set(newUAV.id, newUAV);
    console.log(`初始化无人机: ${newUAV.id}, 危险状态: ${newUAV.isDangerous}`);
  }
}

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`服务器运行在: http://localhost:${PORT}`);
  
  // 服务器启动后初始化无人机
  initializeUAVs(5); // 初始生成5架无人机
});

// 定期添加新无人机（更高频率）
setInterval(() => {
  // 限制最大无人机数量为15
  if (uavs.size < 15 && Math.random() > 0.5) { // 增加生成概率
    const newUAV = generateRandomUAV();
    uavs.set(newUAV.id, newUAV);
    io.emit('uav-update', newUAV);
    console.log(`添加新无人机: ${newUAV.id}, 危险状态: ${newUAV.isDangerous}`);
  }
}, 3000); // 更高频率添加无人机

// 定期更新无人机位置
setInterval(() => {
  for (const [id, uav] of uavs.entries()) {
    const updatedUAV = updateUAVPosition(uav);
    io.emit('uav-update', updatedUAV);
    
    // 随机移除无人机（低概率）
    if (Math.random() > 0.97) { // 降低移除概率
      uavs.delete(id);
      io.emit('uav-remove', id);
      console.log(`移除无人机: ${id}`);
    }
  }
}, 2000); 