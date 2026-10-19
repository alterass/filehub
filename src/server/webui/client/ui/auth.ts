// @ts-nocheck
// 登录 / 首次初始化（创建管理员）视图 —— 档案卡片：左说明、右表单
import { api } from '../api.js';
import { bus, icon, BRAND_MARK } from '../util.js';

function brandHtml() {
  return `
    <div class="auth-brand">
      <span class="auth-logo">${BRAND_MARK}</span>
      <span>FileHub</span>
    </div>`;
}

function fieldHtml({ label, name, type = 'text', placeholder = '', autocomplete = 'off', withEye = false }) {
  const eyeBtn = withEye
    ? `<button type="button" class="field-eye" data-eye title="显示密码">${icon('eye')}</button>`
    : '';
  return `
    <label class="field${withEye ? ' has-eye' : ''}">
      <span class="field-label">${label}</span>
      <input class="input" type="${type}" name="${name}" placeholder="${placeholder}"
             autocomplete="${autocomplete}" required />
      ${eyeBtn}
    </label>`;
}

function shell({ title, subtitle, fieldsHtml, submitText }) {
  return `
    <div class="auth-view">
      <div class="auth-shell">
        <section class="auth-intro">
          ${brandHtml()}
          <p class="auth-statement">文件都在<br />自己的设备上。</p>
          <p class="auth-lead">局域网个人网盘。照片、视频与文档保存在你的设备里，不经过云端。</p>
          <div class="auth-facts">
            <span>局域网直连</span><span class="sep"></span>
            <span>多用户隔离</span><span class="sep"></span>
            <span>缩略图预览</span>
          </div>
        </section>
        <section class="auth-card">
          <h1>${title}</h1>
          ${subtitle ? `<p class="auth-sub">${subtitle}</p>` : ''}
          <form class="auth-form" novalidate>
            ${fieldsHtml}
            <div class="form-error" hidden>${icon('alert')}<span></span></div>
            <button class="btn btn-primary btn-block" type="submit">${submitText}</button>
          </form>
        </section>
      </div>
    </div>`;
}

function bindForm(root, onSubmit) {
  const form = root.querySelector('.auth-form');
  const errBox = root.querySelector('.form-error');
  const errText = errBox.querySelector('span');
  const btn = form.querySelector('button[type=submit]');
  const btnLabel = btn.textContent;

  // 密码可见性切换
  root.querySelectorAll('.field-eye').forEach((eye) => {
    eye.addEventListener('click', () => {
      const input = eye.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.innerHTML = icon(show ? 'eyeOff' : 'eye');
      eye.title = show ? '隐藏密码' : '显示密码';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await onSubmit(Object.fromEntries(new FormData(form).entries()));
    } catch (err) {
      errText.textContent = err.message || '操作失败';
      errBox.hidden = false;
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = btnLabel;
    }
  });
}

export function renderSetup(root) {
  root.innerHTML = shell({
    title: '初始化 FileHub',
    subtitle: '首次使用：创建管理员账号。该账号拥有全部权限，可在管理页添加其他用户。',
    fieldsHtml:
      fieldHtml({ label: '用户名', name: 'username', placeholder: '2-32 个字符', autocomplete: 'username' }) +
      fieldHtml({ label: '密码', name: 'password', type: 'password', placeholder: '至少 6 位', autocomplete: 'new-password', withEye: true }) +
      fieldHtml({ label: '确认密码', name: 'password2', type: 'password', placeholder: '再次输入密码', autocomplete: 'new-password', withEye: true }),
    submitText: '创建并进入',
  });
  bindForm(root, async (data) => {
    if (data.password !== data.password2) throw new Error('两次输入的密码不一致');
    const { user } = await api.setup({ username: data.username, password: data.password });
    bus.emit('auth:login', user);
  });
}

export function renderLogin(root) {
  root.innerHTML = shell({
    title: '登录 FileHub',
    subtitle: '局域网个人网盘 · 快速访问你的文件',
    fieldsHtml:
      fieldHtml({ label: '用户名', name: 'username', placeholder: '输入用户名', autocomplete: 'username' }) +
      fieldHtml({ label: '密码', name: 'password', type: 'password', placeholder: '输入密码', autocomplete: 'current-password', withEye: true }),
    submitText: '登录',
  });
  bindForm(root, async (data) => {
    const { user } = await api.login({ username: data.username, password: data.password });
    bus.emit('auth:login', user);
  });
}
