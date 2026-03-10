<template>
  <div class="deleted-videos">
    <div class="container">
      <!-- 头部 -->
      <header class="header">
        <h1>🗑️ 已删除视频</h1>
        <div class="header-actions">
          <el-button @click="$router.push('/')">← 返回首页</el-button>
          <el-button @click="$router.push('/library')">📚 视频库</el-button>
        </div>
      </header>

      <!-- 视频网格 -->
      <div class="video-grid">
        <el-card
          v-for="video in deletedVideos"
          :key="video.id"
          class="video-card"
          shadow="hover"
        >
          <div class="video-thumbnail">
            <img 
              v-if="video.thumbnail_path" 
              :src="`/data/thumbnails/${getThumbnailName(video.thumbnail_path)}`" 
              :alt="video.filename"
              @error="showDefaultThumbnail"
            />
            <div v-else class="default-thumbnail">🎬</div>
            <div class="duration">{{ formatDuration(video.duration) }}</div>
          </div>
          <div class="video-info">
            <div class="video-header">
              <div class="video-title" :title="video.filename">{{ video.filename }}</div>
              <div class="video-actions">
                <el-button
                  size="small"
                  type="success"
                  icon="RefreshLeft"
                  @click="restoreVideo(video)"
                >
                  恢复
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  icon="Delete"
                  @click="forceDeleteVideo(video)"
                >
                  彻底删除
                </el-button>
              </div>
            </div>
            <div class="video-meta">
              <span class="folder">{{ video.folder_name }}</span>
              <span class="size">{{ formatSize(video.size) }}</span>
            </div>
            <div class="video-tags">
              <el-tag
                v-for="tag in parseTags(video.tags, video.tag_colors)"
                :key="tag.name"
                size="small"
                :style="{ backgroundColor: tag.color, borderColor: tag.color, color: 'white' }"
              >
                {{ tag.name }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 空状态 -->
      <el-empty v-if="deletedVideos.length === 0" description="暂无已删除视频" :image-size="120" />
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

export default {
  name: 'DeletedVideos',
  setup() {
    const deletedVideos = ref([])

    const loadDeletedVideos = async () => {
      try {
        const res = await api.getDeletedVideos()
        deletedVideos.value = res.data
      } catch (err) {
        ElMessage.error('加载已删除视频失败：' + err.message)
      }
    }

    const restoreVideo = async (video) => {
      try {
        await ElMessageBox.confirm('确定要恢复这个视频吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        
        await api.restoreVideo(video.id)
        ElMessage.success('视频已恢复')
        loadDeletedVideos()
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('恢复失败：' + err.message)
        }
      }
    }

    const forceDeleteVideo = async (video) => {
      try {
        await ElMessageBox.confirm('确定要彻底删除这个视频吗？此操作不可恢复。', '警告', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'danger'
        })
        
        await api.forceDeleteVideo(video.id)
        ElMessage.success('视频已彻底删除')
        loadDeletedVideos()
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('删除失败：' + err.message)
        }
      }
    }

    const parseTags = (tagsStr, colorsStr) => {
      if (!tagsStr) return []
      const names = tagsStr.split(',')
      const colors = colorsStr ? colorsStr.split(',') : []
      return names.map((name, i) => ({ name, color: colors[i] || '#667eea' }))
    }

    const getThumbnailName = (path) => {
      if (!path) return ''
      return path.split('/').pop()
    }

    const formatDuration = (seconds) => {
      if (!seconds) return '0:00'
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
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

    const showDefaultThumbnail = (e) => {
      e.target.style.display = 'none'
    }

    onMounted(() => {
      loadDeletedVideos()
    })

    return {
      deletedVideos,
      loadDeletedVideos,
      restoreVideo,
      forceDeleteVideo,
      parseTags,
      getThumbnailName,
      formatDuration,
      formatSize,
      showDefaultThumbnail
    }
  }
}
</script>

<style scoped>
.deleted-videos {
  padding: 20px;
  min-height: 100vh;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  background: white;
  padding: 20px 30px;
  border-radius: 15px;
  margin-bottom: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  color: #667eea;
  font-size: 28px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.video-card {
  cursor: default;
  transition: transform 0.3s;
}

.video-card:hover {
  transform: translateY(-5px);
}

.video-thumbnail {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  border-radius: 8px;
  background: #000;
}

.video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60px;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.video-info {
  padding: 15px;
}

.video-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.video-title {
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 10px;
}

.video-actions {
  display: flex;
  gap: 5px;
}

.video-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
}

.video-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.video-tags .el-tag {
  cursor: pointer;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .deleted-videos {
    padding: 10px;
  }
  
  .container {
    max-width: 100%;
  }
  
  .header {
    padding: 15px;
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
  
  .header h1 {
    font-size: 24px;
    text-align: center;
  }
  
  .header-actions {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .header-actions .el-button {
    font-size: 12px;
    padding: 6px 12px;
  }
  
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }
  
  .video-title {
    font-size: 14px;
  }
  
  .video-actions {
    flex-direction: column;
    gap: 5px;
  }
  
  .video-actions .el-button {
    font-size: 12px;
    padding: 4px 8px;
  }
  
  .video-meta {
    font-size: 10px;
  }
  
  .video-tags .el-tag {
    font-size: 10px;
    padding: 2px 6px;
  }
}

@media (max-width: 480px) {
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions .el-button {
    width: 100%;
  }
}
</style>