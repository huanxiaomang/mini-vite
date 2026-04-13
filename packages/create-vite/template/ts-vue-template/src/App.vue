<script lang="ts">
import { ref } from 'vue'

export default {
  name: 'App',
  data() {
    return {
      count: ref(0)
    }
  },
}
</script>

<template>
  <div>
    <a href="https://github.com/user/lite-vite" target="_blank">
      <img src="./vite.svg" class="logo" alt="Lite Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <h1>Lite Vite + Vue</h1>

  <div class="card">
    <button type="button" @click="count++">count is {{ count }}</button>
  </div>

  <p>
    由
    <a href="https://github.com/user/lite-vite" target="_blank">Lite Vite</a>
    驱动的 Vue 3 + TypeScript 项目
  </p>
  <p>
    查看
    <a href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support" target="_blank">Vue 文档</a>
    了解更多
  </p>
  <p class="read-the-docs">点击 Logo 了解更多</p>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
.read-the-docs {
  color: #888;
}
</style>
