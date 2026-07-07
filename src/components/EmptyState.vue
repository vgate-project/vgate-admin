<script setup lang="ts">
const props = defineProps<{ description?: string }>()
</script>

<template>
  <el-empty :description="props.description ?? 'No data'" />
</template>
