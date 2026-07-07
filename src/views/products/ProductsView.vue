<script setup lang="ts">
import { ref } from 'vue'
import PlansView from '@/views/products/PlansView.vue'
import TrafficPackagesView from '@/views/products/TrafficPackagesView.vue'

const activeTab = ref('plans')
</script>

<template>
  <el-tabs v-model="activeTab">
    <el-tab-pane label="Plans" name="plans">
      <PlansView />
    </el-tab-pane>
    <el-tab-pane label="Traffic Packages" name="traffic" lazy>
      <TrafficPackagesView />
    </el-tab-pane>
  </el-tabs>
</template>
