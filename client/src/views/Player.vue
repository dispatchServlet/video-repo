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
  padding: 20px;
  min-height: 100vh;
}

.container {
  max-width: 1600px;
  margin: 0 auto;
}

.back-bar {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.back-left {
  display: flex;
  gap: 10px;
}

.back-right {
  display: flex;
  gap: 10px;
}

.player-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
}

.video-section {
  background: white;
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.video-player {
  width: 100%;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}

.video-player video {
  width: 100%;
  max-height: 70vh;
  display: block;
}

.keyframes-timeline {
  margin-top: 20px;
  padding: 10px 0;
  border-top: 2px solid #eee;
}

.timeline-markers {
  position: relative;
  height: 30px;
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
}

.marker-dot {
  width: 12px;
  height: 12px;
  background: #667eea;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  z-index: 2;
}

.marker-label {
  font-size: 11px;
  color: #667eea;
  margin-top: 3px;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  z-index: 3;
  position: relative;
}

.add-keyframe {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.current-time-display {
  font-size: 14px;
  color: #667eea;
  font-weight: 500;
  margin-left: 10px;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

.info-card, .tags-card, .keyframes-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.info-card .el-card__body,
.tags-card .el-card__body,
.keyframes-card .el-card__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.keyframes-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.info-card, .tags-card, .keyframes-card {
  background: white;
}

.info-card h2, .tags-card h2, .keyframes-card h2 {
  color: #667eea;
  font-size: 18px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #eee;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  color: #999;
}

.info-item .value {
  color: #333;
  font-weight: 500;
}

.video-path {
  word-break: break-all;
  font-size: 12px;
  color: #666;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.info-item.actions {
  justify-content: center;
  gap: 10px;
  padding-top: 20px;
}

.info-item.actions .el-button {
  min-width: 80px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
  min-height: 30px;
}

.add-tag {
  margin-top: 10px;
}

.keyframes-list {
  max-height: 400px;
  overflow-y: auto;
}

.keyframe-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
  margin-bottom: 8px;
}

.keyframe-item:hover {
  background: #f8f9fa;
}

.keyframe-thumbnail {
  width: 80px;
  height: 45px;
  border-radius: 4px;
  overflow: hidden;
  background: #000;
  flex-shrink: 0;
}

.keyframe-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.keyframe-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.keyframe-info {
  flex: 1;
  min-width: 0;
}

.keyframe-time {
  font-weight: bold;
  color: #667eea;
  font-size: 14px;
}

.keyframe-label {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keyframe-item .el-button {
  padding: 5px 10px;
  margin-left: 5px;
}

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
    padding: 10px;
  }
  
  .container {
    max-width: 100%;
  }
  
  .back-bar {
    flex-direction: column;
    gap: 5px;
  }
  
  .back-bar .el-button {
    font-size: 12px;
    padding: 6px 12px;
  }
  
  .video-section {
    padding: 15px;
  }
  
  .video-player video {
    max-height: 50vh;
  }
  
  .add-keyframe {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
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
    gap: 5px;
  }
  
  .info-item .label {
    font-weight: bold;
  }
  
  .video-path {
    max-width: 100%;
  }
  
  .info-item.actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .info-item.actions .el-button {
    width: 100%;
  }
  
  .add-tag {
    flex-direction: column;
    gap: 10px;
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
    margin-top: 10px;
  }
}

@media (max-width: 480px) {
  .back-bar .el-button {
    font-size: 10px;
    padding: 4px 8px;
  }
  
  .video-section {
    padding: 10px;
  }
  
  .add-keyframe .el-button {
    font-size: 12px;
    padding: 8px 16px;
  }
  
  .info-card h2, .tags-card h2, .keyframes-card h2 {
    font-size: 16px;
  }
  
  .info-item {
    padding: 8px 0;
  }
}
</style>
