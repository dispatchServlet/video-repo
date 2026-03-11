<template>
  <div class="player">
    <div class="container">
      <!-- 返回按钮 -->
      <div class="back-bar">
        <div class="back-left">
          <el-button @click="$router.back()">← 返回</el-button>
        </div>
        <div class="back-right">
          <el-button @click="$router.push('/')">🏠 首页</el-button>
        </div>
      </div>

      <div class="player-layout">
        <!-- 视频播放器 -->
        <div class="video-section">
          <div class="video-player">
            <video
              ref="videoRef"
              :src="videoUrl"
              controls
              @timeupdate="onTimeUpdate"
              @loadedmetadata="onLoadedMetadata"
              @ended="onVideoEnded"
            ></video>
          </div>

          <!-- 关键帧时间轴 -->
          <div class="keyframes-timeline">
            <div class="timeline-markers">
              <div
                v-for="kf in video.keyframes"
                :key="kf.id"
                class="timeline-marker"
                :style="{ left: (video.duration ? (kf.timestamp / video.duration * 100) : (videoDuration ? (kf.timestamp / videoDuration * 100) : 0)) + '%' }"
                @click="seekTo(kf.timestamp)"
              >
                <div class="marker-dot"></div>
                <div class="marker-label">{{ kf.label || formatTime(kf.timestamp) }}</div>
              </div>
            </div>
          </div>

          <!-- 添加关键帧 -->
          <div class="add-keyframe">
            <el-input
              v-model="keyframeLabel"
              placeholder="关键帧备注（可选）"
              style="width: 250px"
              @keyup.enter="addKeyframe"
            />
            <el-button type="primary" @click="addKeyframe">
              ⭐ 添加关键帧 ({{ formatTime(getCurrentTime()) }})
            </el-button>
            <div class="current-time-display">
              当前时间: {{ formatTime(getCurrentTime()) }}
            </div>
          </div>
        </div>

        <!-- 侧边栏 -->
        <div class="sidebar">
          <!-- 视频信息 -->
          <el-card class="info-card">
            <template #header>
              <h2>📹 视频信息</h2>
            </template>
            <div class="info-item">
              <span class="label">文件名:</span>
              <span class="value">{{ video.filename }}</span>
            </div>
            <div class="info-item">
              <span class="label">时长:</span>
              <span class="value">{{ formatDuration(video.duration) }}</span>
            </div>
            <div class="info-item">
              <span class="label">大小:</span>
              <span class="value">{{ formatSize(video.size) }}</span>
            </div>
            <div class="info-item">
              <span class="label">文件夹:</span>
              <span class="value">{{ video.folder_name }}</span>
            </div>
            <div class="info-item">
              <span class="label">播放次数:</span>
              <span class="value">{{ video.play_count || 0 }}</span>
            </div>
            <div class="info-item">
              <span class="label">视频路径:</span>
              <span class="value video-path">{{ video.path || '-' }}</span>
            </div>
            <div class="info-item actions">
              <el-button
                size="small"
                :type="video.is_favorite ? 'primary' : 'default'"
                @click="toggleFavorite()"
              >
                {{ video.is_favorite ? '已收藏' : '收藏' }}
              </el-button>
              <el-button
                size="small"
                icon="Delete"
                type="danger"
                @click="deleteVideo()"
              >
                删除
              </el-button>
            </div>
          </el-card>

          <!-- 标签管理 -->
          <el-card class="tags-card">
            <template #header>
              <div class="tags-header">
                <h2>🏷️ 标签</h2>
              </div>
            </template>
            
            <div class="tags-list">
              <el-tag
                v-for="tag in video.tags"
                :key="tag.id"
                closable
                :style="{ backgroundColor: tag.color, borderColor: tag.color, color: 'white' }"
                @close="removeTag(tag.id)"
              >
                {{ tag.name }}
              </el-tag>
            </div>

            <div class="add-tag">
              <el-select
                v-model="selectedTagValue"
                placeholder="选择已有标签"
                size="small"
                clearable
                filterable
                @change="addSelectedTag"
                style="width: 200px;"
              >
                <el-option
                  v-for="tag in allTags"
                  :key="tag.value"
                  :label="tag.value"
                  :value="tag.value"
                />
              </el-select>
              <el-input
                v-model="customTagInput"
                placeholder="或输入新标签回车"
                size="small"
                @keyup.enter="handleAddCustomTag"
                style="width: 180px; margin-left: 10px;"
              />
            </div>
          </el-card>

          <!-- 关键帧列表 -->
          <el-card class="keyframes-card">
            <template #header>
              <h2>⭐ 关键帧 ({{ video.keyframes?.length || 0 }})</h2>
            </template>
            
            <div class="keyframes-list">
              <div
                v-for="kf in video.keyframes"
                :key="kf.id"
                class="keyframe-item"
                @click="seekTo(kf.timestamp)"
              >
                <div class="keyframe-thumbnail">
                  <img v-if="kf.thumbnail_path" :src="`/data/keyframes/${getKeyframeName(kf.thumbnail_path)}`" />
                  <div v-else class="keyframe-placeholder">⏱️</div>
                </div>
                <div class="keyframe-info">
                  <div class="keyframe-time">{{ formatTime(kf.timestamp) }}</div>
                  <div class="keyframe-label">{{ kf.label || '无备注' }}</div>
                </div>
                <el-button size="small" type="danger" @click.stop="removeKeyframe(kf.id)">×</el-button>
              </div>
              
              <el-empty v-if="!video.keyframes || video.keyframes.length === 0" description="暂无关键帧" :image-size="60" />
            </div>
          </el-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

