<template>
  <div class="cesium-container">
    <div ref="cesiumContainer" class="cesium-viewer"></div>
    <div class="left-controls">
      <button @click="addRadar" class="map-btn">添加雷达</button>
      <div class="status-info">
        <span>连接状态: {{ isConnected ? '已连接' : '未连接' }}</span>
        <span>无人机数量: {{ uavStore.uavs.length }}</span>
        <div class="backend-switch">
          <span>后端: {{ useRustBackend ? 'Rust' : 'Node.js' }}</span>
          <button @click="switchBackend" class="switch-btn">切换到 {{ useRustBackend ? 'Node.js' : 'Rust' }}</button>
        </div>
      </div>
      <div v-if="alertMessage" class="alert-popup">
        <div class="alert-popup-content">
          <div class="alert-icon">⚠️</div>
          <div class="alert-text">{{ alertMessage }}</div>
        </div>
      </div>
    </div>
    <RadarForm v-if="showRadarForm" @close="showRadarForm = false" @save="saveRadar" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as Cesium from 'cesium'
import { useUavStore, useRadarStore } from '../store'
import RadarForm from './RadarForm.vue'
import { io } from 'socket.io-client'
import { createRustSocketClient } from '../utils/rust-backend-adapter'

// Cesium相关
const cesiumContainer = ref<HTMLElement | null>(null)
let viewer: Cesium.Viewer | null = null
let uavEntities: Record<string, Cesium.Entity> = {}
let radarEntities: Record<string, Cesium.Entity> = {}

// 表单控制
const showRadarForm = ref(false)
const alertMessage = ref('')
const isConnected = ref(false)
const useRustBackend = ref(false) // 是否使用Rust后端

// 告警信息自动消失定时器
let alertTimer: number | null = null

// 存储
const uavStore = useUavStore()
const radarStore = useRadarStore()

// WebSocket连接
let socket: any = null

onMounted(() => {
  console.log('CesiumMap组件已挂载')
  setTimeout(() => {
    initCesium()
    initSocket()
  }, 500)
})

onUnmounted(() => {
  console.log('CesiumMap组件已卸载')
  if (socket) {
    socket.disconnect()
  }
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
  clearAlertTimer()
})

// 监视告警信息变化
watch(alertMessage, (newVal) => {
  if (newVal) {
    clearAlertTimer()
    // 设置8秒后自动清除告警信息
    alertTimer = window.setTimeout(() => {
      alertMessage.value = ''
    }, 8000)
  }
})

function clearAlertTimer() {
  if (alertTimer) {
    clearTimeout(alertTimer)
    alertTimer = null
  }
}

function initCesium() {
  if (!cesiumContainer.value) {
    console.error('cesiumContainer不存在')
    return
  }
  
  console.log('初始化Cesium地图')
  try {
    // 创建Cesium查看器
    viewer = new Cesium.Viewer(cesiumContainer.value, {
      baseLayerPicker: true,
      geocoder: true,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: true,
      animation: false,
      timeline: false,
      fullscreenButton: true
    })
    
    // 设置初始位置（中国中心）
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(105.0, 35.0, 10000000.0)
    })
    
    // 绘制雷达
    updateRadars()
    
    console.log('Cesium地图初始化完成')
  } catch (error) {
    console.error('Cesium初始化失败:', error)
  }
}

function initSocket() {
  console.log('初始化WebSocket连接')
  try {
    // 根据设置选择后端
    if (useRustBackend.value) {
      console.log('使用Rust后端')
      socket = createRustSocketClient();
    } else {
      console.log('使用Node.js后端')
      socket = io('/', {
        path: '/socket.io',
        transports: ['websocket'], 
        reconnection: true,
        reconnectionAttempts: 10,   // 增加重连次数
        reconnectionDelay: 1000,   
        timeout: 10000,            // 增加连接超时时间
        autoConnect: true
      });
    }
    
    socket.on('connect', () => {
      console.log('已连接到后端服务器，连接ID:', socket.id || 'Rust客户端')
      isConnected.value = true
    })
    
    socket.on('connect_error', (error) => {
      console.error('连接错误:', error.message || error)
      isConnected.value = false
    })
    
    socket.on('disconnect', () => {
      console.log('与服务器断开连接')
      isConnected.value = false
    })
    
    socket.on('uav-update', (data: any) => {
      console.log('收到无人机更新:', data, '危险状态:', data.isDangerous, '原始dangerous:', (data as any).is_dangerous)
      uavStore.updateUav(data)
      updateUavEntities()
      checkUavInRadarRange(data)
    })
    
    socket.on('uav-remove', (id: string) => {
      console.log('收到无人机移除:', id)
      uavStore.removeUav(id)
      removeUavEntity(id)
    })
  } catch (error) {
    console.error('WebSocket连接失败:', error)
  }
}

