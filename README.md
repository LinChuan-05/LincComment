# LincComment

轻量 Hugo 博客评论系统 | 自部署 · 免费 · 开源

## 特性

- 零成本运行（Netlify Functions + Supabase 免费层）
- 同域部署，不被墙、不需要代理
- 嵌套回复 + Cravatar 头像（国内镜像）
- 管理后台（密码登录 + 删除评论）
- IP 频率限制 + XSS 防护
- 深色/浅色模式跟随主题

## 架构

浏览器 → GET/POST /.netlify/functions/comment → Netlify Function → Supabase

## 部署

### 1. Supabase

[supabase.com](https://supabase.com) 创建项目 → SQL Editor → 粘贴下方建表 SQL → Run

### 2. 复制文件到 Hugo 博客

```
your-blog/
├── netlify/functions/comment.js
├── static/js/comment.js
├── static/css/comment.css
├── static/admin/comment.html
└── layouts/partials/comment.html
```

### 3. 环境变量

Netlify → Environment variables：

| Key | Value |
|------|-------|
| DATABASE_URL | Supabase 连接池 URI |
| ADMIN_PASSWORD | 管理密码 |

### 4. hugo.toml

```toml
[params.page.comment]
  enable = true
  [params.page.comment.linc]
    enable = true
```

## 建表

```sql
CREATE TABLE wl_comment (
  id SERIAL PRIMARY KEY, nick varchar(255), mail varchar(255),
  comment text, url varchar(255), pid int, rid int,
  ip varchar(100), status varchar(50) DEFAULT 'approved',
  createdat timestamp DEFAULT CURRENT_TIMESTAMP
);
```

## 管理后台

https://你的域名/admin/comment.html

## License

MIT