export default {
  name: 'Player',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const videoRef = ref(null)
    const video = reactive({
      id: route.params.id,
      filename: '',
      duration: 0,
      size: 0,
      folder_name: '',
      play_count: 0,
      is_favorite: false,
      tags: [],
      keyframes: []
    })
    
    const videoUrl = ref('')
    const currentTime = ref(0)
    const videoDuration = ref(0)
    const keyframeLabel = ref('')
    const newTagName = ref('')
    const customTagInput = ref('')
    const selectedTagValue = ref('')
    const allTags = ref([])

    console.log('Player component initialized')

    const loadVideo = async () => {
      try {
        const res = await api.getVideo(video.id)
        Object.assign(video, res.data)
        videoUrl.value = `/api/video/stream?path=${encodeURIComponent(res.data.path)}`
        await loadAllTags()
      } catch (err) {
        ElMessage.error('加载视频失败：' + err.message)
        router.push('/')
      }
    }

    const loadAllTags = async () => {
      try {
        const res = await api.getTags()
        allTags.value = res.data.map(tag => ({
          value: tag.name,
          tag: tag
        }))
      } catch (err) {
        console.error('加载标签失败:', err)
      }
    }

    const queryTags = (queryString, cb) => {
      // 即使没有加载完数据也立即返回，避免一直转圈
      let results = []
      
      if (allTags.value.length > 0) {
        results = queryString
          ? allTags.value.filter(tag => 
              tag.value.toLowerCase().includes(queryString.toLowerCase())
            )
          : allTags.value.slice(0, 10) // 限制显示数量
      } else {
        // 如果没有数据，显示提示信息
        results = [{ value: '加载中...' }]
      }
      
      cb(results)
    }

    const handleTagSelect = (item) => {
      newTagName.value = item.value
    }

    const addSelectedTag = async () => {
      if (!selectedTagValue.value) return
      
      try {
        await api.addTag(video.id, selectedTagValue.value)
        const res = await api.getVideo(video.id)
        video.tags = res.data.tags
        selectedTagValue.value = ''
        await loadAllTags()
        ElMessage.success('标签已添加')
      } catch (err) {
        ElMessage.error('添加失败：' + err.message)
      }
    }

    const handleAddCustomTag = async () => {
      if (!customTagInput.value.trim()) return
      
      try {
        await api.addTag(video.id, customTagInput.value.trim())
        const res = await api.getVideo(video.id)
        video.tags = res.data.tags
        customTagInput.value = ''
        await loadAllTags()
        ElMessage.success('标签已添加')
      } catch (err) {
        ElMessage.error('添加失败：' + err.message)
      }
    }

    const onTagChange = () => {
      if (newTagName.value && !video.tags.find(t => t.name === newTagName.value)) {
        addTag()
      } else {
        newTagName.value = ''
      }
    }

    const onTimeUpdate = () => {
      if (videoRef.value) {
        currentTime.value = videoRef.value.currentTime
        console.log('Current time updated:', currentTime.value)
      }
    }

    const addKeyframe = async () => {
      let timestamp = 0
      if (videoRef.value) {
        timestamp = videoRef.value.currentTime
        console.log('Adding keyframe at time:', timestamp)
      } else {
        timestamp = currentTime.value
        console.log('videoRef is null, using currentTime:', timestamp)
      }
      
      try {
        const res = await api.addKeyframe(video.id, timestamp, keyframeLabel.value)
        video.keyframes.push({
          id: res.data.id,
          timestamp: timestamp,
          label: keyframeLabel.value,
          thumbnail_path: res.data.thumbnailPath
        })
        keyframeLabel.value = ''
        ElMessage.success('关键帧已添加')
      } catch (err) {
        ElMessage.error('添加失败：' + err.message)
      }
    }

    const onLoadedMetadata = () => {
      if (videoRef.value) {
        videoDuration.value = videoRef.value.duration
        console.log('Video loaded, duration:', videoDuration.value)
        console.log('Video element:', videoRef.value)
        // 记录播放历史
        api.recordPlay(video.id)
          .then(() => {
            console.log('Playback recorded')
          })
          .catch(err => {
            console.error('Failed to record playback:', err)
          })
      } else {
        console.error('videoRef is null in onLoadedMetadata')
      }
    }

    const onVideoEnded = () => {
      api.recordPlay(video.id)
        .then(() => {
          console.log('Playback recorded')
        })
        .catch(err => {
          console.error('Failed to record playback:', err)
        })
    }

    const seekTo = (time) => {
      if (videoRef.value) {
        videoRef.value.currentTime = time
      }
    }

    const removeKeyframe = async (id) => {
      try {
        await ElMessageBox.confirm('确定删除这个关键帧吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        
        await api.removeKeyframe(video.id, id)
        video.keyframes = video.keyframes.filter(kf => kf.id !== id)
        ElMessage.success('已删除')
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('删除失败：' + err.message)
        }
      }
    }

    const addTag = async () => {
      const tagName = newTagName.value.trim() || customTagInput.value.trim()
      
      if (!tagName) {
        ElMessage.warning('请输入标签名')
        return
      }

      try {
        await api.addTag(video.id, tagName)
        const res = await api.getVideo(video.id)
        video.tags = res.data.tags
        newTagName.value = ''
        customTagInput.value = ''
        await loadAllTags()
        ElMessage.success('标签已添加')
      } catch (err) {
        ElMessage.error('添加失败：' + err.message)
      }
    }

    const removeTag = async (tagId) => {
      try {
        await api.removeTag(video.id, tagId)
        const res = await api.getVideo(video.id)
        video.tags = res.data.tags
        ElMessage.success('标签已移除')
      } catch (err) {
        ElMessage.error('移除失败：' + err.message)
      }
    }

    const toggleFavorite = async () => {
      try {
        const newFavoriteState = !video.is_favorite
        await api.toggleFavorite(video.id, newFavoriteState)
        video.is_favorite = newFavoriteState
        ElMessage.success(newFavoriteState ? '已添加到收藏' : '已取消收藏')
      } catch (err) {
        ElMessage.error('操作失败：' + err.message)
      }
    }

    const deleteVideo = async () => {
      try {
        await ElMessageBox.confirm('确定要删除这个视频吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        
        await api.deleteVideo(video.id)
        ElMessage.success('视频已删除')
        router.push('/')
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('删除失败：' + err.message)
        }
      }
    }

    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatDuration = (seconds) => {
      if (!seconds) return '0:00'
      const hours = Math.floor(seconds / 3600)
      const mins = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      }
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatSize = (bytes) => {
      if (!bytes) return '0 B'
      const mb = bytes / (1024 * 1024)
      if (mb >= 1000) {
        return `${(mb / 1024).toFixed(1)} GB`
      }
      return `${mb.toFixed(1)} MB`
    }

    const getCurrentTime = () => {
      if (videoRef.value) {
        return videoRef.value.currentTime
      }
      return currentTime.value
    }

    const getKeyframeName = (path) => {
      if (!path) return ''
      return path.split('/').pop()
    }

    onMounted(() => {
      loadVideo()
    })

    onUnmounted(() => {
      if (videoRef.value) {
        videoRef.value.pause()
      }
    })

    return {
      videoRef,
      video,
      videoUrl,
      currentTime,
      videoDuration,
      keyframeLabel,
      newTagName,
      customTagInput,
      selectedTagValue,
      allTags,
      seekTo,
      addKeyframe,
      removeKeyframe,
      addTag,
      removeTag,
      addSelectedTag,
      handleAddCustomTag,
      toggleFavorite,
      deleteVideo,
      formatTime,
      formatDuration,
      formatSize,
      getKeyframeName,
      getCurrentTime,
      onVideoEnded
    }
  }
}
</script>

