const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const scanner = require('./scanner');
const db = require('./db');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 静态文件服务
app.use('/client', express.static(path.join(__dirname, '../client/dist')));
app.use('/data/thumbnails', express.static(path.join(__dirname, '../data/thumbnails')));
app.use('/data/keyframes', express.static(path.join(__dirname, '../data/keyframes')));

// 视频流式传输
app.get('/api/video/stream', (req, res) => {
  const videoPath = req.query.path;
  
  if (!videoPath || !fs.existsSync(videoPath)) {
    return res.status(404).json({ error: '视频文件不存在' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    
    const headers = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    };
    
    res.writeHead(206, headers);
    file.pipe(res);
  } else {
    const headers = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    };
    res.writeHead(200, headers);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// 获取所有视频（未删除的）
app.get('/api/videos', (req, res) => {
  try {
    const videos = db.query(`
      SELECT v.*, 
        GROUP_CONCAT(t.name) as tags,
        GROUP_CONCAT(t.color) as tag_colors
      FROM videos v
      LEFT JOIN video_tags vt ON v.id = vt.video_id
      LEFT JOIN tags t ON vt.tag_id = t.id
      WHERE v.is_deleted = 0
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `);

    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取已删除视频
app.get('/api/videos/deleted', (req, res) => {
  try {
    const videos = db.query(`
      SELECT v.*, 
        GROUP_CONCAT(t.name) as tags,
        GROUP_CONCAT(t.color) as tag_colors
      FROM videos v
      LEFT JOIN video_tags vt ON v.id = vt.video_id
      LEFT JOIN tags t ON vt.tag_id = t.id
      WHERE v.is_deleted = 1
      GROUP BY v.id
      ORDER BY v.updated_at DESC
    `);

    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取最近播放的视频
app.get('/api/videos/history', (req, res) => {
  try {
    const videos = db.query(`
      SELECT v.*, 
        GROUP_CONCAT(t.name) as tags,
        GROUP_CONCAT(t.color) as tag_colors
      FROM videos v
      LEFT JOIN video_tags vt ON v.id = vt.video_id
      LEFT JOIN tags t ON vt.tag_id = t.id
      WHERE v.is_deleted = 0 AND v.last_played_at IS NOT NULL
      GROUP BY v.id
      ORDER BY v.last_played_at DESC
      LIMIT 10
    `);

    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 收藏/取消收藏视频
app.patch('/api/videos/:id/favorite', (req, res) => {
  try {
    const { is_favorite } = req.body;
    db.run('UPDATE videos SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [is_favorite ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除视频（标记为已删除）
app.delete('/api/videos/:id/soft', (req, res) => {
  try {
    db.run('UPDATE videos SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 恢复已删除视频
app.patch('/api/videos/:id/restore', (req, res) => {
  try {
    db.run('UPDATE videos SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 彻底删除视频
app.delete('/api/videos/:id/force', (req, res) => {
  try {
    db.run('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 搜索视频
app.get('/api/videos/search', (req, res) => {
  try {
    const { q, tag } = req.query;
    let query = `
      SELECT v.*, 
        GROUP_CONCAT(t.name) as tags,
        GROUP_CONCAT(t.color) as tag_colors
      FROM videos v
      LEFT JOIN video_tags vt ON v.id = vt.video_id
      LEFT JOIN tags t ON vt.tag_id = t.id
    `;
    
    const conditions = [];
    const params = [];

    if (q) {
      conditions.push('v.filename LIKE ?');
      params.push(`%${q}%`);
    }

    if (tag) {
      conditions.push('t.name = ?');
      params.push(tag);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY v.id ORDER BY v.created_at DESC';

    const videos = db.query(query, params);
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个视频详情
app.get('/api/videos/:id', (req, res) => {
  try {
    const video = db.query('SELECT * FROM videos WHERE id = ?', [req.params.id])[0];
    if (!video) {
      return res.status(404).json({ error: '视频不存在' });
    }

    // 更新播放次数
    db.run('UPDATE videos SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

    // 获取标签
    const tags = db.query(`
      SELECT t.* FROM tags t
      JOIN video_tags vt ON t.id = vt.tag_id
      WHERE vt.video_id = ?
    `, [req.params.id]);

    // 获取关键帧
    const keyframes = db.query('SELECT * FROM keyframes WHERE video_id = ? ORDER BY timestamp', [req.params.id]);

    res.json({ ...video, tags, keyframes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加标签到视频
app.post('/api/videos/:id/tags', (req, res) => {
  try {
    const { tagName } = req.body;
    if (!tagName) {
      return res.status(400).json({ error: '标签名不能为空' });
    }

    // 获取或创建标签
    let tag = db.query('SELECT id FROM tags WHERE name = ?', [tagName]);
    let tagId;
    if (!tag || tag.length === 0) {
      const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const result = db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [tagName, color]);
      tagId = result.lastInsertRowid;
    } else {
      tagId = tag[0].id;
    }

    db.run('INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)', [req.params.id, tagId]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 移除视频标签
app.delete('/api/videos/:id/tags/:tagId', (req, res) => {
  try {
    db.run('DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?', [req.params.id, req.params.tagId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加关键帧
app.post('/api/videos/:id/keyframes', async (req, res) => {
  try {
    console.log('Received keyframe request:', req.body);
    const { timestamp, label } = req.body;
    console.log('Timestamp:', timestamp, 'Type:', typeof timestamp);
    const video = db.query('SELECT * FROM videos WHERE id = ?', [req.params.id])[0];
    
    if (!video) {
      return res.status(404).json({ error: '视频不存在' });
    }

    const thumbnailPath = await scanner.generateKeyframeThumbnail(video.path, timestamp);
    
    const result = db.run(`
      INSERT INTO keyframes (video_id, timestamp, label, thumbnail_path)
      VALUES (?, ?, ?, ?)
    `, [req.params.id, timestamp, label || '', thumbnailPath]);

    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      thumbnailPath 
    });
  } catch (err) {
    console.error('Error adding keyframe:', err);
    res.status(500).json({ error: err.message });
  }
});

// 删除关键帧
app.delete('/api/videos/:videoId/keyframes/:id', (req, res) => {
  try {
    db.run('DELETE FROM keyframes WHERE id = ? AND video_id = ?', [req.params.id, req.params.videoId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取所有标签
app.get('/api/tags', (req, res) => {
  try {
    const tags = db.query('SELECT * FROM tags ORDER BY name');
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加系统标签
app.post('/api/tags/system', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: '标签名不能为空' });
    }

    // 检查是否已存在
    let existing = db.query('SELECT id FROM tags WHERE name = ?', [name]);
    if (existing && existing.length > 0) {
      return res.json({ success: true, id: existing[0].id });
    }

    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140'];
    const tagColor = color || colors[Math.floor(Math.random() * colors.length)];
    
    const result = db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name, tagColor]);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 扫描视频库
app.post('/api/scan', async (req, res) => {
  try {
    const result = await scanner.scanAll();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取扫描路径配置
app.get('/api/scan-paths', (req, res) => {
  try {
    const paths = scanner.getScanPaths();
    res.json(paths);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新扫描路径配置
app.post('/api/scan-paths', (req, res) => {
  try {
    const { paths } = req.body;
    if (!Array.isArray(paths)) {
      return res.status(400).json({ error: '路径必须是数组' });
    }
    scanner.saveScanPaths(paths);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除视频记录
app.delete('/api/videos/:id', (req, res) => {
  try {
    db.run('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除标签（从所有视频中移除）
app.delete('/api/tags/:id', (req, res) => {
  try {
    // 先从 video_tags 中删除关联
    db.run('DELETE FROM video_tags WHERE tag_id = ?', [req.params.id]);
    // 再删除标签本身
    db.run('DELETE FROM tags WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取统计数据
app.get('/api/stats', (req, res) => {
  try {
    const totalVideos = db.query('SELECT COUNT(*) as count FROM videos')[0].count;
    const totalTags = db.query('SELECT COUNT(*) as count FROM tags')[0].count;
    const totalKeyframes = db.query('SELECT COUNT(*) as count FROM keyframes')[0].count;
    const totalFolders = db.query('SELECT COUNT(DISTINCT folder_name) as count FROM videos')[0].count;
    
    res.json({
      total: totalVideos,
      tags: totalTags,
      keyframes: totalKeyframes,
      folders: totalFolders
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 记录视频播放
app.post('/api/videos/:id/play', (req, res) => {
  try {
    db.run('UPDATE videos SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// 初始化项目
app.post('/api/init', async (req, res) => {
  try {
    // 清空数据库表数据
    db.run('DELETE FROM keyframes');
    db.run('DELETE FROM video_tags');
    db.run('DELETE FROM tags');
    db.run('DELETE FROM videos');
    db.run('DELETE FROM scan_history');

    // 删除缓存文件
    const keyframesDir = path.join(__dirname, '../data/keyframes');
    const thumbnailsDir = path.join(__dirname, '../data/thumbnails');

    if (fs.existsSync(keyframesDir)) {
      const keyframeFiles = fs.readdirSync(keyframesDir);
      keyframeFiles.forEach(file => {
        fs.unlinkSync(path.join(keyframesDir, file));
      });
    }

    if (fs.existsSync(thumbnailsDir)) {
      const thumbnailFiles = fs.readdirSync(thumbnailsDir);
      thumbnailFiles.forEach(file => {
        fs.unlinkSync(path.join(thumbnailsDir, file));
      });
    }

    // 不自动扫描视频，由用户手动触发
    
    res.json({ 
      success: true, 
      message: '项目初始化完成，请手动扫描视频库',
      scanResult: {
        added: 0,
        skipped: 0,
        errors: 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 启动时自动扫描
async function startup() {
  console.log('🎬 视频仓库启动中...');
  
  // 初始化数据库
  await db.initDB();
  
  // 确保数据目录存在
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 自动扫描新增视频
  console.log('📁 扫描视频库...');
  try {
    const result = await scanner.scanAll();
    console.log(`✅ 扫描完成：新增 ${result.added} 个视频，跳过 ${result.skipped} 个`);
  } catch (err) {
    console.error('扫描失败:', err.message);
  }

  // 启动服务器
  app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📺 API 地址：http://localhost:${PORT}/api`);
  });
}

startup();