function updateUavEntities() {
  if (!viewer) {
    console.error('Viewer不存在，无法更新无人机实体')
    return
  }
  
  console.log('更新无人机实体，当前数量:', uavStore.uavs.length)
  uavStore.uavs.forEach(uav => {
    if (!uavEntities[uav.id] && viewer) {
      console.log('创建无人机实体:', uav.id)
      // 创建无人机实体
      uavEntities[uav.id] = viewer.entities.add({
        id: uav.id,
        position: Cesium.Cartesian3.fromDegrees(uav.longitude, uav.latitude, uav.altitude),
        point: {
          pixelSize: 10,
          color: uav.isDangerous ? Cesium.Color.RED : Cesium.Color.GREEN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        },
        label: {
          text: `无人机 ${uav.id.substring(0, 6)}`,
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          showBackground: true,
          backgroundColor: uav.isDangerous 
            ? new Cesium.Color(1, 0, 0, 0.7) 
            : new Cesium.Color(0, 0.5, 0, 0.7)
        },
        path: {
          show: true,
          leadTime: 0,
          trailTime: 60,
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: uav.isDangerous 
              ? Cesium.Color.RED 
              : Cesium.Color.GREEN
          })
        }
      })
    } else if (uavEntities[uav.id] && viewer) {
      // 更新无人机位置
      const position = Cesium.Cartesian3.fromDegrees(uav.longitude, uav.latitude, uav.altitude)
      const entity = uavEntities[uav.id]
      
      entity.position = new Cesium.ConstantPositionProperty(position)
      
      if (entity.point) {
        const point = entity.point as Cesium.PointGraphics;
        point.color = new Cesium.ConstantProperty(
          uav.isDangerous ? Cesium.Color.RED : Cesium.Color.GREEN
        );
      }
      
      if (entity.label) {
        const label = entity.label as Cesium.LabelGraphics
        label.backgroundColor = new Cesium.ConstantProperty(
          uav.isDangerous 
            ? new Cesium.Color(1, 0, 0, 0.7) 
            : new Cesium.Color(0, 0.5, 0, 0.7)
        )
      }
      
      if (entity.path && entity.path.material) {
        const material = entity.path.material as Cesium.PolylineGlowMaterialProperty
        material.color = new Cesium.ConstantProperty(
          uav.isDangerous ? Cesium.Color.RED : Cesium.Color.GREEN
        )
      }
    }
  })
}

function removeUavEntity(id: string) {
  if (viewer && uavEntities[id]) {
    viewer.entities.remove(uavEntities[id])
    delete uavEntities[id]
  }
}

function updateRadars() {
  if (!viewer) return
  
  // 清除现有雷达实体
  Object.values(radarEntities).forEach(entity => {
    viewer?.entities.remove(entity)
  })
  radarEntities = {}
  
  // 添加雷达实体
  radarStore.radars.forEach(radar => {
    if (viewer) {
      // 雷达中心点
      radarEntities[radar.id] = viewer.entities.add({
        id: `radar-${radar.id}`,
        position: Cesium.Cartesian3.fromDegrees(radar.longitude, radar.latitude, radar.altitude),
        point: {
          pixelSize: 12,
          color: Cesium.Color.BLUE,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        },
        label: {
          text: radar.name,
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -40)
        },
        // 雷达覆盖范围
        ellipse: {
          semiMinorAxis: radar.radius,
          semiMajorAxis: radar.radius,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.BLUE.withAlpha(0.2)
          ),
          outline: true,
          outlineColor: Cesium.Color.BLUE,
          outlineWidth: 2,
          height: 0
        }
      })
    }
  })
}

function checkUavInRadarRange(uav: any) {
  radarStore.radars.forEach(radar => {
    // 计算无人机与雷达的距离
    const distance = calculateDistance(
      uav.latitude, uav.longitude,
      radar.latitude, radar.longitude
    )
    
    // 如果无人机在雷达范围内且标记为危险
    if (distance <= radar.radius && uav.isDangerous) {
      // 设置告警信息，会自动触发watch
      alertMessage.value = `危险无人机 ${uav.id.substring(0, 6)} 已进入 ${radar.name} 雷达范围!`
    }
  })
}

// 使用Haversine公式计算两点之间的距离（米）
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // 地球半径，单位米
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// 添加雷达
function addRadar() {
  console.log('点击添加雷达按钮')
  showRadarForm.value = true
}

// 保存雷达
function saveRadar(radar: any) {
  console.log('保存雷达数据:', radar)
  radarStore.addRadar({
    id: `radar-${Date.now()}`,
    ...radar
  })
  showRadarForm.value = false
  updateRadars()
}

function switchBackend() {
  if (socket) {
    socket.disconnect();
  }
  useRustBackend.value = !useRustBackend.value;
  initSocket();
}
</script>

<style scoped>
.cesium-container {
  width: 100%;
  height: 100vh;
  position: relative;
}

.cesium-viewer {
  width: 100%;
  height: 100%;
}

.left-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.map-btn {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.map-btn:hover {
  background-color: #2980b9;
}

.status-info {
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.backend-switch {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  gap: 5px;
}

.switch-btn {
  background-color: #27ae60;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.switch-btn:hover {
  background-color: #2ecc71;
}

.alert-popup {
  margin-top: 10px;
  animation: fadeInOut 8s ease-in-out;
  max-width: 300px;
}

.alert-popup-content {
  background-color: rgba(231, 76, 60, 0.9);
  color: white;
  padding: 12px;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-icon {
  font-size: 24px;
}

.alert-text {
  font-size: 14px;
  line-height: 1.4;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-10px); }
  10% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

.close-btn {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.close-btn:hover {
  background-color: #c0392b;
}
</style> 