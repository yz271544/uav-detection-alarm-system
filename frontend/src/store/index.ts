import { defineStore } from 'pinia'
import { ref } from 'vue'

// 无人机数据接口
export interface UAV {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number;
  isDangerous: boolean;
}

// 雷达数据接口
export interface Radar {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  radius: number; // 雷达覆盖半径（米）
}

// 无人机数据存储
export const useUavStore = defineStore('uav', () => {
  // 无人机列表
  const uavs = ref<UAV[]>([])

  // 添加或更新无人机
  function updateUav(uav: UAV) {
    console.log('store更新无人机:', uav)
    const index = uavs.value.findIndex(item => item.id === uav.id)
    if (index > -1) {
      // 更新
      uavs.value[index] = uav
    } else {
      // 添加
      uavs.value.push(uav)
    }
  }

  // 移除无人机
  function removeUav(id: string) {
    console.log('store移除无人机:', id)
    const index = uavs.value.findIndex(item => item.id === id)
    if (index > -1) {
      uavs.value.splice(index, 1)
    }
  }

  return { uavs, updateUav, removeUav }
})

// 雷达数据存储
export const useRadarStore = defineStore('radar', () => {
  // 雷达列表
  const radars = ref<Radar[]>([])

  // 添加雷达
  function addRadar(radar: Radar) {
    console.log('store添加雷达:', radar)
    radars.value.push(radar)
  }

  // 更新雷达
  function updateRadar(radar: Radar) {
    console.log('store更新雷达:', radar)
    const index = radars.value.findIndex(item => item.id === radar.id)
    if (index > -1) {
      radars.value[index] = radar
    }
  }

  // 删除雷达
  function removeRadar(id: string) {
    console.log('store删除雷达:', id)
    const index = radars.value.findIndex(item => item.id === id)
    if (index > -1) {
      radars.value.splice(index, 1)
    }
  }

  return { radars, addRadar, updateRadar, removeRadar }
}) 