// ═══════════════════════════════════════════
// NOS Admin — Auth
// ═══════════════════════════════════════════
const BASE = '/admin-portal2';

function checkAuth() {
  const session = sessionStorage.getItem('nos-admin');
  if (!session) { window.location.href = BASE + '/login.html'; return null; }
  return JSON.parse(session);
}
function logout() {
  sessionStorage.removeItem('nos-admin');
  window.location.href = BASE + '/login.html';
}
function getAdminName() {
  const session = sessionStorage.getItem('nos-admin');
  if (!session) return 'Admin';
  return JSON.parse(session).username || 'Admin';
}
