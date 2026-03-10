import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Player from '../views/Player.vue'
import Library from '../views/Library.vue'
import Settings from '../views/Settings.vue'
import DeletedVideos from '../views/DeletedVideos.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/player/:id',
    name: 'Player',
    component: Player
  },
  {
    path: '/library',
    name: 'Library',
    component: Library
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings
  },
  {
    path: '/deleted',
    name: 'DeletedVideos',
    component: DeletedVideos
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
