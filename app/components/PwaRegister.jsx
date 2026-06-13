'use client';

import { useEffect } from 'react';

/**
 * 在客户端注册 Service Worker，满足 Android Chrome PWA 安装条件（需 HTTPS + manifest + SW）。
 * 仅在生产环境且浏览器支持时注册。
 */
export default function PwaRegister({ basePath = '', deploySha = '' }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') {
      return;
    }

    const normalizedBasePath = basePath.replace(/\/$/, '');
    const serviceWorkerUrl = `${normalizedBasePath}/sw.js`;
    const serviceWorkerScope = `${normalizedBasePath || ''}/`;
    const versionUrl = `${normalizedBasePath}/deploy-version.json?t=${Date.now()}`;

    navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: serviceWorkerScope, updateViaCache: 'none' })
      .then((reg) => {
        reg.update();
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {});

    if (deploySha) {
      fetch(versionUrl, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((version) => {
          if (!version?.sha || version.sha === deploySha) return;
          const url = new URL(window.location.href);
          if (url.searchParams.get('deploy') === version.sha) return;
          url.searchParams.set('deploy', version.sha);
          window.location.replace(url.toString());
        })
        .catch(() => {});
    }
  }, [basePath, deploySha]);

  return null;
}
