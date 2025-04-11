import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import VueCesium from 'vue-cesium'
import 'vue-cesium/dist/index.css'

// 引入Cesium资源
// import 'cesium/Build/Cesium/Widgets/widgets.css'

import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueCesium, {
  cesiumPath: 'https://unpkg.com/cesium/Build/Cesium/Cesium.js'
})

app.mount('#app')
