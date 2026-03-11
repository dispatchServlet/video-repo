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
  padding: var(--spacing-6);
  min-height: 100vh;
  background: var(--bg-primary);
  transition: all var(--transition-normal);
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  background: var(--bg-secondary);
  padding: var(--spacing-6) var(--spacing-8);
  border-radius: var(--radius-2xl);
  margin-bottom: var(--spacing-6);
  box-shadow: var(--shadow-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all var(--transition-normal);
}

.header h1 {
  color: var(--primary);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-6);
}

.video-card {
  cursor: default;
  transition: all var(--transition-normal);
  border-radius: var(--radius-2xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  background: var(--bg-secondary);
}

.video-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-xl);
}

.video-thumbnail {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: #000;
  transition: all var(--transition-fast);
}

.video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all var(--transition-fast);
}

.video-thumbnail:hover img {
  transform: scale(1.05);
}

.default-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60px;
  background: var(--primary);
  color: white;
  transition: all var(--transition-fast);
}

.video-thumbnail:hover .default-thumbnail {
  background: var(--primary-light);
  transform: scale(1.05);
}

.duration {
  position: absolute;
  bottom: var(--spacing-2);
  right: var(--spacing-2);
  background: rgba(0,0,0,0.8);
  color: white;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  backdrop-filter: blur(4px);
}

.video-info {
  padding: var(--spacing-4);
}

.video-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-3);
  flex-wrap: wrap;
  gap: var(--spacing-3);
}

.video-title {
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: var(--spacing-3);
  color: var(--text-primary);
  font-size: var(--font-size-base);
}

.video-actions {
  display: flex;
  gap: var(--spacing-2);
  flex-shrink: 0;
}

.video-meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--spacing-3);
  font-weight: var(--font-weight-medium);
}

.video-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.video-tags .el-tag {
  cursor: pointer;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  transition: all var(--transition-fast);
}

.video-tags .el-tag:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

:deep(.el-button) {
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-medium);
  padding: var(--spacing-2) var(--spacing-4);
  transition: all var(--transition-fast);
}

:deep(.el-button:hover) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

:deep(.el-card) {
  border-radius: var(--radius-2xl);
  overflow: hidden;
  border: none;
  background: transparent;
}

:deep(.el-empty) {
  margin: var(--spacing-16) 0;
}

:deep(.el-empty__description) {
  color: var(--text-secondary);
  font-size: var(--font-size-base);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .deleted-videos {
    padding: var(--spacing-4);
  }
  
  .container {
    max-width: 100%;
  }
  
  .header {
    padding: var(--spacing-4);
    flex-direction: column;
    gap: var(--spacing-4);
    align-items: stretch;
  }
  
  .header h1 {
    font-size: var(--font-size-xl);
    text-align: center;
  }
  
  .header-actions {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-4);
  }
  
  .video-title {
    font-size: var(--font-size-sm);
  }
  
  .video-actions {
    flex-direction: column;
    gap: var(--spacing-2);
  }
  
  .video-actions .el-button {
    font-size: var(--font-size-xs);
    padding: var(--spacing-1) var(--spacing-2);
  }
  
  .video-meta {
    font-size: var(--font-size-xs);
  }
  
  .video-tags .el-tag {
    font-size: var(--font-size-xs);
    padding: 2px 6px;
  }
}

@media (max-width: 480px) {
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions .el-button {
    width: 100%;
  }
  
  .video-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .video-title {
    margin-right: 0;
  }
  
  .video-actions {
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>