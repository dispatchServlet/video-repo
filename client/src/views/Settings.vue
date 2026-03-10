<template>
  <div class="settings">
    <div class="container">
      <!-- 头部 -->
      <header class="header">
        <h1>⚙️ 设置</h1>
        <div class="header-actions">
          <el-button @click="$router.push('/')">← 返回首页</el-button>
        </div>
      </header>

      <!-- 设置布局 -->
      <div class="settings-layout">
        <!-- 设置菜单 -->
        <div class="settings-menu">
          <el-menu :default-active="activeTab" class="el-menu-vertical-demo" @select="handleMenuSelect">
            <el-menu-item index="theme">
              <el-icon><Sunny /></el-icon>
              <span>主题配色</span>
            </el-menu-item>
            <el-menu-item index="tags">
              <el-icon><Collection /></el-icon>
              <span>标签管理</span>
            </el-menu-item>
            <el-menu-item index="init">
              <el-icon><Refresh /></el-icon>
              <span>初始化项目</span>
            </el-menu-item>
          </el-menu>
        </div>

        <!-- 设置内容 -->
        <div class="settings-content">
        <!-- 主题设置 -->
        <div v-if="activeTab === 'theme'" class="setting-section">
          <h2>🎨 主题配色</h2>
          <div class="theme-options">
            <div 
              v-for="theme in themeOptions" 
              :key="theme.name"
              class="theme-item"
              :class="{ active: currentTheme === theme.name }"
              @click="changeTheme(theme)"
            >
              <div class="theme-preview" :style="{ background: theme.gradient }"></div>
              <div class="theme-name">{{ theme.label }}</div>
            </div>
          </div>
        </div>

        <!-- 标签管理 -->
        <div v-if="activeTab === 'tags'" class="setting-section">
          <!-- 统计信息 -->
          <div class="stats-bar">
            <el-card shadow="hover">
              <span>📊 总标签数：</span>
              <strong>{{ allTags.length }}</strong>
              <span style="margin: 0 20px;">|</span>
              <span>🎬 涉及视频：</span>
              <strong>{{ videosWithTagCount }}</strong>
              <span style="margin: 0 20px;">|</span>
              <span>🗑️ 未使用标签：</span>
              <strong style="color: #f56c6c">{{ unusedTags.length }}</strong>
            </el-card>
          </div>

          <!-- 工具栏 -->
          <div class="toolbar">
            <el-input
              v-model="searchQuery"
              placeholder="搜索标签..."
              clearable
              style="width: 300px"
            >
              <template #prefix>🔍</template>
            </el-input>
            
            <el-button type="success" @click="showAddDialog = true">➕ 新增标签</el-button>
            
            <el-button 
              v-if="selectedTags.length > 0" 
              type="danger" 
              @click="batchDeleteTags"
            >
              🗑️ 批量删除（{{ selectedTags.length }}）
            </el-button>
          </div>

          <!-- 标签列表 -->
          <el-table
            :data="filteredTags"
            stripe
            style="width: 100%"
            v-loading="loading"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="55" />
            
            <el-table-column label="标签名称" min-width="150">
              <template #default="{ row }">
                <el-tag :type="getTypeByColor(row.color)">
                  <span :style="{ color: row.color, marginRight: '8px' }">●</span>
                  {{ row.name }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column label="颜色" width="100">
              <template #default="{ row }">
                <span style="display: inline-block; width: 30px; height: 30px; border-radius: 50%; background: {{ row.color }}; vertical-align: middle;"></span>
                <span style="font-size: 12px; color: #999;">{{ row.color }}</span>
              </template>
            </el-table-column>
            
            <el-table-column label="关联视频数" width="120">
              <template #default="{ row }">
                <el-tag :type="getTagCountType(row.tagVideosCount)">{{ row.tagVideosCount }}</el-tag>
              </template>
            </el-table-column>
            
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.tagVideosCount === 0" type="info">未使用</el-tag>
                <el-tag v-else type="success">已使用</el-tag>
              </template>
            </el-table-column>
            
            <el-table-column label="创建时间" width="160">
              <template #default="{ row }">
                {{ formatTime(row.created_at) }}
              </template>
            </el-table-column>
            
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteTag(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="filteredTags.length"
              :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next"
            />
          </div>

          <!-- 新增/编辑对话框 -->
          <el-dialog v-model="showAddDialog" :title="dialogTitle" width="400px">
            <el-form :model="tagForm" label-width="100px">
              <el-form-item label="标签名称" required>
                <el-input v-model="tagForm.name" placeholder="输入标签名称" />
              </el-form-item>
              
              <el-form-item label="标签颜色">
                <el-color-picker v-model="tagForm.color" show-alpha />
              </el-form-item>
              
              <el-form-item label="描述">
                <el-input v-model="tagForm.description" type="textarea" placeholder="标签描述（可选）" />
              </el-form-item>
            </el-form>
            
            <template #footer>
              <el-button @click="showAddDialog = false">取消</el-button>
              <el-button type="primary" @click="saveTag">确定</el-button>
            </template>
          </el-dialog>
        </div>

        <!-- 初始化项目 -->
        <div v-if="activeTab === 'init'" class="setting-section">
          <h2>🔄 初始化项目</h2>
          <el-card shadow="hover" class="init-card">
            <div class="init-content">
              <el-alert
                title="警告：此操作将清空所有数据！"
                type="warning"
                show-icon
                :closable="false"
                style="margin-bottom: 20px"
              />
              <p style="margin-bottom: 20px; color: #666;">
                初始化项目将会：
              </p>
              <ul style="margin-bottom: 30px; color: #666; list-style: disc; padding-left: 20px;">
                <li>清空所有视频记录</li>
                <li>清空所有标签</li>
                <li>清空所有关键帧</li>
                <li>删除所有缓存文件</li>
              </ul>
              <el-button type="danger" size="large" @click="initProject">
                🗑️ 执行初始化
              </el-button>
            </div>
          </el-card>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Sunny, Collection, Refresh } from '@element-plus/icons-vue'
import api from '../api'

export default {
  name: 'Settings',
  setup() {
    const loading = ref(false)
    const allTags = ref([])
    const searchQuery = ref('')
    const selectedTags = ref([])
    const currentPage = ref(1)
    const pageSize = ref(20)
    const showAddDialog = ref(false)
    const dialogTitle = ref('新增标签')
    const tagForm = ref({ id: null, name: '', color: '#667eea', description: '' })
    
    const activeTab = ref('theme')
    const currentTheme = ref(localStorage.getItem('theme') || 'purple')
    const themeOptions = [
      { name: 'purple', label: '梦幻紫', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
      { name: 'blue', label: '海洋蓝', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
      { name: 'green', label: '森林绿', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
      { name: 'orange', label: '活力橙', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
      { name: 'red', label: '玫瑰红', gradient: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)' },
      { name: 'dark', label: '暗夜黑', gradient: 'linear-gradient(135deg, #434343 0%, #000000 100%)' }
    ]
    
    // 统计使用中的标签数量
    const videosWithTagCount = computed(() => {
      let count = 0
      allTags.value.forEach(tag => {
        if (tag.tagVideosCount > 0) count++
      })
      return count
    })

    // 未使用的标签
    const unusedTags = computed(() => {
      return allTags.value.filter(tag => tag.tagVideosCount === 0)
    })

    // 过滤标签
    const filteredTags = computed(() => {
      let result = [...allTags.value]
      
      if (searchQuery.value) {
        result = result.filter(tag => 
          tag.name.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      }
      
      // 分页
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      return result.slice(start, end)
    })

    const loadTags = async () => {
      loading.value = true
      try {
        const res = await api.getTags()
        // 获取所有视频来计算每个标签的视频数量
        const videosRes = await api.getVideos()
        const videos = videosRes.data
        
        // 为每个标签计算关联的视频数
        const tagStats = {}
        videos.forEach(video => {
          if (video.tags) {
            const tags = video.tags.split(',')
            tags.forEach(tagName => {
              if (tagStats[tagName]) {
                tagStats[tagName]++
              } else {
                tagStats[tagName] = 1
              }
            })
          }
        })
        
        allTags.value = res.data.map(tag => ({
          ...tag,
          tagVideosCount: tagStats[tag.name] || 0
        }))
      } catch (err) {
        ElMessage.error('加载失败：' + err.message)
      } finally {
        loading.value = false
      }
    }

    const getTypeByColor = (color) => {
      const colors = ['#eb3349', '#f5576c', '#fa709a', '#f093fb']
      return colors.includes(color) ? 'danger' : 'primary'
    }

    const getTagCountType = (count) => {
      if (count === 0) return 'info'
      if (count < 5) return 'warning'
      return 'success'
    }

    const formatTime = (timeStr) => {
      if (!timeStr) return '-'
      const date = new Date(timeStr)
      return date.toLocaleString('zh-CN')
    }

    const changeTheme = (theme) => {
      currentTheme.value = theme.name
      localStorage.setItem('theme', theme.name)
      document.body.style.background = theme.gradient
      ElMessage.success(`已切换到${theme.label}主题`)
    }

    const handleMenuSelect = (key) => {
      activeTab.value = key
    }

    const handleSelectionChange = (rows) => {
      selectedTags.value = rows.map(row => row.id)
    }

    const showEditDialog = (tag) => {
      tagForm.value = { ...tag }
      dialogTitle.value = '编辑标签'
      showAddDialog.value = true
    }

    const deleteTag = async (tag) => {
      try {
        await ElMessageBox.confirm(
          `确定要删除标签 "${tag.name}" 吗？\n这将从所有视频中移除该标签。`,
          '警告',
          {
            confirmButtonText: '确定删除',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        // 删除标签（会从所有视频中移除）
        await api.deleteTag(tag.id)
        await loadTags()
        ElMessage.success('标签已删除')
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('删除失败：' + err.message)
        }
      }
    }

    const batchDeleteTags = async () => {
      try {
        await ElMessageBox.confirm(
          `确定要删除选中的 ${selectedTags.value.length} 个标签吗？`,
          '警告',
          {
            confirmButtonText: '确定删除',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        for (const tagId of selectedTags.value) {
          await api.deleteTag(tagId)
        }
        
        selectedTags.value = []
        await loadTags()
        ElMessage.success(`已删除 ${selectedTags.value.length} 个标签`)
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('删除失败：' + err.message)
        }
      }
    }

    const saveTag = async () => {
      if (!tagForm.value.name.trim()) {
        ElMessage.warning('请输入标签名称')
        return
      }

      try {
        // 这里可以扩展 API 支持更新标签
        // 当前只能删除后重新创建
        ElMessage.info('注意：修改标签名需要先删除原标签再创建新标签')
        showAddDialog.value = false
        
        // 如果是要改名，先删除旧的
        if (tagForm.value.id && tagForm.value.name !== allTags.value.find(t => t.id === tagForm.value.id)?.name) {
          await deleteTag(allTags.value.find(t => t.id === tagForm.value.id))
        }
        
        // 创建新的
        const res = await api.addTagToSystem(tagForm.value.name.trim(), tagForm.value.color)
        await loadTags()
        ElMessage.success('保存成功')
      } catch (err) {
        ElMessage.error('保存失败：' + err.message)
      }
    }

    const initProject = async () => {
      try {
        await ElMessageBox.confirm(
          '确定要初始化项目吗？\n这将清空所有视频、标签、关键帧数据和缓存文件。\n操作不可恢复！',
          '警告',
          {
            confirmButtonText: '确定初始化',
            cancelButtonText: '取消',
            type: 'warning',
            dangerouslyUseHTMLString: true
          }
        )
        
        loading.value = true
        await api.initProject()
        ElMessage.success('项目初始化完成')
        // 重新加载标签数据
        await loadTags()
        // 跳转到首页
        window.location.href = '/'
      } catch (err) {
        if (err !== 'cancel') {
          ElMessage.error('初始化失败：' + err.message)
        }
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      loadTags()
    })

    return {
      loading,
      allTags,
      searchQuery,
      selectedTags,
      filteredTags,
      currentPage,
      pageSize,
      showAddDialog,
      dialogTitle,
      tagForm,
      videosWithTagCount,
      unusedTags,
      getTypeByColor,
      getTagCountType,
      formatTime,
      handleSelectionChange,
      showEditDialog,
      deleteTag,
      batchDeleteTags,
      saveTag,
      initProject,
      currentTheme,
      themeOptions,
      changeTheme,
      activeTab,
      handleMenuSelect
    }
  }
}
</script>

<style scoped>
.settings {
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

.settings-layout {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.settings-menu {
  flex: 0 0 250px;
  background: white;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  overflow: hidden;
}

.settings-content {
  flex: 1;
  background: white;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  padding: 20px;
  min-height: 600px;
}

.setting-section {
  padding: 20px 0;
}

.setting-section h2 {
  color: #667eea;
  margin-bottom: 20px;
  font-size: 20px;
}

.stats-bar {
  margin-bottom: 20px;
}

.toolbar {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
  display: flex;
  gap: 15px;
  align-items: center;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

:deep(.el-table) {
  border-radius: 10px;
  overflow: hidden;
}

:deep(.el-menu-vertical-demo) {
  border-right: none;
}

:deep(.el-menu-item) {
  margin: 10px;
  border-radius: 10px;
  height: 50px;
  line-height: 40px;
}

:deep(.el-menu-item.is-active) {
  background-color: #f0f2f5;
  color: #667eea;
}

.theme-options {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.theme-item {
  cursor: pointer;
  padding: 10px;
  border-radius: 10px;
  border: 3px solid transparent;
  transition: all 0.3s;
}

.theme-item:hover {
  transform: scale(1.05);
}

.theme-item.active {
  border-color: #409eff;
}

.theme-preview {
  width: 100px;
  height: 60px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.theme-name {
  text-align: center;
  font-size: 14px;
  color: #333;
}

.init-card {
  max-width: 600px;
  margin: 0 auto;
}

.init-content {
  text-align: center;
  padding: 40px 20px;
}
</style>
