<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import {
  Connection,
  ChatDotRound,
  DataLine,
  Expand,
  Fold,
  Goods,
  Odometer,
  Promotion,
  Setting,
  Ticket,
  Tickets,
  User,
  UserFilled
} from "@element-plus/icons-vue";

const auth = useAuthStore()
const app = useAppStore()
const route = useRoute()
const router = useRouter()

function onLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <el-container class="layout">
    <el-aside :width="app.sidebarCollapsed ? '64px' : '220px'" class="aside">
      <div class="brand" @click="router.push('/dashboard')">
        {{ app.sidebarCollapsed ? 'V' : 'VGate' }}
      </div>
      <el-menu
        mode="vertical"
        :collapse="app.sidebarCollapsed"
        :collapse-transition="false"
        router
        :default-active="route.path"
        class="nav"
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <template #title>Dashboard</template>
        </el-menu-item>
        <el-menu-item index="/nodes">
          <el-icon><Connection /></el-icon>
          <template #title>Nodes</template>
        </el-menu-item>
        <el-menu-item index="/traffic">
          <el-icon><DataLine /></el-icon>
          <template #title>Traffic</template>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <template #title>Users</template>
        </el-menu-item>
        <el-menu-item index="/invites">
          <el-icon><Promotion /></el-icon>
          <template #title>Invite Codes</template>
        </el-menu-item>
        <el-menu-item index="/redemption-codes">
          <el-icon><Ticket /></el-icon>
          <template #title>Redemption Codes</template>
        </el-menu-item>
        <el-menu-item v-if="auth.isSuperAdmin" index="/admins">
          <el-icon><UserFilled /></el-icon>
          <template #title>Admins</template>
        </el-menu-item>
        <el-menu-item index="/messaging">
          <el-icon><ChatDotRound /></el-icon>
          <template #title>Messaging</template>
        </el-menu-item>
        <el-menu-item v-if="auth.isSuperAdmin" index="/plans">
          <el-icon><Goods /></el-icon>
          <template #title>Products</template>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <template #title>Orders</template>
        </el-menu-item>
        <el-menu-item v-if="auth.isSuperAdmin" index="/system-config">
          <el-icon><Setting /></el-icon>
          <template #title>System Config</template>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <template #title>Settings</template>
        </el-menu-item>
      </el-menu>
      <div class="aside-footer" :class="{ collapsed: app.sidebarCollapsed }">
        <el-tag v-if="!app.sidebarCollapsed" size="small" class="user-tag">
          {{ auth.username }}
        </el-tag>
        <div class="footer-actions">
          <el-button v-if="!app.sidebarCollapsed" text @click="onLogout">Logout</el-button>
          <el-button
            text
            :title="app.sidebarCollapsed ? 'Expand' : 'Collapse'"
            @click="app.toggleSidebar()"
          >
            <el-icon><component :is="app.sidebarCollapsed ? 'Expand' : 'Fold'" /></el-icon>
          </el-button>
        </div>
      </div>
    </el-aside>
    <el-container>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100vh;
  overflow: hidden;
}
.aside {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e4e7ed;
  background: #fff;
  overflow-x: hidden;
}
.brand {
  font-weight: 700;
  font-size: 1.25rem;
  color: #409eff;
  cursor: pointer;
  padding: 18px 20px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
}
.nav {
  flex: 1;
  border-right: none;
}
.aside-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
}
.aside-footer.collapsed {
  justify-content: center;
  padding: 10px;
}
.user-tag {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.footer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.main {
  padding: 24px;
  overflow-y: auto;
}
</style>
