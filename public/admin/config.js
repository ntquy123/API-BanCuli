const sessionState = document.getElementById('session-state');
const adminName = document.getElementById('admin-name');
const adminMeta = document.getElementById('admin-meta');
const logoutButton = document.getElementById('logout');
const backDashboardButton = document.getElementById('back-dashboard');
const languageGrid = document.getElementById('language-grid');
const languageCount = document.getElementById('language-count');
const languageForm = document.getElementById('language-form');
const codeInput = document.getElementById('lang-code');
const viInput = document.getElementById('lang-vi');
const enInput = document.getElementById('lang-en');
const cancelEditButton = document.getElementById('cancel-edit');
const submitButton = document.getElementById('submit-language');
const formTitle = document.getElementById('form-title');
const formMode = document.getElementById('form-mode');
const loadingBackdrop = document.getElementById('loading-backdrop');
const loadingText = document.getElementById('loading-text');
const toast = document.getElementById('toast');

const TOKEN_KEY = 'admin_ui_token';

let languages = [];
let editingCode = null;

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value = '') => value.toString().replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);

const setLoading = (isLoading, message = 'Đang xử lý...') => {
  if (isLoading) {
    loadingText.textContent = message;
    loadingBackdrop.classList.remove('hidden');
    return;
  }
  loadingBackdrop.classList.add('hidden');
};

const showToast = (message, type = 'success') => {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2600);
};

const getToken = () => localStorage.getItem(TOKEN_KEY);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

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
    window.location.href = './index.html';
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    body = {};
  }

  if (!response.ok) {
    const message = body?.message || body?.error || 'Có lỗi xảy ra, vui lòng thử lại.';
    throw new Error(message);
  }

  return body;
};

const setSessionState = (admin) => {
  if (!admin) return;
  adminName.textContent = admin.friendCode || 'Admin';
  adminMeta.textContent = admin.providerType ? `${admin.friendCode} · ${admin.providerType}` : admin.friendCode;
  sessionState.textContent = `Đăng nhập: ${admin.friendCode || ''}`;
  sessionState.classList.remove('offline');
};

const ensureSession = async () => {
  const token = getToken();
  if (!token) {
    window.location.href = './index.html';
    return;
  }

  try {
    const { admin } = await apiFetch('session');
    if (!admin) {
      throw new Error('Phiên đăng nhập không hợp lệ.');
    }
    setSessionState(admin);
  } catch (error) {
    clearToken();
    window.location.href = './index.html';
  }
};

const updateLanguageCount = () => {
  languageCount.textContent = `${languages.length} bản ghi`;
};

const renderLanguages = () => {
  updateLanguageCount();

  if (!languages.length) {
    languageGrid.innerHTML = '<div class="docker-empty">Chưa có cấu hình ngôn ngữ nào.</div>';
    return;
  }

  languageGrid.innerHTML = languages
    .map(
      (language) => `
        <article class="data-row">
          <div class="row-main">
            <div class="code-badge">${escapeHtml(language.code)}</div>
            <div class="row-text">
              <p class="row-label">Tiếng Việt</p>
              <p class="row-value">${escapeHtml(language.vietnamText)}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Tiếng Anh</p>
              <p class="row-value">${escapeHtml(language.englishText)}</p>
            </div>
          </div>
          <div class="row-actions">
            <button class="chip-action chip-button" data-action="edit" data-code="${escapeHtml(
              language.code
            )}">Sửa</button>
            <button class="chip-action chip-button danger" data-action="delete" data-code="${escapeHtml(
              language.code
            )}">Xóa</button>
          </div>
        </article>
      `
    )
    .join('');
};

const fetchLanguages = async () => {
  setLoading(true, 'Đang tải grid ngôn ngữ...');
  try {
    const data = await apiFetch('languages');
    languages = Array.isArray(data) ? data : data?.languages || [];
    renderLanguages();
  } catch (error) {
    languageGrid.innerHTML = `<div class="docker-error">${escapeHtml(
      error.message || 'Không thể tải dữ liệu.'
    )}</div>`;
    showToast(error.message || 'Không thể tải dữ liệu.', 'error');
  } finally {
    setLoading(false);
  }
};

const resetForm = () => {
  languageForm.reset();
  editingCode = null;
  submitButton.textContent = 'Thêm cấu hình';
  formTitle.textContent = 'Thêm mới config';
  formMode.textContent = 'Thêm mới';
  formMode.className = 'pill neutral';
  cancelEditButton.classList.add('hidden');
  codeInput.removeAttribute('readonly');
};

const startEdit = (code) => {
  const target = languages.find((lang) => lang.code === code);
  if (!target) return;

  editingCode = target.code;
  codeInput.value = target.code;
  codeInput.setAttribute('readonly', 'readonly');
  viInput.value = target.vietnamText;
  enInput.value = target.englishText;
  submitButton.textContent = 'Lưu thay đổi';
  formTitle.textContent = 'Chỉnh sửa config';
  formMode.textContent = 'Chỉnh sửa';
  formMode.className = 'pill warm';
  cancelEditButton.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const submitLanguage = async (event) => {
  event.preventDefault();
  const payload = {
    code: codeInput.value.trim(),
    vietnamText: viInput.value.trim(),
    englishText: enInput.value.trim(),
  };

  if (!payload.code || !payload.vietnamText || !payload.englishText) {
    showToast('Vui lòng nhập đầy đủ thông tin.', 'error');
    return;
  }

  const method = editingCode ? 'PUT' : 'POST';
  const endpoint = editingCode ? `languages/${encodeURIComponent(editingCode)}` : 'languages';
  const loadingLabel = editingCode ? 'Đang lưu chỉnh sửa...' : 'Đang thêm cấu hình...';

  setLoading(true, loadingLabel);
  try {
    const result = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    showToast(result?.message || 'Thao tác thành công.', 'success');
    await fetchLanguages();
    resetForm();
  } catch (error) {
    showToast(error.message || 'Không thể lưu cấu hình.', 'error');
  } finally {
    setLoading(false);
  }
};

const deleteLanguage = async (code) => {
  const confirmDelete = confirm(`Bạn chắc chắn muốn xóa config "${code}"?`);
  if (!confirmDelete) return;

  setLoading(true, 'Đang xóa cấu hình...');
  try {
    const result = await apiFetch(`languages/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
    showToast(result?.message || 'Đã xóa cấu hình.', 'success');
    await fetchLanguages();
    if (editingCode === code) {
      resetForm();
    }
  } catch (error) {
    showToast(error.message || 'Không thể xóa cấu hình.', 'error');
  } finally {
    setLoading(false);
  }
};

languageGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const code = button.getAttribute('data-code');
  const action = button.getAttribute('data-action');

  if (action === 'edit') {
    startEdit(code);
  }

  if (action === 'delete') {
    deleteLanguage(code);
  }
});

languageForm.addEventListener('submit', submitLanguage);
cancelEditButton.addEventListener('click', resetForm);

logoutButton.addEventListener('click', () => {
  clearToken();
  window.location.href = './index.html';
});

backDashboardButton.addEventListener('click', () => {
  window.location.href = './index.html';
});

ensureSession().then(fetchLanguages);
