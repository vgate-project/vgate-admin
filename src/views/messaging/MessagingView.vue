<script setup lang="ts">
import { ref } from 'vue'
import AnnouncementsView from '@/views/announcements/AnnouncementsView.vue'
import EmailView from '@/views/email/EmailView.vue'
import TelegramView from '@/views/telegram/TelegramView.vue'

const activeTab = ref('announcements')
</script>

<template>
  <el-tabs v-model="activeTab">
    <el-tab-pane label="Announcements" name="announcements" lazy>
      <AnnouncementsView />
    </el-tab-pane>
    <el-tab-pane label="Email" name="email" lazy>
      <EmailView />
    </el-tab-pane>
    <el-tab-pane label="Telegram" name="telegram" lazy>
      <TelegramView />
    </el-tab-pane>
  </el-tabs>
</template>
