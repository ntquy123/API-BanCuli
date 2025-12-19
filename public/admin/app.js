const loginCard = document.getElementById('login-card');
const dashboard = document.getElementById('dashboard');
const friendCodeInput = document.getElementById('friendCode');
const sessionState = document.getElementById('session-state');
const adminName = document.getElementById('admin-name');
const adminFriendcode = document.getElementById('admin-friendcode');
const logoutButton = document.getElementById('logout');
const startButton = document.getElementById('start-btn');
const shutdownButton = document.getElementById('shutdown-btn');
const resultStatus = document.getElementById('result-status');
const resultMessage = document.getElementById('result-message');
const resultDetail = document.getElementById('result-detail');
const openLanguageConfigButton = document.getElementById('open-language-config');
const openDockerManagementButton = document.getElementById('open-docker-management');
const loadingBackdrop = document.getElementById('loading-backdrop');
const loadingText = document.getElementById('loading-text');
const toast = document.getElementById('toast');
const loginHint = document.getElementById('login-hint');

const TOKEN_KEY = 'admin_ui_token';

const clearResult = () => {
  resultStatus.className = 'pill neutral';
  resultStatus.textContent = 'Đang chờ';
  resultMessage.textContent = 'Chưa có thao tác.';
  resultDetail.textContent = '';
};

const showToast = (message, type = 'success') => {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2600);
};

const setLoading = (isLoading, message = 'Đang xử lý...') => {
  if (isLoading) {
    loadingText.textContent = message;
    loadingBackdrop.classList.remove('hidden');
    return;
  }
  loadingBackdrop.classList.add('hidden');
};

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value = '') =>
  value.toString().replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);

const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);
const getToken = () => localStorage.getItem(TOKEN_KEY);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const updateSessionState = (isOnline, admin) => {
  sessionState.textContent = isOnline ? `Đăng nhập: ${admin?.friendCode ?? ''}` : 'Chưa đăng nhập';
  sessionState.classList.toggle('offline', !isOnline);
};

const setAuthenticatedUI = (admin) => {
  loginCard.classList.add('hidden');
  dashboard.classList.remove('hidden');
  adminName.textContent = admin?.friendCode ?? 'Admin';
  adminFriendcode.textContent = admin?.providerType
    ? `${admin.friendCode} · ${admin.providerType}`
    : admin?.friendCode ?? '';
  updateSessionState(true, admin);
  loginHint.textContent = 'Đăng nhập thành công! Bạn có thể bật/tắt server ngay bên dưới.';
};

const setLoggedOutUI = () => {
  dashboard.classList.add('hidden');
  loginCard.classList.remove('hidden');
  updateSessionState(false);
  clearResult();
  loginHint.textContent = 'Mẹo: chỉ cần friendCode đúng, không cần mật khẩu.';
};

const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/admin/${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    setLoggedOutUI();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    body = {};
  }

  if (!response.ok) {
    const message = body?.error || 'Có lỗi xảy ra, vui lòng thử lại.';
    throw new Error(message);
  }

  return body;
};

const formatDetail = (data) => JSON.stringify(data, null, 2);

const handleAction = async (endpoint, method, loadingLabel) => {
  setLoading(true, loadingLabel);
  try {
    const result = await apiFetch(endpoint, { method });
    resultStatus.className = 'pill success';
    resultStatus.textContent = 'Thành công';
    resultMessage.textContent = result.message || 'Thao tác hoàn tất.';
    resultDetail.textContent = formatDetail(result);
    showToast('Thao tác thành công.', 'success');
  } catch (error) {
    resultStatus.className = 'pill danger';
    resultStatus.textContent = 'Thất bại';
    resultMessage.textContent = error.message;
    resultDetail.textContent = '';
    showToast(error.message, 'error');
  } finally {
    setLoading(false);
  }
};

const handleLogin = async (event) => {
  event.preventDefault();
  const friendCode = friendCodeInput.value.trim();

  if (!friendCode) {
    showToast('Vui lòng nhập friendCode.', 'error');
    return;
  }

  setLoading(true, 'Đang xác thực...');
  try {
    const data = await apiFetch('login', {
      method: 'POST',
      body: JSON.stringify({ friendCode }),
    });

    saveToken(data.token);
    setAuthenticatedUI(data.player);
    showToast('Đăng nhập thành công.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(false);
  }
};

const restoreSession = async () => {
  const token = getToken();
  if (!token) {
    return;
  }

  try {
    const { admin } = await apiFetch('session');
    if (admin) {
      setAuthenticatedUI(admin);
    }
  } catch (error) {
    clearToken();
    setLoggedOutUI();
  }
};

document.getElementById('login-form').addEventListener('submit', handleLogin);

logoutButton.addEventListener('click', () => {
  clearToken();
  setLoggedOutUI();
  showToast('Đã đăng xuất.', 'success');
});

startButton.addEventListener('click', () => handleAction('start', 'GET', 'Đang bật server và phòng chờ...'));
shutdownButton.addEventListener('click', () => handleAction('shutdown', 'POST', 'Đang tắt server...'));
openLanguageConfigButton?.addEventListener('click', () => {
  const token = getToken();
  if (!token) {
    showToast('Vui lòng đăng nhập trước khi truy cập cấu hình.', 'error');
    return;
  }

  window.location.href = './config.html';
});

openDockerManagementButton?.addEventListener('click', () => {
  const token = getToken();
  if (!token) {
    showToast('Vui lòng đăng nhập trước khi truy cập Docker.', 'error');
    return;
  }

  window.location.href = './docker.html';
});

restoreSession();
