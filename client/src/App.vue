<template>
  <div id="app">
    <keep-alive>
      <router-view />
    </keep-alive>
  </div>
</template>

<script>
export default {
  name: 'App',
  mounted() {
    // 主题切换功能已移至设置页面
    // 这里只保留基础的背景设置
    document.body.classList.add('app-body')
  }
}
</script>

<style scoped>
#app {
  min-height: 100vh;
  width: 100%;
}
</style>
