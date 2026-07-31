const { Pool } = require('pg');
const crypto = require('crypto');

// Supabase 连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// 同 IP 60 秒限发一条
const rateLimitMap = new Map();

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gravatar(email, size = 40) {
  if (!email) return `https://cravatar.cn/avatar/?s=${size}&d=mp`;
  const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `https://cravatar.cn/avatar/${hash}?s=${size}&d=mp`;
}

function buildNested(comments) {
  const map = {};
  const roots = [];
  for (const c of comments) {
    c.replies = [];
    c.avatar = gravatar(c.mail);
    c.comment = escapeHtml(c.comment);
    c.nick = escapeHtml(c.nick);
    map[c.id] = c;
  }
  for (const c of comments) {
    if (c.pid && map[c.pid]) {
      c.replyTo = map[c.pid].nick;
      map[c.pid].replies.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    if (event.httpMethod === 'GET') {
      // 管理后台：?admin=1 返回全部评论
      if (event.queryStringParameters?.admin === '1') {
        const pwd = event.headers['x-admin-password'] || '';
        if (pwd !== process.env.ADMIN_PASSWORD) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: '密码错误' }) };
        }
        const { rows } = await pool.query(
          `SELECT id, nick, mail, comment, url, pid, status, createdat
           FROM wl_comment ORDER BY createdat DESC`
        );
        const comments = rows.map(function(c) {
          c.avatar = gravatar(c.mail, 72);
          return c;
        });
        return { statusCode: 200, headers, body: JSON.stringify(comments) };
      }
      // 正常前台：按 url 返回已审核评论
      const url = event.queryStringParameters?.url || '/';
      const { rows } = await pool.query(
        `SELECT id, nick, mail, comment, url, pid, rid, createdat
         FROM wl_comment
         WHERE url = $1 AND status = 'approved'
         ORDER BY createdat ASC`,
        [url]
      );
      return { statusCode: 200, headers, body: JSON.stringify({ comments: buildNested(rows) }) };
    }

    if (event.httpMethod === 'POST') {
      const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';

      // 频率限制
      const lastTime = rateLimitMap.get(ip);
      if (lastTime && Date.now() - lastTime < 60000) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: '发送太快，请 60 秒后再试' }) };
      }

      let body;
      try { body = JSON.parse(event.body); } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '无效的请求数据' }) };
      }

      const nick = (body.nick || '').trim();
      const comment = (body.comment || '').trim();
      const mail = (body.mail || '').trim();
      const url = (body.url || '/').trim();
      const pid = body.pid ? parseInt(body.pid) : null;
      const rid = body.rid ? parseInt(body.rid) : null;

      if (!nick || !comment) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '昵称和内容不能为空' }) };
      }
      if (nick.length > 50 || comment.length > 5000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '昵称最长50字，内容最长5000字' }) };
      }

      const { rows } = await pool.query(
        `INSERT INTO wl_comment (nick, mail, comment, url, pid, rid, ip, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')
         RETURNING id, nick, mail, comment, url, pid, rid, ip, createdat`,
        [nick, mail, comment, url, pid, rid, ip]
      );

      rateLimitMap.set(ip, Date.now());
      const newComment = rows[0];
      newComment.avatar = gravatar(newComment.mail);

      return { statusCode: 201, headers, body: JSON.stringify({ success: true, comment: newComment }) };
    }

    if (event.httpMethod === 'DELETE') {
      const pwd = event.headers['x-admin-password'] || '';
      if (pwd !== process.env.ADMIN_PASSWORD) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: '密码错误' }) };
      }
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少评论ID' }) };
      await pool.query(`UPDATE wl_comment SET status = 'spam' WHERE id = $1`, [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: '方法不允许' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '服务器错误' }) };
  }
};
