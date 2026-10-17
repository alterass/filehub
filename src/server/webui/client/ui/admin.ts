// @ts-nocheck
// 用户管理面板（仅管理员）：新增用户、重置密码、删除用户
import { api } from '../api.js';
import { icon, toast, formatSize } from '../util.js';
import { prompt, confirm } from './dialogs.js';
import { state } from '../store.js';

export async function openAdminPanel() {
  if (state.user?.role !== 'admin') return;
  const ov = document.createElement('div');
  ov.className = 'overlay admin-overlay';
  ov.innerHTML = `
    <div class="dialog-backdrop"></div>
    <div class="dialog admin-panel">
      <h3>${icon('users')} 用户管理</h3>
      <div class="admin-add">
        <button class="btn btn-primary" id="addUser">${icon('folderPlus')} 添加用户</button>
      </div>
      <div class="admin-list"><div class="loading-spin"></div></div>
      <div class="dialog-actions">
        <button class="btn btn-ghost admin-close">关闭</button>
      </div>
    </div>`;
  document.getElementById('layers').appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 180); };
  ov.querySelector('.admin-close').addEventListener('click', close);
  ov.querySelector('.dialog-backdrop').addEventListener('click', close);

  const list = ov.querySelector('.admin-list');
  const load = async () => {
    const { items } = await api.adminListUsers();
    list.innerHTML = items.map((u) => `
      <div class="admin-row" data-id="${u.id}">
        <div class="au-name">
          ${icon('user')}<span>${u.username}</span>
          ${u.role === 'admin' ? '<em class="au-role">管理员</em>' : ''}
          ${u.id === state.user.id ? '<em class="au-me">当前账号</em>' : ''}
        </div>
        <div class="au-actions">
          <button class="btn btn-ghost btn-sm au-reset" data-id="${u.id}" data-name="${u.username}">重置密码</button>
          <button class="btn btn-ghost btn-sm au-del danger" data-id="${u.id}" ${u.id === state.user.id ? 'disabled' : ''}>删除</button>
        </div>
      </div>`).join('') || '<p class="dim">暂无用户</p>';

    list.querySelectorAll('.au-reset').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pwd = await prompt({ title: `重置「${btn.dataset.name}」的密码`, label: '新密码（至少 6 位）' });
        if (!pwd) return;
        try {
          await api.adminResetPassword(btn.dataset.id, pwd);
          toast('密码已重置', 'ok');
        } catch (err) { toast(err.message, 'error'); }
      });
    });
    list.querySelectorAll('.au-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!(await confirm({ title: '删除用户', message: '该用户的全部文件也将被删除，确定？' }))) return;
        try {
          await api.adminDeleteUser(btn.dataset.id);
          toast('用户已删除', 'ok');
          load();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  };

  ov.querySelector('#addUser').addEventListener('click', async () => {
    const username = await prompt({ title: '添加用户', label: '用户名（2-32 字符）', placeholder: '例如 xiaoming' });
    if (!username) return;
    const password = await prompt({ title: `为「${username}」设置密码`, label: '密码（至少 6 位）' });
    if (!password) return;
    try {
      await api.adminAddUser({ username, password });
      toast(`用户「${username}」已创建`, 'ok');
      load();
    } catch (err) { toast(err.message, 'error'); }
  });

  await load().catch((err) => {
    list.innerHTML = `<p class="dim">${err.message}</p>`;
  });
}
