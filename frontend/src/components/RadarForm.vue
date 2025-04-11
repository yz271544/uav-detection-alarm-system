<template>
  <div class="radar-form-overlay">
    <div class="radar-form">
      <h2>添加雷达</h2>
      <div class="form-group">
        <label for="name">名称</label>
        <input type="text" id="name" v-model="radarData.name" placeholder="雷达名称">
      </div>
      <div class="form-group">
        <label for="latitude">纬度</label>
        <input type="number" id="latitude" v-model.number="radarData.latitude" step="0.000001" placeholder="纬度">
      </div>
      <div class="form-group">
        <label for="longitude">经度</label>
        <input type="number" id="longitude" v-model.number="radarData.longitude" step="0.000001" placeholder="经度">
      </div>
      <div class="form-group">
        <label for="altitude">高度(米)</label>
        <input type="number" id="altitude" v-model.number="radarData.altitude" placeholder="高度">
      </div>
      <div class="form-group">
        <label for="radius">覆盖半径(米)</label>
        <input type="number" id="radius" v-model.number="radarData.radius" placeholder="覆盖半径">
      </div>
      <div class="form-actions">
        <button @click="$emit('close')" class="cancel-btn">取消</button>
        <button @click="saveRadar" class="save-btn">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits(['close', 'save'])

const radarData = ref({
  name: '',
  latitude: 35.0,
  longitude: 105.0,
  altitude: 0,
  radius: 50000
})

function saveRadar() {
  if (!radarData.value.name) {
    alert('请填写雷达名称')
    return
  }
  
  console.log('保存雷达表单数据:', radarData.value)
  
  emit('save', {
    name: radarData.value.name,
    latitude: radarData.value.latitude,
    longitude: radarData.value.longitude,
    altitude: radarData.value.altitude,
    radius: radarData.value.radius
  })
  
  // 重置表单
  radarData.value = {
    name: '',
    latitude: 35.0,
    longitude: 105.0,
    altitude: 0,
    radius: 50000
  }
}
</script>

<style scoped>
.radar-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.radar-form {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

h2 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 20px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #2c3e50;
}

input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.cancel-btn, .save-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn {
  background-color: #e74c3c;
  color: white;
  margin-right: 10px;
}

.save-btn {
  background-color: #2ecc71;
  color: white;
}
</style> 