<style scoped>
.player {
  padding: var(--spacing-6);
  min-height: 100vh;
  width: 100%;
}

.container {
  max-width: 1600px;
  margin: 0 auto;
}

/* 顶部导航 */
.back-bar {
  margin-bottom: var(--spacing-6);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.back-left {
  display: flex;
  gap: var(--spacing-3);
}

.back-right {
  display: flex;
  gap: var(--spacing-3);
}

.back-bar .el-button {
  border-radius: var(--radius-lg) !important;
  font-weight: var(--font-weight-medium) !important;
  padding: var(--spacing-3) var(--spacing-5) !important;
  transition: all var(--transition-fast) !important;
  box-shadow: var(--shadow-sm) !important;
}

/* 布局 */
.player-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: var(--spacing-6);
}

/* 视频区域 */
.video-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-2xl);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-normal);
}

.video-section:hover {
  box-shadow: var(--shadow-xl);
}

.video-player {
  width: 100%;
  background: #000;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal);
}

.video-player:hover {
  box-shadow: var(--shadow-lg);
}

.video-player video {
  width: 100%;
  max-height: 70vh;
  display: block;
  transition: all var(--transition-normal);
}

/* 关键帧时间轴 */
.keyframes-timeline {
  margin-top: var(--spacing-6);
  padding: var(--spacing-4) 0;
  border-top: 2px solid var(--border);
  position: relative;
}

