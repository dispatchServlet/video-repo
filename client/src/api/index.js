import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export default {
  // 获取所有视频
  getVideos() {
    return api.get('/videos')
  },

  // 获取视频详情
  getVideo(id) {
    return api.get(`/videos/${id}`)
  },

  // 搜索视频
  searchVideos(query, tag) {
    return api.get('/videos/search', { params: { q: query, tag } })
  },

  // 添加标签
  addTag(videoId, tagName) {
    return api.post(`/videos/${videoId}/tags`, { tagName })
  },

  // 删除标签
  removeTag(videoId, tagId) {
    return api.delete(`/videos/${videoId}/tags/${tagId}`)
  },

  // 添加关键帧
  addKeyframe(videoId, timestamp, label) {
    return api.post(`/videos/${videoId}/keyframes`, { timestamp, label })
  },

  // 删除关键帧
  removeKeyframe(videoId, keyframeId) {
    return api.delete(`/videos/${videoId}/keyframes/${keyframeId}`)
  },

  // 获取所有标签
  getTags() {
    return api.get('/tags')
  },

  // 扫描视频库
  scanLibrary() {
    return api.post('/scan')
  },

  // 获取扫描路径
  getScanPaths() {
    return api.get('/scan-paths')
  },

  // 更新扫描路径
  updateScanPaths(paths) {
    return api.post('/scan-paths', { paths })
  },

  // 删除视频（标记为已删除）
  deleteVideo(id) {
    return api.delete(`/videos/${id}/soft`)
  },

  // 彻底删除视频
  forceDeleteVideo(id) {
    return api.delete(`/videos/${id}/force`)
  },

  // 恢复已删除视频
  restoreVideo(id) {
    return api.patch(`/videos/${id}/restore`)
  },

  // 收藏/取消收藏视频
  toggleFavorite(id, isFavorite) {
    return api.patch(`/videos/${id}/favorite`, { is_favorite: isFavorite })
  },

  // 获取已删除视频
  getDeletedVideos() {
    return api.get('/videos/deleted')
  },

  // 删除标签（从所有视频中移除）
  deleteTag(tagId) {
    return api.delete(`/tags/${tagId}`)
  },

  // 添加系统标签
  addTagToSystem(name, color) {
    return api.post('/tags/system', { name, color })
  },

  // 初始化项目
  initProject() {
    return api.post('/init')
  },

  // 获取统计数据
  getStats() {
    return api.get('/stats')
  },

  // 记录视频播放
  recordPlay(videoId) {
    return api.post(`/videos/${videoId}/play`)
  },

  // 获取最近播放的视频
  getRecentVideos() {
    return api.get('/videos/history')
  }
}
