// ═══════════════════════════════════════════
// NOS Admin — UI Helpers (upgraded UX v3)
// ═══════════════════════════════════════════

// ── Auto-inject toast container + prompt modal if missing ──
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }
  if (!document.getElementById('nos-prompt-overlay')) {
    const html = `
      <div class="prompt-overlay" id="nos-prompt-overlay">
        <div class="prompt-box">
          <div class="prompt-title" id="nos-prompt-title">Input</div>
          <div class="prompt-desc" id="nos-prompt-desc"></div>
          <input class="prompt-input" id="nos-prompt-input" autocomplete="off">
          <div class="prompt-btns">
            <button class="btn btn-ghost" id="nos-prompt-cancel">Cancel</button>
            <button class="btn btn-primary" id="nos-prompt-ok">Confirm</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
});

// ═══════════════════════════════════════════
// Toast Notifications (upgraded with progress bar + close)
// ═══════════════════════════════════════════
function showToast(msg, type = 'success', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'fa-check',
    error:   'fa-times',
    warning: 'fa-exclamation',
    info:    'fa-info'
  };
  const titles = {
    success: 'Success',
    error:   'Error',
    warning: 'Warning',
    info:    'Info'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${titles[type] || 'Notice'}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()"><i class="fas fa-times"></i></button>
    <div class="toast-progress" style="animation-duration:${duration}ms;"></div>`;

  container.appendChild(toast);

  // Pause progress on hover
  toast.addEventListener('mouseenter', () => {
    const bar = toast.querySelector('.toast-progress');
    if (bar) bar.style.animationPlayState = 'paused';
  });
  toast.addEventListener('mouseleave', () => {
    const bar = toast.querySelector('.toast-progress');
    if (bar) bar.style.animationPlayState = 'running';
  });

  setTimeout(() => {
    if (!toast.parentNode) return;
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ═══════════════════════════════════════════
// Custom Prompt Modal (replaces native prompt())
// ═══════════════════════════════════════════
function showPrompt(title, defaultValue, description) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('nos-prompt-overlay');
    const input   = document.getElementById('nos-prompt-input');
    const titleEl = document.getElementById('nos-prompt-title');
    const descEl  = document.getElementById('nos-prompt-desc');
    const okBtn   = document.getElementById('nos-prompt-ok');
    const cancelBtn = document.getElementById('nos-prompt-cancel');

    if (!overlay) { resolve(prompt(title, defaultValue)); return; }

    titleEl.textContent = title || 'Input';
    descEl.textContent  = description || '';
    descEl.style.display = description ? '' : 'none';
    input.value = defaultValue || '';
    overlay.classList.add('open');

    setTimeout(() => { input.focus(); input.select(); }, 100);

    function cleanup() {
      overlay.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
    }
    function onOk() { cleanup(); resolve(input.value.trim()); }
    function onCancel() { cleanup(); resolve(null); }
    function onKey(e) {
      if (e.key === 'Enter') onOk();
      if (e.key === 'Escape') onCancel();
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
  });
}

// ═══════════════════════════════════════════
// Modal
// ═══════════════════════════════════════════
function openModal(title, msg, onConfirm) {
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-msg').innerText = msg;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-confirm').onclick = () => { closeModal(); onConfirm(); };
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════
// Slide Panel
// ═══════════════════════════════════════════
function openPanel(title) {
  if (title !== undefined) document.getElementById('panel-title').innerText = title;
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('slide-panel').classList.add('open');
}
function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('slide-panel').classList.remove('open');
}

// ═══════════════════════════════════════════
// Utility Helpers
// ═══════════════════════════════════════════
function loading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><div>Loading...</div></div>`;
}
function empty(id, msg='No data found') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span>${msg}</div>`;
}
function statusBadge(status) {
  const map = {
    'Active':'badge-success','Inactive':'badge-danger',
    'Approved':'badge-success','Rejected':'badge-danger','Pending':'badge-warning',
    'Published':'badge-info','Open':'badge-success','Closed':'badge-danger',
    'Draft':'badge-muted','Admin':'badge-purple','Manager':'badge-info','Agent':'badge-muted',
    'Work':'badge-success','Off':'badge-muted','Annual':'badge-purple',
    'Sick':'badge-danger','Casual':'badge-warning','PH':'badge-info','Task':'badge-blue'
  };
  return `<span class="badge ${map[status]||'badge-muted'}">${status}</span>`;
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function formatTime(t) {
  if (!t) return '-';
  return t.substring(0,5);
}
function debounce(fn, delay=300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(()=>fn(...args), delay); };
}

