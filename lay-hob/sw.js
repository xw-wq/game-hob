/* ═══════════════════════════════════════════════════════════
   Service Worker · 网络优先 + 离线兜底
   更新机制：每次打开页面主动拉最新文件，断网时用缓存兜底
   ═══════════════════════════════════════════════════════════ */

const CACHE = 'game-hub-v2';

const ASSETS = [
  './',
  './index.html',
  './brass-birmingham.html',
  './monopoly.html',
  './script-kill.html',
  './tarot.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* 安装：预缓存所有资源 */
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(
        ASSETS.map(function(url){
          return c.add(url).catch(function(err){
            console.warn('[SW] 缓存失败:', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

/* 激活：清理旧版本缓存 */
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

/* 请求拦截：网络优先，缓存兜底 */
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;

  var url;
  try { url = new URL(e.request.url); } catch(err) { return; }

  // 跨域请求（PeerJS CDN 等）直接放行，不缓存
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request).then(function(res){
      // 网络成功 → 顺便更新缓存 → 返回最新内容
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function(c){
          c.put(e.request, copy).catch(function(){});
        });
      }
      return res;
    }).catch(function(){
      // 网络失败（离线）→ 用缓存
      return caches.match(e.request).then(function(cached){
        if (cached) return cached;
        // 只有页面导航请求才回退到首页
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 404 });
      });
    })
  );
});

/* 备用：收到 SKIP_WAITING 消息时立即接管 */
self.addEventListener('message', function(e){
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});