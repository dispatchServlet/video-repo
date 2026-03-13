<template>
  <div class="home">
    <div class="container">
      <!-- 头部 -->
      <header class="header">
        <div class="header-left">
          <h1 class="app-title">🎬 本地视频仓库</h1>
        </div>
        <div class="header-right">
          <div class="header-actions">
            <el-button 
              class="action-button"
              @click="$router.push('/library')"
            >
              📚 视频库
            </el-button>
            <el-button 
              class="action-button"
              @click="$router.push('/deleted')"
            >
              🗑️ 已删除
            </el-button>
            <el-button 
              class="action-button"
              @click="showRecentVideos"
            >
              📺 历史播放
            </el-button>
            <el-button 
              class="action-button"
              @click="$router.push('/settings')"
            >
              ⚙️ 设置
            </el-button>
            <el-button 
              type="primary" 
              class="scan-button"
              @click="handleScan"
            >
              🔄 扫描新增视频
            </el-button>
          </div>
        </div>
      </header>

      <!-- 搜索和排序 -->
      <div class="search-section">
        <div class="search-sort-container">
          <el-input
            v-model="searchQuery"
            placeholder="搜索视频..."
            clearable
            class="search-input"
            @input="handleSearch"
          >
            <template #prefix>
              <i class="search-icon">🔍</i>
            </template>
          </el-input>
          
          <div class="sort-options">
            <span>排序：</span>
            <el-select v-model="sortBy" size="small" @change="handleSearch">
              <el-option label="默认" value="default"></el-option>
              <el-option label="名称" value="name"></el-option>
              <el-option label="大小" value="size"></el-option>
              <el-option label="添加日期" value="date"></el-option>
            </el-select>
            <el-select v-model="sortOrder" size="small" @change="handleSearch">
              <el-option label="升序" value="asc"></el-option>
              <el-option label="降序" value="desc"></el-option>
            </el-select>
          </div>
        </div>
      </div>

      <!-- 标签筛选 -->
      <div class="tag-section">
        <h3 class="section-title">按标签筛选</h3>
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
      <div class="video-section">
        <h3 class="section-title">
          {{ selectedTag === '' ? '全部视频' : selectedTag === 'favorite' ? '收藏视频' : `标签: ${selectedTag}` }}
          <span class="video-count">({{ filteredVideos.length }})</span>
        </h3>
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
                class="thumbnail-img"
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
                  class="action-btn favorite-btn"
                  @click.stop="toggleFavorite(video)"
                >
                  {{ video.is_favorite ? '已收藏' : '收藏' }}
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  class="action-btn delete-btn"
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
                  class="video-tag"
                  @click.stop="selectTag(tag.name)"
                >
                  {{ tag.name }}
                </el-tag>
              </div>
            </div>
          </el-card>
        </div>
      </div>

      <!-- 空状态 -->
      <el-empty 
        v-if="filteredVideos.length === 0" 
        description="暂无视频，点击扫描新增视频开始"
        class="empty-state"
      >
        <el-button type="primary" @click="handleScan" class="scan-button">
          扫描视频库
        </el-button>
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
    const sortBy = ref('default')
    const sortOrder = ref('desc')

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
      
      // 排序
      result.sort((a, b) => {
        let comparison = 0
        
        switch (sortBy.value) {
          case 'name':
            comparison = a.filename.localeCompare(b.filename)
            break
          case 'size':
            comparison = a.size - b.size
            break
          case 'date':
            comparison = new Date(a.created_at) - new Date(b.created_at)
            break
          default:
            // 默认按创建时间降序
            comparison = new Date(b.created_at) - new Date(a.created_at)
        }
        
        return sortOrder.value === 'asc' ? comparison : -comparison
      })
      
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
        // 检查是否已添加视频目录
        const paths = await api.getScanPaths()
        if (!paths.data || paths.data.length === 0) {
          ElMessage.warning('请先在设置页面添加视频目录后再执行扫描')
          return
        }
        
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
      return names.map((name, i) => ({ name, color: colors[i] || '#6366f1' }))
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
            <h3 style="margin-bottom: var(--spacing-4); color: var(--primary); font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);">📺 最近播放</h3>
            <div class="recent-videos-grid">
              ${recentVideos.value.map(video => {
                const thumbnailName = video.thumbnail_path ? video.thumbnail_path.split('/').pop() : ''
                const duration = video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '0:00'
                return `
                <div class="recent-video-item" style="cursor: pointer; padding: var(--spacing-3); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-3); transition: background-color var(--transition-fast);" onclick="window.location.href='/player/${video.id}'">
                  <div style="width: 80px; height: 45px; border-radius: var(--radius-md); overflow: hidden; background: #000;">
                    ${video.thumbnail_path ? `
                      <img src="/data/thumbnails/${thumbnailName}" style="width: 100%; height: 100%; object-fit: cover;" />
                    ` : `
                      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 20px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white;">🎬</div>
                    `}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: var(--font-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-size-sm);">${video.filename}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-tertiary); display: flex; justify-content: space-between; margin-top: var(--spacing-1);">
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
      sortBy,
      sortOrder,
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
  padding: var(--spacing-6);
  min-height: 100vh;
  width: 100%;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}

/* 头部 */
.header {
  background: var(--bg-secondary);
  padding: var(--spacing-6);
  border-radius: var(--radius-2xl);
  margin-bottom: var(--spacing-8);
  box-shadow: var(--shadow-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.header-left {
  flex: 1;
  min-width: 200px;
}

.app-title {
  color: var(--primary);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.header-right {
  flex: 1;
  min-width: 300px;
}

.header-actions {
  display: flex;
  gap: var(--spacing-3);
  justify-content: flex-end;
  flex-wrap: wrap;
}

.action-button {
  border-radius: var(--radius-lg) !important;
  font-weight: var(--font-weight-medium) !important;
  transition: all var(--transition-fast) !important;
}

.scan-button {
  border-radius: var(--radius-lg) !important;
  font-weight: var(--font-weight-medium) !important;
  padding: var(--spacing-3) var(--spacing-6) !important;
  transition: all var(--transition-fast) !important;
}

/* 搜索区域 */
.search-section {
  margin-bottom: var(--spacing-8);
}

.search-sort-container {
  display: flex;
  gap: var(--spacing-4);
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 300px;
  border-radius: var(--radius-xl) !important;
  box-shadow: var(--shadow-base);
  transition: all var(--transition-fast) !important;
}

.search-input:hover {
  box-shadow: var(--shadow-md) !important;
}

.search-icon {
  font-size: var(--font-size-lg);
  color: var(--text-tertiary);
}

.sort-options {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.sort-options span {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  white-space: nowrap;
}

.sort-options :deep(.el-select) {
  min-width: 100px;
}

/* 标签区域 */
.tag-section {
  margin-bottom: var(--spacing-8);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-4);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.video-count {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  font-weight: var(--font-weight-normal);
}

.tag-scroll-container {
  display: flex;
  gap: var(--spacing-3);
  padding: var(--spacing-3) 0;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--primary) var(--bg-tertiary);
  padding-bottom: var(--spacing-4);
}

.tag-scroll-container::-webkit-scrollbar {
  height: 6px;
}

.tag-scroll-container::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
}

.tag-scroll-container::-webkit-scrollbar-thumb {
  background: var(--primary);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
}

.tag-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--primary-dark);
}

.tag-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-5);
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
  border: 1px solid var(--border);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.tag-item:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.tag-item.active {
  background: var(--tag-color, var(--primary));
  color: white;
  border-color: var(--tag-color, var(--primary));
  box-shadow: var(--shadow-md);
  transform: scale(1.05);
}

.tag-count {
  font-size: var(--font-size-xs);
  opacity: 0.8;
  background: rgba(255, 255, 255, 0.2);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
  font-weight: var(--font-weight-semibold);
}

.tag-item:not(.active) .tag-count {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

/* 视频区域 */
.video-section {
  margin-bottom: var(--spacing-8);
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-6);
}

.video-card {
  cursor: pointer;
  transition: all var(--transition-normal);
  border-radius: var(--radius-xl) !important;
  overflow: hidden;
  box-shadow: var(--shadow-base);
}

.video-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-lg);
}

.video-thumbnail {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: #000;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.video-card:hover .thumbnail-img {
  transform: scale(1.05);
}

.default-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
}

.duration {
  position: absolute;
  bottom: var(--spacing-2);
  right: var(--spacing-2);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  backdrop-filter: blur(4px);
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  opacity: 0;
  transition: all var(--transition-normal);
  backdrop-filter: blur(2px);
}

.video-card:hover .play-overlay {
  opacity: 1;
}

.video-info {
  padding: var(--spacing-4);
}

.video-header {
  margin-bottom: var(--spacing-3);
}

.video-title {
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.video-meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin-bottom: var(--spacing-3);
}

.video-actions {
  display: flex;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-3);
  justify-content: flex-start;
}

.action-btn {
  flex: 1;
  font-size: var(--font-size-xs) !important;
  padding: var(--spacing-2) !important;
  border-radius: var(--radius-md) !important;
  font-weight: var(--font-weight-medium) !important;
}

.favorite-btn {
  border-color: var(--primary) !important;
  color: var(--primary) !important;
}

.favorite-btn.is-primary {
  background-color: var(--primary) !important;
  border-color: var(--primary) !important;
  color: white !important;
}

.delete-btn {
  background-color: var(--danger) !important;
  border-color: var(--danger) !important;
  color: white !important;
}

.video-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

.video-tag {
  font-size: var(--font-size-xs) !important;
  padding: var(--spacing-1) var(--spacing-2) !important;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.video-tag:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-sm);
}

/* 空状态 */
.empty-state {
  margin: var(--spacing-16) 0;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--spacing-4);
  }
}

@media (max-width: 768px) {
  .home {
    padding: var(--spacing-4);
  }
  
  .container {
    max-width: 100%;
  }
  
  .header {
    padding: var(--spacing-4);
    flex-direction: column;
    gap: var(--spacing-3);
    align-items: stretch;
  }
  
  .header-left {
    text-align: center;
  }
  
  .app-title {
    font-size: var(--font-size-xl);
    justify-content: center;
  }
  
  .header-actions {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .action-button {
    font-size: var(--font-size-sm) !important;
    padding: var(--spacing-2) var(--spacing-3) !important;
  }
  
  .scan-button {
    font-size: var(--font-size-sm) !important;
    padding: var(--spacing-2) var(--spacing-4) !important;
  }
  
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-3);
  }
  
  .video-title {
    font-size: var(--font-size-sm);
  }
  
  .video-actions {
    flex-direction: column;
    gap: var(--spacing-2);
  }
  
  .action-btn {
    font-size: var(--font-size-xs) !important;
    padding: var(--spacing-1) !important;
  }
  
  .video-meta {
    font-size: var(--font-size-xs);
  }
  
  .video-tag {
    font-size: var(--font-size-xs) !important;
    padding: var(--spacing-1) !important;
  }
  
  .section-title {
    font-size: var(--font-size-base);
  }
}

@media (max-width: 480px) {
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
  
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-button,
  .scan-button {
    width: 100%;
  }
  
  .tag-item {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-size-xs);
  }
  
  .tag-count {
    font-size: 10px;
    padding: 2px 4px;
  }
}
</style>
