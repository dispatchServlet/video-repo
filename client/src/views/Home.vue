<template>
  <div class="home">
    <div class="container">
      <!-- 头部 -->
      <header class="header">
        <h1>🎬 本地视频仓库</h1>
        <div class="header-actions">
          <el-button @click="$router.push('/library')">📚 视频库</el-button>
          <el-button @click="$router.push('/deleted')">🗑️ 已删除</el-button>
          <el-button @click="showRecentVideos">📺 历史播放</el-button>
          <el-button @click="$router.push('/settings')">⚙️ 设置</el-button>
          <el-button type="primary" @click="handleScan">🔄 扫描新增视频</el-button>
        </div>
      </header>



      <!-- 搜索 -->
      <div class="search-bar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索视频..."
          clearable
          style="width: 100%"
          @input="handleSearch"
        >
          <template #prefix>🔍</template>
        </el-input>
      </div>

      <!-- 标签筛选 -->
      <div class="tag-filter">
        <div class="tag-scroll-container">
          <div 
            class="tag-item" 
            :class="{ active: selectedTag === '' }"
            @click="selectTag('')"
          >
            全部
            <span class="tag-count">{{ videos.length }}</span>
          </div>
          <div 
            class="tag-item" 
            :class="{ active: selectedTag === 'favorite' }"
            @click="selectTag('favorite')"
          >
            ⭐ 收藏
            <span class="tag-count">{{ favoriteCount }}</span>
          </div>
          <div 
            v-for="tag in allTagsWithCount" 
            :key="tag.value"
            class="tag-item"
            :class="{ active: selectedTag === tag.value }"
            :style="{ '--tag-color': tag.color }"
            @click="selectTag(tag.value)"
          >
            {{ tag.value }}
            <span class="tag-count">{{ tag.count }}</span>
          </div>
        </div>
      </div>

      <!-- 视频网格 -->
      <div class="video-grid">
        <el-card
          v-for="video in filteredVideos"
          :key="video.id"
          class="video-card"
          shadow="hover"
          @click="playVideo(video.id)"
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
            <div class="play-overlay">▶️</div>
          </div>
          <div class="video-info">
            <div class="video-header">
              <div class="video-title" :title="video.filename">{{ video.filename }}</div>
            </div>
            <div class="video-meta">
              <span class="folder">{{ video.folder_name }}</span>
              <span class="size">{{ formatSize(video.size) }}</span>
            </div>
            <div class="video-actions">
              <el-button
                  size="small"
                  :type="video.is_favorite ? 'primary' : 'default'"
                  @click.stop="toggleFavorite(video)"
                >
                  {{ video.is_favorite ? '已收藏' : '收藏' }}
                </el-button>
              <el-button
                size="small"
                icon="Delete"
                type="danger"
                @click.stop="deleteVideo(video)"
              >
                删除
              </el-button>
            </div>
            <div class="video-tags">
              <el-tag
                v-for="tag in parseTags(video.tags, video.tag_colors)"
                :key="tag.name"
                size="small"
                :style="{ backgroundColor: tag.color, borderColor: tag.color, color: 'white' }"
                @click.stop="selectTag(tag.name)"
              >
                {{ tag.name }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 空状态 -->
      <el-empty v-if="filteredVideos.length === 0" description="暂无视频，点击扫描新增视频开始">
        <el-button type="primary" @click="handleScan">扫描视频库</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

export default {
  name: 'Home',
  setup() {
    const router = useRouter()
    const videos = ref([])
    const tags = ref([])
    const searchQuery = ref('')
    const selectedTag = ref('')
    const searchingTags = ref(false)
    const allTagsWithCount = ref([])
    const recentVideos = ref([])

    const favoriteCount = computed(() => {
      return videos.value.filter(v => v.is_favorite).length
    })

    const filteredVideos = computed(() => {
      let result = [...videos.value]
      
      // 搜索
      if (searchQuery.value) {
        result = result.filter(v => 
          v.filename.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      }
      
      // 标签筛选
      if (selectedTag.value) {
        if (selectedTag.value === 'favorite') {
          result = result.filter(v => v.is_favorite)
        } else {
          result = result.filter(v => 
            v.tags && v.tags.includes(selectedTag.value)
          )
        }
      }
      
      return result
    })

    const filteredTags = computed(() => {
      if (!allTagsWithCount.value.length) return []
      return allTagsWithCount.value
    })

    const loadVideos = async () => {
      try {
        const res = await api.getVideos()
        videos.value = res.data
      } catch (err) {
        ElMessage.error('加载视频失败：' + err.message)
      }
    }

    const loadTags = async () => {
      try {
        const res = await api.getTags()
        tags.value = res.data
        
        // 为每个标签统计视频数量
        allTagsWithCount.value = res.data.map(tag => ({
          value: tag.name,
          count: videos.value.filter(v => v.tags?.includes(tag.name)).length,
          color: tag.color
        }))
      } catch (err) {
        console.error('加载标签失败:', err)
      }
    }

    const loadRecentVideos = async () => {
      try {
        const res = await api.getRecentVideos()
        recentVideos.value = res.data
      } catch (err) {
        console.error('加载最近播放失败:', err)
      }
    }

    const handleScan = async () => {
      try {
        const res = await api.scanLibrary()
        ElMessage.success(`扫描完成！新增 ${res.data.added} 个视频，跳过 ${res.data.skipped} 个`)
        loadVideos()
        loadTags()
        loadRecentVideos()
      } catch (err) {
        ElMessage.error('扫描失败：' + err.message)
      }
    }

    const handleSearch = () => {
      if (!searchQuery.value && !selectedTag.value) {
        loadVideos()
        return
      }

      if (selectedTag.value === 'favorite') {
        // 收藏标签的筛选在本地处理
        loadVideos()
      } else {
        api.searchVideos(searchQuery.value, selectedTag.value)
          .then(res => {
            videos.value = res.data
          })
          .catch(err => {
            ElMessage.error('搜索失败：' + err.message)
          })
      }
    }

    const selectTag = (tagName) => {
      selectedTag.value = tagName
      handleSearch()
    }

    const toggleFavorite = async (video) => {
      try {
        const newFavoriteState = !video.is_favorite
        await api.toggleFavorite(video.id, newFavoriteState)
        video.is_favorite = newFavoriteState
        ElMessage.success(newFavoriteState ? '已添加到收藏' : '已取消收藏')
      } catch (err) {
        ElMessage.error('操作失败：' + err.message)
      }
    }

    const deleteVideo = async (video) => {
      try {
        await ElMessageBox.confirm('确定要删除这个视频吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        
        await api.deleteVideo(video.id)
        ElMessage.success('视频已删除')
        loadVideos()
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('删除失败：' + err.message)
        }
      }
    }

    const playVideo = (id) => {
      router.push(`/player/${id}`)
    }

    const searchTags = (query) => {
      if (!query) return
      searchingTags.value = true
      
      setTimeout(() => {
        searchingTags.value = false
        // 过滤标签
        allTagsWithCount.value = tags.value.map(tag => ({
          value: tag.name,
          count: videos.value.filter(v => v.tags?.includes(tag.name)).length,
          color: tag.color
        })).filter(tag => 
          tag.value.toLowerCase().includes(query.toLowerCase())
        )
      }, 300)
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

    const showRecentVideos = async () => {
      await loadRecentVideos()
      if (recentVideos.value.length > 0) {
        ElMessageBox.alert(
          `<div class="recent-videos-dialog">
            <h3 style="margin-bottom: 15px; color: #667eea;">📺 最近播放</h3>
            <div class="recent-videos-grid">
              ${recentVideos.value.map(video => {
                const thumbnailName = video.thumbnail_path ? video.thumbnail_path.split('/').pop() : ''
                const duration = video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '0:00'
                return `
                <div class="recent-video-item" style="cursor: pointer; padding: 10px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px;" onclick="window.location.href='/player/${video.id}'">
                  <div style="width: 80px; height: 45px; border-radius: 4px; overflow: hidden; background: #000;">
                    ${video.thumbnail_path ? `
                      <img src="/data/thumbnails/${thumbnailName}" style="width: 100%; height: 100%; object-fit: cover;" />
                    ` : `
                      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: white;">🎬</div>
                    `}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${video.filename}</div>
                    <div style="font-size: 12px; color: #999; display: flex; justify-content: space-between; margin-top: 5px;">
                      <span>${video.folder_name}</span>
                      <span>${duration}</span>
                    </div>
                  </div>
                </div>
              `
              }).join('')}
            </div>
          </div>`,
          '历史播放',
          {
            dangerouslyUseHTMLString: true,
            customClass: 'recent-videos-box',
            confirmButtonText: '关闭',
            width: '600px'
          }
        )
      } else {
        ElMessage.info('暂无播放历史')
      }
    }

    onMounted(() => {
      loadVideos()
      loadTags()
    })

    return {
      videos,
      tags,
      recentVideos,
      filteredVideos,
      searchQuery,
      selectedTag,
      filteredTags,
      allTagsWithCount,
      favoriteCount,
      handleScan,
      handleSearch,
      selectTag,
      toggleFavorite,
      deleteVideo,
      playVideo,
      showRecentVideos,
      parseTags,
      getThumbnailName,
      formatDuration,
      formatSize,
      showDefaultThumbnail,
      searchTags,
      searchingTags
    }
  }
}
</script>

<style scoped>
.home {
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

.search-bar {
  margin-bottom: 20px;
}

.tag-filter {
  margin-bottom: 20px;
  overflow: hidden;
}

.tag-scroll-container {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #667eea #f0f0f0;
}

.tag-scroll-container::-webkit-scrollbar {
  height: 6px;
}

.tag-scroll-container::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 3px;
}

.tag-scroll-container::-webkit-scrollbar-thumb {
  background: #667eea;
  border-radius: 3px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  border-radius: 20px;
  background: #f0f0f0;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.tag-item:hover {
  background: #e0e0e0;
  transform: translateY(-2px);
}

.tag-item.active {
  background: var(--tag-color, #667eea);
  color: white;
  border-color: var(--tag-color, #667eea);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transform: scale(1.05);
  transition: all 0.3s ease;
}

.tag-count {
  font-size: 12px;
  opacity: 0.8;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.tag-item:not(.active) .tag-count {
  background: rgba(0, 0, 0, 0.1);
  color: #666;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.video-card {
  cursor: pointer;
  transition: transform 0.3s;
}

.video-card:hover {
  transform: translateY(-5px);
}

.video-card:hover .video-thumbnail::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3));
  border-radius: 8px;
  z-index: 1;
  transition: all 0.3s ease;
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

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  opacity: 0;
  transition: opacity 0.3s;
}

.video-card:hover .play-overlay {
  opacity: 1;
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
  gap: 8px;
  margin: 10px 0;
  justify-content: flex-start;
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
  .home {
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