.keyframes-timeline::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--border);
  transform: translateY(-50%);
  z-index: 0;
}

.timeline-markers {
  position: relative;
  height: 40px;
  z-index: 1;
}

.timeline-marker {
  position: absolute;
  top: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 40px;
  z-index: 1;
  transform: translateX(-50%);
  transition: all var(--transition-fast);
}

.timeline-marker:hover {
  transform: translateX(-50%) translateY(-2px);
}

.marker-dot {
  width: 14px;
  height: 14px;
  background: var(--primary);
  border-radius: var(--radius-full);
  border: 3px solid var(--bg-secondary);
  box-shadow: var(--shadow-md);
  z-index: 2;
  transition: all var(--transition-fast);
}

.timeline-marker:hover .marker-dot {
  transform: scale(1.1);
  box-shadow: var(--shadow-lg);
}

.marker-label {
  font-size: var(--font-size-xs);
  color: var(--primary);
  margin-top: var(--spacing-2);
  white-space: nowrap;
  background: var(--bg-secondary);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  z-index: 3;
  position: relative;
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-fast);
}

.timeline-marker:hover .marker-label {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

/* 添加关键帧 */
.add-keyframe {
  margin-top: var(--spacing-4);
  display: flex;
  gap: var(--spacing-3);
  align-items: center;
  flex-wrap: wrap;
  padding: var(--spacing-4);
  background: var(--bg-tertiary);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.add-keyframe:hover {
  background: var(--bg-secondary);
  box-shadow: var(--shadow-sm);
}

.current-time-display {
  font-size: var(--font-size-sm);
  color: var(--primary);
  font-weight: var(--font-weight-semibold);
  margin-left: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(99, 102, 241, 0.1);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.add-keyframe .el-input {
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-sm) !important;
  transition: all var(--transition-fast) !important;
}

.add-keyframe .el-button {
  border-radius: var(--radius-lg) !important;
  font-weight: var(--font-weight-medium) !important;
  transition: all var(--transition-fast) !important;
}

/* 侧边栏 */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  min-height: 0;
}

.info-card, .tags-card, .keyframes-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-2xl) !important;
  box-shadow: var(--shadow-lg) !important;
  overflow: hidden;
  transition: all var(--transition-normal);
  border: none !important;
}

