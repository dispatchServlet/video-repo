const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const db = require('./db');

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg'];

class VideoScanner {
  constructor() {
    this.scanPaths = this.getScanPaths();
  }

  getScanPaths() {
    const configPath = path.join(__dirname, '../data/scan-paths.json');
    if (fs.existsSync(configPath)) {
      try {
        const paths = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // 确保返回的是数组且不为空
        if (Array.isArray(paths) && paths.length > 0) {
          return paths;
        }
      } catch (error) {
        console.error('读取扫描路径配置失败:', error);
      }
    }
    
    // 如果没有配置或配置无效，返回空数组
    return [];
  }

  saveScanPaths(paths) {
    const configPath = path.join(__dirname, '../data/scan-paths.json');
    fs.writeFileSync(configPath, JSON.stringify(paths, null, 2));
    this.scanPaths = paths;
  }

  // 扫描所有路径
  async scanAll() {
    const results = {
      added: 0,
      skipped: 0,
      errors: []
    };

    for (const scanPath of this.scanPaths) {
      if (fs.existsSync(scanPath)) {
        const result = await this.scanDirectory(scanPath);
        results.added += result.added;
        results.skipped += result.skipped;
        if (result.errors) results.errors.push(...result.errors);
      }
    }

    return results;
  }

  // 扫描单个目录
  async scanDirectory(dirPath, folderTag = null) {
    const results = { added: 0, skipped: 0, errors: [] };

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          if (entry.isDirectory()) {
            // 递归扫描子目录，使用当前文件夹名作为标签
            const subResult = await this.scanDirectory(fullPath, entry.name);
            results.added += subResult.added;
            results.skipped += subResult.skipped;
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (VIDEO_EXTENSIONS.includes(ext)) {
              const added = await this.addVideo(fullPath, folderTag);
              if (added) {
                results.added++;
              } else {
                results.skipped++;
              }
            }
          }
        } catch (err) {
          results.errors.push({ path: fullPath, error: err.message });
        }
      }
    } catch (err) {
      console.error(`扫描目录失败 ${dirPath}:`, err.message);
    }

    return results;
  }

  // 添加视频到数据库
  async addVideo(videoPath, folderTag = null) {
    // 检查是否已存在
    console.log(`Checking if video exists: ${videoPath}`);
    const existing = db.query('SELECT id FROM videos WHERE path = ?', [videoPath]);
    console.log(`Existing check result:`, existing);
    if (existing && existing.length > 0) {
      console.log(`Video already exists, skipping: ${videoPath}`);
      return false;
    }

    try {
      console.log(`Processing video: ${videoPath}`);
      
      const stats = fs.statSync(videoPath);
      console.log(`Video size: ${stats.size}`);
      
      const duration = await this.getVideoDuration(videoPath);
      console.log(`Video duration: ${duration}`);
      
      // 生成封面
      const thumbnailPath = await this.generateThumbnail(videoPath);
      console.log(`Thumbnail path: ${thumbnailPath}`);

      // 确定文件夹名称
      const folderName = folderTag || path.basename(path.dirname(videoPath));
      console.log(`Folder name: ${folderName}`);
      
      // 插入视频记录
      console.log(`Inserting video record...`);
      db.run(`
        INSERT INTO videos (path, filename, folder_name, duration, size, thumbnail_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [videoPath, path.basename(videoPath), folderName, duration, stats.size, thumbnailPath]);
      
      // 手动查询刚插入的视频ID
      const videoResult = db.query('SELECT id FROM videos WHERE path = ?', [videoPath]);
      const videoId = videoResult && videoResult.length > 0 ? videoResult[0].id : null;
      console.log(`Inserted video ID: ${videoId}`);

      // 添加文件夹标签
      if (folderName && videoId) {
        console.log(`Adding folder tag "${folderName}" to video "${path.basename(videoPath)}"`);
        const tagId = this.getOrCreateTag(folderName);
        console.log(`Created/got tag ID: ${tagId}`);
        if (tagId) {
          try {
            console.log(`Inserting tag association: video_id=${videoId}, tag_id=${tagId}`);
            db.run('INSERT OR IGNORE INTO video_tags (video_id, tag_id) VALUES (?, ?)', [videoId, tagId]);
            console.log(`Added tag association for video ID: ${videoId}`);
            // 验证关联是否成功
            const association = db.query('SELECT * FROM video_tags WHERE video_id = ? AND tag_id = ?', [videoId, tagId]);
            console.log(`Association verification:`, association);
          } catch (err) {
            console.error(`Failed to add tag association:`, err);
          }
        } else {
          console.error(`Failed to get tag ID for folder "${folderName}"`);
        }
      }

      console.log(`Successfully added video: ${videoPath}`);
      return true;
    } catch (err) {
      console.error(`添加视频失败 ${videoPath}:`, err);
      return false;
    }
  }

  // 获取视频时长
  getVideoDuration(videoPath) {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err || !metadata.format.duration) {
          resolve(0);
        } else {
          resolve(Math.floor(metadata.format.duration));
        }
      });
    });
  }

  // 生成视频封面
  async generateThumbnail(videoPath) {
    const thumbnailDir = path.join(__dirname, '../data/thumbnails');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    const filename = path.basename(videoPath, path.extname(videoPath));
    const thumbnailPath = path.join(thumbnailDir, `${filename}.jpg`);

    return new Promise((resolve) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['1'],
          filename: `${filename}.jpg`,
          folder: thumbnailDir,
          size: '320x180'
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', () => resolve(null));
    });
  }

  // 获取或创建标签
  getOrCreateTag(tagName) {
    try {
      let tag = db.query('SELECT id FROM tags WHERE name = ?', [tagName]);
      if (!tag || tag.length === 0) {
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const result = db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [tagName, color]);
        console.log(`Created new tag "${tagName}" with ID: ${result.lastInsertRowid}`);
        return result.lastInsertRowid;
      }
      console.log(`Found existing tag "${tagName}" with ID: ${tag[0].id}`);
      return tag[0].id;
    } catch (err) {
      console.error(`Error in getOrCreateTag:`, err.message);
      return null;
    }
  }

  // 生成关键帧截图
  async generateKeyframeThumbnail(videoPath, timestamp) {
    const thumbnailDir = path.join(__dirname, '../data/keyframes');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    const filename = `${path.basename(videoPath, path.extname(videoPath))}_${timestamp}`;
    const thumbnailPath = path.join(thumbnailDir, `${filename}.jpg`);

    return new Promise((resolve) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: `${filename}.jpg`,
          folder: thumbnailDir,
          size: '320x180'
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', () => resolve(null));
    });
  }

  // 清理不在扫描路径中的视频
  cleanupVideosNotInPaths(scanPaths) {
    try {
      // 获取所有视频
      const videos = db.query('SELECT id, path FROM videos WHERE is_deleted = 0');
      let cleanedCount = 0;

      for (const video of videos) {
        // 检查视频路径是否在任何扫描路径中
        const isInScanPath = scanPaths.some(scanPath => 
          video.path.startsWith(scanPath)
        );

        if (!isInScanPath) {
          // 删除不在扫描路径中的视频
          db.run('DELETE FROM videos WHERE id = ?', [video.id]);
          cleanedCount++;
        }
      }

      console.log(`清理了 ${cleanedCount} 个不在扫描路径中的视频`);
      return cleanedCount;
    } catch (error) {
      console.error('清理视频失败:', error);
      return 0;
    }
  }
}

module.exports = new VideoScanner();
