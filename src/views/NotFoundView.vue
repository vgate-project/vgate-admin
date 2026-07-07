<script setup lang="ts"></script>
<template>
  <div class="not-found">
    <h1>404</h1>
    <p>Page not found.</p>
    <el-button type="primary" @click="$router.push('/dashboard')">Back to Dashboard</el-button>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12px;
}
</style>