.info-card:hover, .tags-card:hover, .keyframes-card:hover {
  box-shadow: var(--shadow-xl) !important;
  transform: translateY(-2px);
}

.info-card .el-card__header,
.tags-card .el-card__header,
.keyframes-card .el-card__header {
  background: var(--bg-tertiary) !important;
  border-bottom: 1px solid var(--border) !important;
  padding: var(--spacing-4) !important;
}

.info-card .el-card__body,
.tags-card .el-card__body,
.keyframes-card .el-card__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-4) !important;
  background: var(--bg-secondary) !important;
}

.keyframes-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--primary) var(--bg-tertiary);
}

.keyframes-list::-webkit-scrollbar {
  width: 6px;
}

.keyframes-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
}

.keyframes-list::-webkit-scrollbar-thumb {
  background: var(--primary);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
}

.keyframes-list::-webkit-scrollbar-thumb:hover {
  background: var(--primary-dark);
}

.info-card h2, .tags-card h2, .keyframes-card h2 {
  color: var(--primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0 !important;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

/* 信息项 */
.info-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-3) 0;
  border-bottom: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.info-item:hover {
  background: rgba(99, 102, 241, 0.05);
  padding-left: var(--spacing-2);
  padding-right: var(--spacing-2);
  border-radius: var(--radius-md);
  margin-left: -var(--spacing-2);
  margin-right: -var(--spacing-2);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
}

.info-item .value {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  text-align: right;
}

.video-path {
  word-break: break-all;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.info-item.actions {
  justify-content: center;
  gap: var(--spacing-3);
  padding-top: var(--spacing-4);
  margin-top: var(--spacing-2);
  border-top: 1px solid var(--border);
  background: transparent;
  margin-left: 0;
  margin-right: 0;
  padding-left: 0;
  padding-right: 0;
}

.info-item.actions:hover {
  background: transparent;
  margin-left: 0;
  margin-right: 0;
  padding-left: 0;
  padding-right: 0;
}

.info-item.actions .el-button {
  min-width: 100px;
  border-radius: var(--radius-lg) !important;
  font-weight: var(--font-weight-medium) !important;
  transition: all var(--transition-fast) !important;
}

.info-item.actions .el-button:first-child {
  border-color: var(--primary) !important;
  color: var(--primary) !important;
}

.info-item.actions .el-button:first-child.is-primary {
  background-color: var(--primary) !important;
  border-color: var(--primary) !important;
  color: white !important;
}

.info-item.actions .el-button:last-child {
  background-color: var(--danger) !important;
  border-color: var(--danger) !important;
  color: white !important;
}

/* 标签 */
.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-4);
  min-height: 30px;
  padding: var(--spacing-3);
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}

.tags-list .el-tag {
  border-radius: var(--radius-full) !important;
  font-size: var(--font-size-sm) !important;
  padding: var(--spacing-2) var(--spacing-3) !important;
  transition: all var(--transition-fast) !important;
  cursor: pointer;
}

.tags-list .el-tag:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-sm);
}

.add-tag {
  margin-top: var(--spacing-3);
  padding: var(--spacing-3);
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-3);
  align-items: center;
}

.add-tag .el-select,
.add-tag .el-input {
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-sm) !important;
  transition: all var(--transition-fast) !important;
}

/* 关键帧列表 */
.keyframes-list {
  max-height: 400px;
  overflow-y: auto;
  margin-top: var(--spacing-3);
}

.keyframe-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: var(--spacing-2);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
}

