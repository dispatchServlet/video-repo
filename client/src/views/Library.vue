<template>
  <div class="library">
    <div class="container">
      <!-- 头部 -->
      <header class="header">
        <h1>📚 视频库管理</h1>
        <div class="header-actions">
          <el-button @click="$router.push('/')">← 返回首页</el-button>
          <el-button type="primary" @click="loadVideos">🔄 刷新</el-button>
        </div>
      </header>

      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            placeholder="搜索视频..."
            clearable
            @input="handleSearch"
          >
            <template #prefix>🔍</template>
          </el-input>
        </div>
        
        <div class="filter-box">
          <el-select v-model="selectedTag" placeholder="筛选标签" clearable @change="handleSearch">
            <el-option
              v-for="tag in tags"
              :key="tag.id"
              :label="tag.name"
              :value="tag.name"
            >
              <span :style="{ color: tag.color }">●</span> {{ tag.name }}
            </el-option>
          </el-select>
          
          <el-select v-model="sortBy" placeholder="排序" @change="handleSearch">
            <el-option label="最新添加" value="newest" />
            <el-option label="最旧添加" value="oldest" />
            <el-option label="文件名 A-Z" value="name" />
            <el-option label="播放最多" value="played" />
          </el-select>
        </div>
      </div>

      <!-- 视频表格 -->
      <el-table :data="filteredVideos" stripe style="width: 100%" v-loading="loading">
        <el-table-column label="封面" width="120">
          <template #default="{ row }">
            <div class="thumbnail-cell" @click="playVideo(row.id)" style="cursor: pointer;">
              <img 
                v-if="row.thumbnail_path" 
                :src="`/data/thumbnails/${getThumbnailName(row.thumbnail_path)}`" 
                @error="showDefaultThumbnail"
              />
              <div v-else class="default-thumbnail">🎬</div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div @click="playVideo(row.id)" style="cursor: pointer;">{{ row.filename }}</div>
          </template>
        </el-table-column>
        
        <el-table-column prop="folder_name" label="文件夹" width="120" />
        
        <el-table-column label="时长" width="80">
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>
        
        <el-table-column label="大小" width="100">
          <template #default="{ row }">
            {{ formatSize(row.size) }}
          </template>
        </el-table-column>
        
        <el-table-column label="播放次数" width="80">
          <template #default="{ row }">
            {{ row.play_count || 0 }}
          </template>
        </el-table-column>
        
        <el-table-column label="标签" min-width="150">
          <template #default="{ row }">
            <div class="table-tags">
              <el-tag
                v-for="tag in parseTags(row.tags, row.tag_colors)"
                :key="tag.name"
                size="small"
                :style="{ backgroundColor: tag.color, borderColor: tag.color, color: 'white' }"
              >
                {{ tag.name }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              :type="row.is_favorite ? 'primary' : 'default'"
              @click="toggleFavorite(row)"
            >
              {{ row.is_favorite ? '已收藏' : '收藏' }}
            </el-button>
            <el-button size="small" type="danger" @click="deleteVideo(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="filteredVideos.length"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

export default {
  name: 'Library',
  setup() {
    const router = useRouter()
    const videos = ref([])
    const tags = ref([])
    const loading = ref(false)
    const searchQuery = ref('')
    const selectedTag = ref('')
    const sortBy = ref('newest')
    const currentPage = ref(1)
    const pageSize = ref(20)

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
        result = result.filter(v => 
          v.tags && v.tags.includes(selectedTag.value)
        )
      }
      
      // 排序
      switch (sortBy.value) {
        case 'newest':
          result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          break
        case 'oldest':
          result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          break
        case 'name':
          result.sort((a, b) => a.filename.localeCompare(b.filename))
          break
        case 'played':
          result.sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
          break
      }
      
      return result
    })

    const loadVideos = async () => {
      loading.value = true
      try {
        const res = await api.getVideos()
        videos.value = res.data
      } catch (err) {
        ElMessage.error('加载失败：' + err.message)
      } finally {
        loading.value = false
      }
    }

    const loadTags = async () => {
      try {
        const res = await api.getTags()
        tags.value = res.data
      } catch (err) {
        console.error('加载标签失败:', err)
      }
    }

    const handleSearch = () => {
      currentPage.value = 1
    }

    const playVideo = (id) => {
      router.push(`/player/${id}`)
    }

    const deleteVideo = async (id) => {
      try {
        await ElMessageBox.confirm('确定删除这个视频吗？（仅删除记录，不删除文件）', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        
        await api.deleteVideo(id)
        await loadVideos()
        ElMessage.success('已删除')
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('删除失败：' + err.message)
        }
      }
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

    const showDefaultThumbnail = (e) => {
      e.target.style.display = 'none'
    }

    onMounted(() => {
      loadVideos()
      loadTags()
    })

    return {
      videos,
      tags,
      loading,
      searchQuery,
      selectedTag,
      sortBy,
      currentPage,
      pageSize,
      filteredVideos,
      loadVideos,
      handleSearch,
      playVideo,
      deleteVideo,
      toggleFavorite,
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
.library {
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

.toolbar {
  background: var(--bg-secondary);
  padding: var(--spacing-4);
  border-radius: var(--radius-2xl);
  margin-bottom: var(--spacing-6);
  box-shadow: var(--shadow-lg);
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-4);
  flex-wrap: wrap;
  transition: all var(--transition-normal);
}

.search-box {
  flex: 1;
  min-width: 250px;
  max-width: 400px;
}

.filter-box {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.filter-box .el-select {
  width: 180px;
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.thumbnail-cell {
  width: 100px;
  height: 56px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: #000;
  transition: all var(--transition-fast);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.thumbnail-cell:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

.thumbnail-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all var(--transition-fast);
}

.default-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: var(--primary);
  color: white;
  transition: all var(--transition-fast);
}

.thumbnail-cell:hover .default-thumbnail {
  background: var(--primary-light);
}

.table-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.table-tags .el-tag {
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  transition: all var(--transition-fast);
}

.table-tags .el-tag:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.pagination {
  margin-top: var(--spacing-6);
  display: flex;
  justify-content: center;
}

:deep(.el-table) {
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-normal);
}

:deep(.el-table:hover) {
  box-shadow: var(--shadow-xl);
}

:deep(.el-table__header-wrapper) {
  background: var(--bg-tertiary);
}

:deep(.el-table th) {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  padding: var(--spacing-3);
}

:deep(.el-table td) {
  padding: var(--spacing-3);
  transition: all var(--transition-fast);
}

:deep(.el-table tr:hover td) {
  background: var(--bg-tertiary);
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

:deep(.el-input) {
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

:deep(.el-input:focus-within) {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

:deep(.el-select) {
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

:deep(.el-select:focus-within) {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

@media (max-width: 768px) {
  .library {
    padding: var(--spacing-4);
  }
  
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box {
    max-width: 100%;
  }
  
  .filter-box {
    justify-content: space-between;
  }
  
  .filter-box .el-select {
    flex: 1;
  }
}
</style>
