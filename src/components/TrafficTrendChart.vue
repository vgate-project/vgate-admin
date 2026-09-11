<script setup lang="ts">
// ECharts stacked-bar trend chart for the traffic page: upload over download
// per hour or per day bucket, with a legend to toggle each direction and an
// axis tooltip showing exact byte figures. Registered tree-shaken (echarts/core)
// to keep the bundle small.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { formatBytes } from '@/utils/format'
import type { BucketStat } from '@/types/wire'

echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  series: BucketStat[]
  bucket: 'hour' | 'day'
}>()

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

function axisLabel(iso: string): string {
  const d = new Date(iso)
  // Hour buckets cross days, so include the date; day buckets stay compact.
  return props.bucket === 'hour'
    ? d.toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function render() {
  if (!chart) return
  chart.setOption({
    animationDuration: 200,
    grid: { left: 8, right: 8, top: 34, bottom: 4, containLabel: true },
    legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 8, icon: 'roundRect' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = params as { dataIndex: number }[]
        const p = props.series[list[0]?.dataIndex ?? 0]
        if (!p) return ''
        const when = props.bucket === 'hour'
          ? new Date(p.bucket).toLocaleString()
          : new Date(p.bucket).toLocaleDateString()
        return [
          `<b>${when}</b>`,
          `Upload: ${formatBytes(p.up)}`,
          `Download: ${formatBytes(p.down)}`,
          `Total: ${formatBytes(p.up + p.down)}`,
        ].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: props.series.map((p) => axisLabel(p.bucket)),
      axisTick: { show: false },
      axisLabel: { hideOverlap: true, color: '#909399' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => formatBytes(v), color: '#909399' },
      splitLine: { lineStyle: { type: 'dashed', color: '#e4e7ed' } },
    },
    series: [
      {
        name: 'Upload',
        type: 'bar',
        stack: 'total',
        data: props.series.map((p) => p.up),
        itemStyle: { color: '#409eff' },
        barMaxWidth: 28,
      },
      {
        name: 'Download',
        type: 'bar',
        stack: 'total',
        data: props.series.map((p) => p.down),
        itemStyle: { color: '#67c23a', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 28,
      },
    ],
  })
}

// The chart div is v-if'd on data arriving, so init lazily after the DOM
// settles instead of only in onMounted.
async function ensure() {
  await nextTick()
  if (!el.value) return
  if (!chart) {
    chart = echarts.init(el.value)
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(el.value)
  }
  render()
}

watch(() => [props.series, props.bucket], ensure)
onMounted(ensure)
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div v-if="series.length" ref="el" class="trend-chart"></div>
  <el-empty v-else description="No traffic in this range" :image-size="60"/>
</template>

<style scoped>
.trend-chart {
  width: 100%;
  height: 280px;
}
</style>