// ═══════════════════════════════════════════
// Theme Toggle
// ═══════════════════════════════════════════
(function initTheme() {
  const saved = localStorage.getItem('nos-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nos-theme', next);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.innerHTML = next === 'dark'
    ? '<i class="fas fa-moon"></i>'
    : '<i class="fas fa-sun"></i>';
}

function applyThemeIcon() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.innerHTML = current === 'dark'
    ? '<i class="fas fa-moon"></i>'
    : '<i class="fas fa-sun"></i>';
}

// ═══════════════════════════════════════════
// Tabbed Sidebar
// ═══════════════════════════════════════════
function renderSidebar() {
  const path   = window.location.pathname;
  const isRoot = path.endsWith('index.html') || path.endsWith('/admin/') || path.endsWith('/admin');
  const base   = isRoot ? '' : '../';

  const tabs = [
    {
      id: 'core',
      label: 'Core',
      icon: 'fa-th-large',
      items: [
        { label: 'Dashboard',      key: 'dashboard',      icon: 'fa-tachometer-alt', href: base + 'index.html' },
        { label: 'Agents',         key: 'agents',         icon: 'fa-users',          href: base + 'pages/agents.html' },
        { label: 'Schedule',       key: 'schedule',       icon: 'fa-calendar-alt',   href: base + 'pages/schedule.html' },
        { label: 'Schedule Audit', key: 'schedule-audit', icon: 'fa-chart-gantt',    href: base + 'pages/schedule-audit.html' },
        { label: 'Annual Leave',   key: 'annual-leave',   icon: 'fa-umbrella-beach', href: base + 'pages/annual-leave.html' },
        { label: 'Breaks',         key: 'breaks',         icon: 'fa-coffee',         href: base + 'pages/breaks.html' },
        { label: 'Requests',       key: 'requests',       icon: 'fa-file-alt',       href: base + 'pages/requests.html', badge: 'pending-count' },
      ]
    },
    {
      id: 'ops',
      label: 'Operations',
      icon: 'fa-chart-line',
      items: [
        { section: 'Performance' },
        { label: 'KPIs',             key: 'kpis',             icon: 'fa-chart-line',         href: base + 'pages/kpis.html' },
        { label: 'Quality',          key: 'quality',          icon: 'fa-star',               href: base + 'pages/quality.html' },
        { label: 'Break Adherence',  key: 'adherence-new',    icon: 'fa-stopwatch',          href: base + 'pages/adherence-new.html' },
        { label: 'Excuses',          key: 'excuses',          icon: 'fa-clock',              href: base + 'pages/excuses.html' },
        { label: 'Waiving',          key: 'waiving',          icon: 'fa-hand-holding-heart', href: base + 'pages/waiving.html' },
        { section: 'Calls' },
        { label: 'Call Log',         key: 'calllog',          icon: 'fa-phone-alt',          href: base + 'pages/calllog.html' },
        { label: 'CL Settings',     key: 'calllog-settings', icon: 'fa-sitemap',            href: base + 'pages/calllog-settings.html' },
        { label: 'FCR Analytics',    key: 'fcr',              icon: 'fa-redo',               href: base + 'pages/fcr.html' },
        { section: 'xCALLY' },
        { label: 'xCALLY Live',     key: 'xcally-live',      icon: 'fa-satellite-dish',     href: base + 'pages/xcally-live.html' },
        { label: 'xCALLY Import',   key: 'xcally-import',    icon: 'fa-upload',             href: base + 'pages/xcally-import.html' },
        { label: 'xCALLY Reports',  key: 'xcally-reports',   icon: 'fa-chart-pie',          href: base + 'pages/xcally-reports.html' },
      ]
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: 'fa-cog',
      items: [
        { label: 'Reports',    key: 'reports',    icon: 'fa-chart-bar',       href: base + 'pages/reports.html' },
        { label: 'HR Report',  key: 'hr-report',  icon: 'fa-file-medical-alt',href: base + 'pages/hr-report.html' },
        { label: 'Audit Log',  key: 'audit-log',  icon: 'fa-clipboard-list',  href: base + 'pages/audit-log.html' },
        { label: 'Reference',  key: 'reference',  icon: 'fa-database',        href: base + 'pages/reference.html' },
        { label: 'Users',      key: 'users',      icon: 'fa-user-shield',     href: base + 'pages/users.html' },
      ]
    }
  ];

  // ── فلترة حسب الصلاحيات ──

  // ── تصدير ليستة الصفحات لصفحة Users (permissions grid) ──
  window.SIDEBAR_PAGES = tabs.flatMap(t => t.items.filter(i => i.key).map(i => ({ key: i.key, label: i.label, group: t.label })));
  const _session = (typeof getSession === 'function') ? getSession() : null;

  function isAllowed(item) {
    if (item.section) return true;
    if (!_session) return false;
    return (typeof hasPermission === 'function') ? hasPermission(_session, item.key) : true;
  }

  const filteredTabs = tabs.map(tab => {
    const allowed = tab.items.filter(isAllowed);
    const cleaned = allowed.filter((item, i) => {
      if (!item.section) return true;
      const rest = allowed.slice(i + 1);
      for (const n of rest) { if (n.section) return false; if (!n.section) return true; }
      return false;
    });
    return { ...tab, items: cleaned };
  }).filter(tab => tab.items.filter(i => !i.section).length > 0);

  // ── تحديد التاب الحالي ──
  const currentFile = path.split('/').pop() || 'index.html';
  let autoTabId = filteredTabs.length ? filteredTabs[0].id : 'core';
  for (const tab of filteredTabs) {
    for (const item of tab.items) {
      if (item.section) continue;
      const itemFile = item.href.split('/').pop();
      if (currentFile === itemFile) { autoTabId = tab.id; break; }
    }
  }
  const activeTabId = autoTabId;
  localStorage.setItem('nos-sidebar-tab', activeTabId);

  // ── بناء HTML ──
  let tabsHtml = '';
  filteredTabs.forEach(tab => {
    const isActive = tab.id === activeTabId ? 'active' : '';
    tabsHtml += `
      <button class="sb-tab ${isActive}" data-tab="${tab.id}" title="${tab.label}">
        <i class="fas ${tab.icon}"></i>
        <span>${tab.label}</span>
      </button>`;
  });

  let panelsHtml = '';
  filteredTabs.forEach(tab => {
    const isActive = tab.id === activeTabId ? 'active' : '';
    let navHtml = '';
    tab.items.forEach(item => {
      if (item.section) {
        navHtml += `<div class="nav-section">${item.section}</div>`;
      } else {
        const itemFile = item.href.split('/').pop();
        const active   = currentFile === itemFile ? 'active' : '';
        const badge    = item.badge ? `<span class="nav-badge" id="${item.badge}">0</span>` : '';
        navHtml += `
          <a class="nav-item ${active}" href="${item.href}">
            <div class="nav-icon"><i class="fas ${item.icon}"></i></div>
            <span class="nav-label">${item.label}</span>
            ${badge}
          </a>`;
      }
    });
    panelsHtml += `<div class="sb-panel ${isActive}" data-panel="${tab.id}">${navHtml}</div>`;
  });

  const aside = document.getElementById('sidebar');
  if (!aside) return;

  aside.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-logo">
        <img src="${base}logo.png" alt="NOS Logo" style="width:100%;height:100%;object-fit:contain;border-radius:11px;">
      </div>
      <div class="brand-text">
        <div class="brand-name">NATIONS OF SKY</div>
        <div class="brand-sub">ADMIN PANEL</div>
      </div>
    </div>
    <div class="sb-tabs-strip">${tabsHtml}</div>
    <div class="sb-search-wrap">
      <i class="fas fa-search"></i>
      <input type="text" class="sb-search" placeholder="Search pages…" autocomplete="off">
    </div>
    <nav class="sidebar-nav">${panelsHtml}</nav>
    <div class="sidebar-footer">
      <button class="logout-btn" style="margin-bottom:8px; background:transparent; border:1px solid var(--border); color:var(--muted);"
              onclick="window.location.href='${base}change-password.html'"
              onmouseover="this.style.color='var(--gold)'; this.style.borderColor='var(--gold)';"
              onmouseout="this.style.color='var(--muted)'; this.style.borderColor='var(--border)';">
        <i class="fas fa-key"></i> Change Password
      </button>
      <button class="logout-btn" onclick="logout()">
        <i class="fas fa-sign-out-alt"></i> Sign Out
      </button>
    </div>`;

  // ── Tab switching ──
  aside.querySelectorAll('.sb-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      aside.querySelectorAll('.sb-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      aside.querySelectorAll('.sb-panel').forEach(p => {
        p.classList.remove('active');
        if (p.dataset.panel === tabId) p.classList.add('active');
      });
      localStorage.setItem('nos-sidebar-tab', tabId);
      const searchInput = aside.querySelector('.sb-search');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        filterSidebarItems('');
      }
    });
  });

  // ── Search ──
  const searchInput = aside.querySelector('.sb-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterSidebarItems(e.target.value.trim().toLowerCase());
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        filterSidebarItems('');
        searchInput.blur();
      }
    });
  }

  const activeItem = aside.querySelector('.nav-item.active');
  if (activeItem) {
    setTimeout(() => activeItem.scrollIntoView({ block: 'center', behavior: 'instant' }), 50);
  }
}

function filterSidebarItems(query) {
  const aside = document.getElementById('sidebar');
  if (!aside) return;
  const panels  = aside.querySelectorAll('.sb-panel');
  const tabBtns = aside.querySelectorAll('.sb-tab');

  if (!query) {
    panels.forEach(p => {
      p.querySelectorAll('.nav-item').forEach(item => { item.style.display = ''; });
      p.querySelectorAll('.nav-section').forEach(sec => { sec.style.display = ''; });
    });
    const savedTab = localStorage.getItem('nos-sidebar-tab') || 'core';
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === savedTab));
    panels.forEach(p => p.classList.toggle('active', p.dataset.panel === savedTab));
    aside.querySelector('.sb-tabs-strip').style.opacity = '';
    aside.querySelector('.sb-tabs-strip').style.pointerEvents = '';
    return;
  }

  aside.querySelector('.sb-tabs-strip').style.opacity = '0.4';
  aside.querySelector('.sb-tabs-strip').style.pointerEvents = 'none';
  panels.forEach(p => p.classList.add('active'));

  panels.forEach(p => {
    p.querySelectorAll('.nav-section').forEach(sec => { sec.style.display = 'none'; });
    p.querySelectorAll('.nav-item').forEach(item => {
      const label = (item.querySelector('.nav-label')?.textContent || '').toLowerCase();
      item.style.display = label.includes(query) ? '' : 'none';
    });
  });
}

// ═══════════════════════════════════════════
// Mobile Sidebar Drawer
// ═══════════════════════════════════════════
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('mobile-open');
  if (isOpen) {
    sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    sidebar.classList.add('mobile-open');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('mobile-hamburger')) {
    const ham = document.createElement('button');
    ham.id = 'mobile-hamburger';
    ham.className = 'mobile-hamburger';
    ham.innerHTML = '<i class="fas fa-bars"></i>';
    ham.onclick = toggleMobileSidebar;
    document.body.appendChild(ham);
  }
  if (!document.getElementById('mobile-overlay')) {
    const ov = document.createElement('div');
    ov.id = 'mobile-overlay';
    ov.className = 'mobile-overlay';
    ov.onclick = toggleMobileSidebar;
    document.body.appendChild(ov);
  }
});

// ═══════════════════════════════════════════
// Date Helpers
// ═══════════════════════════════════════════
function getWeekStart() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const d = new Date(today + 'T12:00:00');
  const diff = d.getDate() - d.getDay();
  d.setDate(diff);
  return d.toLocaleDateString('en-CA');
}

function getWeekEnd() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const d = new Date(today + 'T12:00:00');
  const diff = d.getDate() - d.getDay() + 6;
  d.setDate(diff);
  return d.toLocaleDateString('en-CA');
}

function getToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}


// ═══════════════════════════════════════════
// Requests notification badge
// ═══════════════════════════════════════════
const REQ_SEEN_KEY = 'nos_req_seen_at';

async function refreshRequestsBadge() {
  const badge = document.getElementById('pending-count');
  if (!badge || typeof db === 'undefined') return;
  try {
    const seen = localStorage.getItem(REQ_SEEN_KEY) || '1970-01-01T00:00:00Z';
    const { count } = await db.from('requests')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', seen);
    const n = count || 0;
    badge.innerText = n;
    badge.style.display = n > 0 ? '' : 'none';
  } catch (e) { /* silent */ }
}

async function markAllRequestsRead() {
  localStorage.setItem(REQ_SEEN_KEY, new Date().toISOString());
  await refreshRequestsBadge();
  if (typeof showToast === 'function') showToast('All requests marked as read', 'success');
}

document.addEventListener('DOMContentLoaded', () => { setTimeout(refreshRequestsBadge, 400); });


// ═══════════════════════════════════════════
// Command Palette (Cmd+K / Ctrl+K)
// ═══════════════════════════════════════════
(function initCommandPalette() {

  const ALL_PAGES = window.SIDEBAR_PAGES || [];

  let selectedIdx = 0;
  let filteredItems = [];

  function getBase() {
    const path = window.location.pathname;
    const isRoot = path.endsWith('index.html') || path.endsWith('/admin/') || path.endsWith('/admin');
    return isRoot ? '' : '../';
  }

  function getFilteredPages(query) {
    const _session = (typeof getSession === 'function') ? getSession() : null;
    let pages = ALL_PAGES.filter(p => {
      if (!_session) return false;
      return (typeof hasPermission === 'function') ? hasPermission(_session, p.key) : true;
    });
    if (query) {
      const q = query.toLowerCase();
      pages = pages.filter(p => p.label.toLowerCase().includes(q) || p.tab.toLowerCase().includes(q));
    }
    return pages;
  }

  function render(query) {
    const results = document.getElementById('cmdk-results');
    if (!results) return;
    filteredItems = getFilteredPages(query);
    selectedIdx = Math.min(selectedIdx, Math.max(0, filteredItems.length - 1));

    if (!filteredItems.length) {
      results.innerHTML = '<div class="cmdk-empty">No pages found</div>';
      return;
    }

    const base = getBase();
    const grouped = {};
    filteredItems.forEach(p => {
      if (!grouped[p.tab]) grouped[p.tab] = [];
      grouped[p.tab].push(p);
    });

    let html = '';
    let globalIdx = 0;
    for (const [tab, pages] of Object.entries(grouped)) {
      html += `<div class="cmdk-group-label">${tab}</div>`;
      for (const p of pages) {
        const sel = globalIdx === selectedIdx ? 'selected' : '';
        html += `
          <a class="cmdk-item ${sel}" href="${base}${p.href}" data-idx="${globalIdx}">
            <div class="cmdk-item-icon"><i class="fas ${p.icon}"></i></div>
            <div class="cmdk-item-label">${p.label}</div>
            <div class="cmdk-item-tab">${p.tab}</div>
          </a>`;
        globalIdx++;
      }
    }
    results.innerHTML = html;

    // Scroll selected into view
    const sel = results.querySelector('.cmdk-item.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function open() {
    let overlay = document.getElementById('cmdk-overlay');
    if (!overlay) inject();
    overlay = document.getElementById('cmdk-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    selectedIdx = 0;
    const input = document.getElementById('cmdk-input');
    if (input) { input.value = ''; input.focus(); }
    render('');
  }

  function close() {
    const overlay = document.getElementById('cmdk-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function navigate() {
    if (filteredItems[selectedIdx]) {
      const base = getBase();
      window.location.href = base + filteredItems[selectedIdx].href;
    }
  }

  function inject() {
    const html = `
      <div class="cmdk-overlay" id="cmdk-overlay">
        <div class="cmdk-box">
          <div class="cmdk-input-wrap">
            <i class="fas fa-search"></i>
            <input class="cmdk-input" id="cmdk-input" placeholder="Search pages…" autocomplete="off">
            <span class="cmdk-kbd">ESC</span>
          </div>
          <div class="cmdk-results" id="cmdk-results"></div>
          <div class="cmdk-footer">
            <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Events
    const overlay = document.getElementById('cmdk-overlay');
    const input   = document.getElementById('cmdk-input');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    input.addEventListener('input', () => {
      selectedIdx = 0;
      render(input.value.trim());
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = Math.min(selectedIdx + 1, filteredItems.length - 1);
        render(input.value.trim());
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = Math.max(selectedIdx - 1, 0);
        render(input.value.trim());
      } else if (e.key === 'Enter') {
        e.preventDefault();
        navigate();
      } else if (e.key === 'Escape') {
        close();
      }
    });

    // Mouse hover on items
    document.getElementById('cmdk-results').addEventListener('mousemove', (e) => {
      const item = e.target.closest('.cmdk-item');
      if (item && item.dataset.idx !== undefined) {
        selectedIdx = parseInt(item.dataset.idx);
        render(input.value.trim());
      }
    });
  }

  // Global keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const overlay = document.getElementById('cmdk-overlay');
      if (overlay && overlay.classList.contains('open')) {
        close();
      } else {
        open();
      }
    }
  });

  // Expose globally
  window.openCommandPalette = open;

})();
