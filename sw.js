
/*
 * 手相クイズ用 Service Worker
 *
 * ・画像は初めて表示されたときに保存
 * ・2回目以降は保存済み画像を優先
 * ・通信できないときも保存済み画像を表示
 * ・HTML / CSS / JS も初回アクセス時に保存
 */

const CACHE_NAME = "tesouquiz-cache-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./mobile.css",
  "./mobile.js",
  "./script.js",
  "./components/palm-template.js",
  "./data/questions/life.js",
  "./data/questions/head.js",
  "./data/questions/heart.js",
  "./data/questions/marriage.js",
  "./data/questions/conversation.js",
  "./data/questions/other.js",
  "./data/questions/palmistry.js"
];

// インストール時にアプリ本体を保存
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const file of APP_FILES) {
        try {
          await cache.add(file);
        } catch (error) {
          // 一部ファイルの保存に失敗しても、
          // Service Worker のインストールを継続する
          console.warn("保存できませんでした:", file, error);
        }
      }
    })
  );

  self.skipWaiting();
});

// 古いバージョンのキャッシュを整理
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(async keys => {
      await Promise.all(
        keys
          .filter(key =>
            key.startsWith("tesouquiz-cache-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })
  );
});

// 画像はキャッシュ優先、それ以外はネットワーク優先
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 同じサイトのファイルだけを対象にする
  if (url.origin !== self.location.origin) return;

  // 画像ファイルのリクエスト
  if (request.destination === "image") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);

        if (response.ok || response.type === "opaque") {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        // オフラインで未保存の画像は表示できない
        return new Response("", {
          status: 503,
          statusText: "画像はまだ保存されていません"
        });
      }
    })());

    return;
  }

  // アプリ本体はキャッシュ済みならオフラインでも利用
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        return (
          await cache.match("./index.html") ||
          await cache.match("./")
        ) || new Response("オフラインです。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());

    return;
  }

  // CSS / JS などはキャッシュを利用し、通信可能なら更新
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const response = await fetch(request);

      if (response.ok) {
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      return (
        await cache.match(request) ||
        new Response("", { status: 503 })
      );
    }
  })());
});
