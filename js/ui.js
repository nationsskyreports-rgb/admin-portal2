// ═══════════════════════════════════════════
// NOS Admin — UI Helpers
// ═══════════════════════════════════════════
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type]||'✅'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); setTimeout(()=>toast.remove(),400); }, 3500);
}
function openModal(title, msg, onConfirm) {
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-msg').innerText = msg;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-confirm').onclick = () => { closeModal(); onConfirm(); };
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
function openPanel(title) {
  document.getElementById('panel-title').innerText = title;
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('slide-panel').classList.add('open');
}
function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('slide-panel').classList.remove('open');
}
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
// NOS Admin — Theme Toggle
// ═══════════════════════════════════════════

// تحميل الـ theme المحفوظ عند أول تحميل الصفحة
(function initTheme() {
  const saved = localStorage.getItem('nos-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nos-theme', next);
  // تحديث أيقونة الزرار
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
// NOS Admin — Sidebar
// ═══════════════════════════════════════════
function renderSidebar() {
  const path   = window.location.pathname;
  const isRoot = path.endsWith('index.html') || path.endsWith('/admin/') || path.endsWith('/admin');
  const base   = isRoot ? '' : '../';

  const items = [
    { section: 'Main' },
    { label: 'Dashboard',     icon: 'fa-tachometer-alt', href: base + 'index.html' },
    { label: 'Agents',        icon: 'fa-users',          href: base + 'pages/agents.html' },
    { label: 'Annual Leave',  icon: 'fa-umbrella-beach',  href: base + 'pages/annual-leave.html' },
    { label: 'Schedule',      icon: 'fa-calendar-alt',   href: base + 'pages/schedule.html' },
    { label: 'Breaks',        icon: 'fa-coffee',         href: base + 'pages/breaks.html' },
    { section: 'Operations' },
    { label: 'Requests',      icon: 'fa-file-alt',       href: base + 'pages/requests.html', badge: 'pending-count' },
    { label: 'KPIs',          icon: 'fa-chart-line',     href: base + 'pages/kpis.html' },
    { label: 'Excuses',       icon: 'fa-clock',          href: base + 'pages/excuses.html' },
    { label: 'xCALLY Import', icon: 'fa-upload',         href: base + 'pages/xcally-import.html' },
    { label: 'Quality',       icon: 'fa-star',            href: base + 'pages/quality.html' },
    { label: 'Call Log',      icon: 'fa-phone-alt',      href: base + 'pages/calllog.html' },
    { section: 'Config' },
    { label: 'Reference',     icon: 'fa-database',       href: base + 'pages/reference.html' },
    { label: 'Reports',       icon: 'fa-chart-bar',      href: base + 'pages/reports.html' },
  ];

  // حدد الصفحة الحالية عشان تتلون active
  const currentFile = path.split('/').pop() || 'index.html';

  let nav = '';
  items.forEach(item => {
    if (item.section) {
      nav += `<div class="nav-section">${item.section}</div>`;
    } else {
      const itemFile = item.href.split('/').pop();
      const isActive = currentFile === itemFile ? 'active' : '';
      const badge    = item.badge ? `<span class="nav-badge" id="${item.badge}">0</span>` : '';
      nav += `
        <a class="nav-item ${isActive}" href="${item.href}">
          <div class="nav-icon"><i class="fas ${item.icon}"></i></div>
          <span class="nav-label">${item.label}</span>
          ${badge}
        </a>`;
    }
  });

  const aside = document.getElementById('sidebar');
  if (!aside) return;

  aside.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-logo">✦</div>
      <div class="brand-text">
        <div class="brand-name">NATIONS OF SKY</div>
        <div class="brand-sub">Admin Panel</div>
      </div>
    </div>
    <nav class="sidebar-nav">${nav}</nav>
    <div class="sidebar-footer">
      <button class="logout-btn" onclick="logout()">
        <i class="fas fa-sign-out-alt"></i> Sign Out
      </button>
    </div>`;
}
// ═══════════════════════════════════════════
// NOS Admin — Date Helpers
// ═══════════════════════════════════════════
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function getWeekEnd() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Sunday
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}
function getToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}