.keyframe-item:hover {
  background: var(--bg-secondary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.keyframe-thumbnail {
  width: 80px;
  height: 45px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;
  flex-shrink: 0;
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.keyframe-item:hover .keyframe-thumbnail {
  box-shadow: var(--shadow-md);
  transform: scale(1.05);
}

.keyframe-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all var(--transition-normal);
}

.keyframe-item:hover .keyframe-thumbnail img {
  transform: scale(1.1);
}

.keyframe-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  transition: all var(--transition-fast);
}

.keyframe-item:hover .keyframe-placeholder {
  background: linear-gradient(135deg, var(--primary-dark), var(--primary));
}

.keyframe-info {
  flex: 1;
  min-width: 0;
}

.keyframe-time {
  font-weight: var(--font-weight-semibold);
  color: var(--primary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-1);
}

.keyframe-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.keyframe-item .el-button {
  padding: var(--spacing-1) var(--spacing-2) !important;
  margin-left: var(--spacing-1) !important;
  border-radius: var(--radius-md) !important;
  font-size: var(--font-size-xs) !important;
  transition: all var(--transition-fast) !important;
  background-color: var(--danger) !important;
  border-color: var(--danger) !important;
  color: white !important;
}

.keyframe-item .el-button:hover {
  background-color: var(--danger-dark) !important;
  border-color: var(--danger-dark) !important;
  transform: scale(1.05);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .player-layout {
    grid-template-columns: 1fr;
  }
  
  .sidebar {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .info-card, .tags-card, .keyframes-card {
    flex: 1;
    min-width: 300px;
  }
}

/* 手机端响应式设计 */
@media (max-width: 768px) {
  .player {
    padding: var(--spacing-4);
  }
  
  .container {
    max-width: 100%;
  }
  
  .back-bar {
    flex-direction: column;
    gap: var(--spacing-3);
    align-items: stretch;
  }
  
  .back-left,
  .back-right {
    justify-content: center;
  }
  
  .back-bar .el-button {
    font-size: var(--font-size-sm) !important;
    padding: var(--spacing-2) var(--spacing-4) !important;
  }
  
  .video-section {
    padding: var(--spacing-4);
  }
  
  .video-player video {
    max-height: 50vh;
  }
  
  .add-keyframe {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-3);
  }
  
  .add-keyframe .el-input {
    width: 100% !important;
  }
  
  .current-time-display {
    text-align: center;
    margin-left: 0;
  }
  
  .sidebar {
    flex-direction: column;
  }
  
  .info-card, .tags-card, .keyframes-card {
    min-width: 100%;
  }
  
  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-1);
  }
  
  .info-item .value {
    text-align: left;
    margin-top: var(--spacing-1);
  }
  
  .info-item .label {
    font-weight: var(--font-weight-semibold);
  }
  
  .video-path {
    max-width: 100%;
  }
  
  .info-item.actions {
    flex-direction: column;
    gap: var(--spacing-2);
  }
  
  .info-item.actions .el-button {
    width: 100%;
  }
  
  .add-tag {
    flex-direction: column;
    gap: var(--spacing-3);
    align-items: stretch;
  }
  
  .add-tag .el-select,
  .add-tag .el-input {
    width: 100% !important;
    margin-left: 0 !important;
  }
  
  .keyframes-list {
    max-height: 300px;
  }
  
  .keyframe-item {
    flex-direction: column;
    align-items: stretch;
  }
  
  .keyframe-thumbnail {
    width: 100%;
    height: 80px;
  }
  
  .keyframe-info {
    margin-top: var(--spacing-3);
  }
  
  .keyframe-item .el-button {
    align-self: flex-end;
    margin-top: var(--spacing-2);
  }
}

@media (max-width: 480px) {
  .player {
    padding: var(--spacing-3);
  }
  
  .back-bar .el-button {
    font-size: var(--font-size-xs) !important;
    padding: var(--spacing-1) var(--spacing-3) !important;
  }
  
  .video-section {
    padding: var(--spacing-3);
  }
  
  .add-keyframe .el-button {
    font-size: var(--font-size-sm) !important;
    padding: var(--spacing-2) var(--spacing-4) !important;
  }
  
  .info-card h2, .tags-card h2, .keyframes-card h2 {
    font-size: var(--font-size-base);
  }
  
  .info-item {
    padding: var(--spacing-2) 0;
  }
  
  .keyframe-thumbnail {
    height: 60px;
  }
}
</style>
