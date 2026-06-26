// ============================================================
// Auth – Gerenciamento de autenticação do frontend
// ============================================================
const Auth = (() => {
  function getToken() {
    return localStorage.getItem('vs_token');
  }

  function getUser() {
    const raw = localStorage.getItem('vs_user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function setSession(token, user) {
    localStorage.setItem('vs_token', token);
    localStorage.setItem('vs_user', JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem('vs_token');
    localStorage.removeItem('vs_user');
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = '/admin.html#login';
      return false;
    }
    return true;
  }

  function requireAdmin() {
    const user = getUser();
    if (!user || user.role !== 'admin') {
      window.location.href = '/admin.html#login';
      return false;
    }
    return true;
  }

  return { getToken, getUser, setSession, clearSession, isLoggedIn, requireAuth, requireAdmin };
})();
