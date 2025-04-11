<template>
  <div class="cesium-container">
    <div ref="cesiumContainer" class="cesium-viewer"></div>
    <div class="left-controls">
      <button @click="addRadar" class="map-btn">添加雷达</button>
      <div class="status-info">
        <span>连接状态: {{ isConnected ? '已连接' : '未连接' }}</span>
        <span>无人机数量: {{ uavStore.uavs.length }}</span>
      </div>
    </div>
    <RadarForm v-if="showRadarForm" @close="showRadarForm = false" @save="saveRadar" />
    <div v-if="alertMessage" class="alert-message">
      <div class="alert-content">
        <h3>预警通知</h3>
        <p>{{ alertMessage }}</p>
        <button @click="alertMessage = ''" class="close-btn">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import { useUavStore, useRadarStore } from '../store'
import RadarForm from './RadarForm.vue'
import { io } from 'socket.io-client'

// Cesium相关
const cesiumContainer = ref<HTMLElement | null>(null)
let viewer: Cesium.Viewer | null = null
let uavEntities: Record<string, Cesium.Entity> = {}
let radarEntities: Record<string, Cesium.Entity> = {}

// 表单控制
const showRadarForm = ref(false)
const alertMessage = ref('')
const isConnected = ref(false)

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
})

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
    // 使用更详细的连接选项
    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket'], 
      reconnection: true,
      reconnectionAttempts: 10,   // 增加重连次数
      reconnectionDelay: 1000,   
      timeout: 10000,            // 增加连接超时时间
      autoConnect: true
    });
    
    socket.on('connect', () => {
      console.log('已连接到后端服务器，连接ID:', socket.id)
      isConnected.value = true
    })
    
    socket.on('connect_error', (error) => {
      console.error('连接错误:', error.message)
      isConnected.value = false
    })
    
    socket.on('disconnect', () => {
      console.log('与服务器断开连接')
      isConnected.value = false
    })
    
    socket.on('uav-update', (data: any) => {
      console.log('收到无人机更新:', data)
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
</script>

<style scoped>
.cesium-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.cesium-viewer {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.left-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.right-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-info {
  background-color: rgba(255, 255, 255, 0.8);
  padding: 8px;
  border-radius: 4px;
  font-size: 14px;
  display: flex;
  flex-direction: column;
}

.map-btn {
  background-color: #2c3e50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.map-btn:hover {
  background-color: #1e2b3a;
}

.alert-message {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.alert-content {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  width: 100%;
}

.alert-content h3 {
  color: #e74c3c;
  margin-top: 0;
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
</style> 