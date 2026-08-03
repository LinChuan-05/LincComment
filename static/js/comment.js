(function() {
  var API = '/.netlify/functions/comment';
  var url = document.getElementById('linc-url').value;
  var hToken = '';

  window.lincHcaptchaOK = function(token) { hToken = token; };

  function load() {
    fetch(API + '?url=' + encodeURIComponent(url))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        document.getElementById('linc-count').textContent = countAll(data.comments);
        render(data.comments, document.getElementById('linc-list'));
      });
  }

  function countAll(comments) {
    var n = 0;
    (function walk(list) {
      list.forEach(function(c) { n++; if (c.replies) walk(c.replies); });
    })(comments || []);
    return n;
  }

  function render(comments, container) {
    container.innerHTML = '';
    if (!comments || !comments.length) {
      container.innerHTML = '<p class="linc-empty">暂无评论，来抢沙发吧</p>';
      return;
    }
    comments.forEach(function(c) {
      var el = document.createElement('div');
      el.className = 'linc-item';
      el.innerHTML =
        '<img class="linc-avatar" src="' + c.avatar + '" alt="">' +
        '<div class="linc-body">' +
          '<div class="linc-meta"><strong>' + c.nick + '</strong><span>' + formatTime(c.createdAt) + '</span></div>' +
          '<div class="linc-content">' + (c.replyTo ? '<span class="linc-at">↳ @' + c.replyTo + '</span> ' : '') + c.comment + '</div>' +
          '<button class="linc-reply-btn" data-id="' + c.id + '" data-nick="' + c.nick + '">回复</button>' +
          '<div class="linc-replies"></div>' +
        '</div>';
      container.appendChild(el);

      el.querySelector('.linc-reply-btn').addEventListener('click', function() {
        document.getElementById('linc-pid').value = c.id;
        document.getElementById('linc-reply-to').innerHTML = '回复 @' + c.nick + ' <a href="javascript:void(0)" onclick="document.getElementById(\'linc-pid\').value=\'\';document.getElementById(\'linc-reply-to\').innerHTML=\'\'">取消</a>';
        document.getElementById('linc-text').focus();
      });

      if (c.replies && c.replies.length) {
        render(c.replies, el.querySelector('.linc-replies'));
      }
    });
  }

  function formatTime(t) {
    if (!t) return '';
    var d = new Date(t);
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function pad(n) { return n < 10 ? '0' + n : n; }

  document.getElementById('linc-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = document.getElementById('linc-submit');
    var nick = document.getElementById('linc-nick').value.trim();
    var mail = document.getElementById('linc-mail').value.trim();
    var text = document.getElementById('linc-text').value.trim();
    var pid = document.getElementById('linc-pid').value || null;

    if (!nick || !text) return alert('昵称和内容不能为空');
    if (!hToken) return alert('请先完成人机验证');

    btn.disabled = true;
    btn.textContent = '提交中...';

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick: nick, mail: mail, comment: text, url: url, pid: pid ? parseInt(pid) : null, hcaptcha: hToken })
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          document.getElementById('linc-text').value = '';
          document.getElementById('linc-pid').value = '';
          document.getElementById('linc-reply-to').innerHTML = '';
          hToken = '';
          hcaptcha.reset();
          toast(data.comment.needsApproval
            ? '评论已提交，审核通过后显示'
            : '评论发表成功');
          load();
        } else {
          alert(data.error || '发表失败');
          hToken = '';
          hcaptcha.reset();
        }
      })
      .catch(function() { alert('网络错误'); hToken = ''; hcaptcha.reset(); })
      .finally(function() { btn.disabled = false; btn.textContent = '发表评论'; });
  });

  function toast(msg) {
    var el = document.getElementById('linc-toast');
    if (!el) return;
    var t = document.createElement('div');
    t.className = 'linc-toast-msg'; t.textContent = msg;
    el.appendChild(t);
    setTimeout(function() { t.classList.add('out'); }, 2500);
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }

  load();
})();
