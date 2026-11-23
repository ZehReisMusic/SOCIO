// Atualizador da PWA: não altera ou remove dados do usuário.
export const APP_VERSION = 'V003.26';
const VERSION_FILE = new URL('../version.json', import.meta.url);
const WORKER_FILE = new URL('../service-worker.js', import.meta.url);
const RELOAD_GUARD_KEY = 'socio.reload.guard';
let notify = () => {};
let isBusy = () => false;
let runningCheck = null;
let pendingVersion = '';
let refreshing = false;
let hadController = false;
let lastForegroundCheck = 0;

function versionNumber(value) {
  const match = /^V(\d+)(?:\.(\d+))?$/.exec(String(value || ''));
  return match ? Number(match[1]) * 1000 + Number(match[2] || 0) : 0;
}
function refreshApp(target, manual = false) {
  if (refreshing) return;
  if (isBusy()) {
    pendingVersion = target;
    notify('Uma atualização está pronta. Feche o formulário para aplicá-la sem perder sua edição.');
    return;
  }
  try {
    const previous = JSON.parse(sessionStorage.getItem(RELOAD_GUARD_KEY) || 'null');
    if (!manual && previous && previous.target === target && Date.now() - previous.when < 45000) {
      return; // Evita recargas em loop quando o GitHub Pages ainda está propagando arquivos.
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({target, when: Date.now()}));
  } catch (_) { /* Safari pode restringir sessionStorage; a atualização continua. */ }
  refreshing = true;
  const url = new URL(location.href);
  url.searchParams.set('socio_atualizacao', String(Date.now()));
  location.replace(url.href);
}
export function applyDeferredUpdate() {
  if (pendingVersion && !isBusy()) {
    const pending = pendingVersion;
    pendingVersion = '';
    refreshApp(pending);
  }
}
async function refreshServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) await reg.update();
}
export async function checkForUpdates({manual = false} = {}) {
  if (runningCheck) {
    await runningCheck;
    if (manual) notify('A verificação de atualização já foi realizada.');
    return;
  }
  runningCheck = (async () => {
    const url = new URL(VERSION_FILE.href);
    url.searchParams.set('check', String(Date.now()));
    const response = await fetch(url.href, {cache: 'no-store'});
    if (!response.ok) throw new Error('Servidor indisponível.');
    const manifest = await response.json();
    const latest = String(manifest.version || '');
    if (!versionNumber(latest)) throw new Error('Versão inválida.');
    try { await refreshServiceWorker(); } catch (err) { console.warn('Service Worker:', err); }
    if (versionNumber(latest) > versionNumber(APP_VERSION)) {
      notify('Nova versão ' + latest + ' encontrada. Atualizando o aplicativo...');
      refreshApp(latest);
    } else if (manual) {
      // O botão é também um recarregamento manual de página.
      refreshApp(APP_VERSION, true);
    }
  })();
  try {
    await runningCheck;
  } catch (err) {
    if (manual) notify('Não foi possível verificar a atualização. Confira a conexão e tente novamente.');
    else console.warn('SÓCIO: verificação de versão indisponível.', err);
  } finally {
    runningCheck = null;
  }
}
export function initUpdates(options = {}) {
  notify = typeof options.notify === 'function' ? options.notify : () => {};
  isBusy = typeof options.isBusy === 'function' ? options.isBusy : () => false;
  if ('serviceWorker' in navigator) {
    hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) refreshApp('worker-' + APP_VERSION);
      hadController = true;
    });
  }
  const checkOnReturn = () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastForegroundCheck < 15000) return;
    lastForegroundCheck = Date.now();
    void checkForUpdates();
  };
  const start = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(WORKER_FILE.href, {updateViaCache: 'none'})
        .then(reg => reg.update())
        .catch(err => console.warn('SÓCIO: funcionamento offline indisponível.', err));
    }
    checkOnReturn();
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, {once: true});
  window.addEventListener('pageshow', checkOnReturn);
  document.addEventListener('visibilitychange', checkOnReturn);
}