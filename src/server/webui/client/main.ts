// FileHub 前端入口：启动引导与路由
import { api } from './api.js';
import { state } from './store.js';
import { bus, toast, $ } from './util.js';
import { renderLogin, renderSetup } from './ui/auth.js';
import { mountBrowser } from './ui/browser.js';

let currentView = null;

function setView(name, render) {
  if (currentView === name) return;
  currentView = name;
  render($('#app'));
}

function route() {
  // 未初始化 → 引导创建管理员；未登录 → 登录页
  if (!state.initialized) {
    currentView = 'setup';
    renderSetup($('#app'));
    return;
  }
  if (!state.user) {
    currentView = 'login';
    renderLogin($('#app'));
    return;
  }

  const hash = location.hash || '#/files';
  if (!hash.startsWith('#/files')) {
    location.hash = '#/files';
    return;
  }
  const folderId = hash.split('/')[2] || null;
  if (folderId !== state.cwdId) {
    state.cwdId = folderId;
    state.searching = false;
    state.query = '';
  }
  currentView = 'browser';
  mountBrowser($('#app'));
}

async function boot() {
  try {
    const status = await api.status();
    state.initialized = status.initialized;
    state.user = status.user;
  } catch {
    toast('无法连接服务器，请检查 FileHub 服务是否在运行', 'error', 5000);
    $('#app').innerHTML =
      '<div class="auth-view"><div class="auth-card"><h1>无法连接服务器</h1><p class="auth-sub">请确认 FileHub 服务已启动后刷新页面。</p><button class="btn btn-primary" onclick="location.reload()">重试</button></div></div>';
    return;
  }
  route();
  window.addEventListener('hashchange', route);
  bus.on('auth:login', (user) => {
    state.user = user;
    state.initialized = true;
    currentView = null;
    location.hash = '#/files';
    route();
  });
  bus.on('auth:logout', () => {
    state.user = null;
    currentView = null;
    route();
  });
  bus.on('auth:expired', () => {
    if (state.user) {
      state.user = null;
      toast('登录已过期，请重新登录', 'info');
      currentView = null;
      route();
    }
  });
}

boot();
