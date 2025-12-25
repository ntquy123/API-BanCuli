const sessionState = document.getElementById('session-state');
const adminName = document.getElementById('admin-name');
const adminMeta = document.getElementById('admin-meta');
const logoutButton = document.getElementById('logout');
const backDashboardButton = document.getElementById('back-dashboard');
const dockerGrid = document.getElementById('docker-grid');
const dockerCount = document.getElementById('docker-count');
const refreshButton = document.getElementById('refresh-docker');
const searchInput = document.getElementById('docker-search');
const paginationInfo = document.getElementById('pagination-info');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const loadingBackdrop = document.getElementById('loading-backdrop');
const loadingText = document.getElementById('loading-text');
const toast = document.getElementById('toast');
const logModal = document.getElementById('log-modal');
const logTitle = document.getElementById('log-title');
const logContent = document.getElementById('log-content');
const closeLogButton = document.getElementById('close-log');

const TOKEN_KEY = 'admin_ui_token';
const PAGE_SIZE = 10;

let containers = [];
let searchTerm = '';
let currentPage = 1;

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

const updateDockerCount = (filteredLength = containers.length) => {
  if (filteredLength !== containers.length) {
    dockerCount.textContent = `${filteredLength}/${containers.length} container`;
    return;
  }
  dockerCount.textContent = `${containers.length} container`;
};

const getFilteredContainers = () => {
  const keyword = searchTerm.trim().toLowerCase();
  if (!keyword) return [...containers];

  return containers.filter((container) => {
    const values = [
      container.name,
      container.id,
      container.image,
      container.ports,
      container.status,
      container.roomTypeName,
      container.isBusy === true ? 'bận' : container.isBusy === false ? 'trống' : '',
      container.hasStarted === true ? 'đã bắt đầu' : container.hasStarted === false ? 'chưa bắt đầu' : '',
    ];
    return values.some((value) => value?.toString().toLowerCase().includes(keyword));
  });
};

const updatePaginationControls = (filteredLength, totalPages) => {
  const hasData = filteredLength > 0;
  const displayTotalPages = hasData ? totalPages : 0;
  const displayCurrentPage = hasData ? currentPage : 0;

  paginationInfo.textContent = `Trang ${displayCurrentPage}/${displayTotalPages}`;
  prevPageButton.disabled = !hasData || currentPage === 1;
  nextPageButton.disabled = !hasData || currentPage === totalPages;
};

const renderContainers = () => {
  const filtered = getFilteredContainers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = filtered.length ? Math.min(currentPage, totalPages) : 1;

  updateDockerCount(filtered.length);
  updatePaginationControls(filtered.length, totalPages);

  if (!filtered.length) {
    const message = searchTerm.trim()
      ? `Không tìm thấy container cho từ khóa "${escapeHtml(searchTerm)}".`
      : 'Không có container nào đang chạy.';
    dockerGrid.innerHTML = `<div class="docker-empty">${message}</div>`;
    return;
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  dockerGrid.innerHTML = pageItems
    .map(
      (container) => `
        <article class="data-row">
          <div class="row-main docker-row">
            <div class="code-badge">${escapeHtml(container.name || container.id)}</div>
            <div class="row-text">
              <p class="row-label">Image</p>
              <p class="row-value">${escapeHtml(container.image || 'Không rõ')}</p>
              <p class="row-note">ID: ${escapeHtml(container.id || '—')}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Trạng thái</p>
              <p class="row-value">${escapeHtml(container.status || 'Unknown')}</p>
              <p class="row-note">Ports: ${escapeHtml(container.ports || '—')}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Tài nguyên</p>
              <p class="row-value">CPU: ${escapeHtml(container.cpu || '—')}</p>
              <p class="row-note">RAM: ${escapeHtml(container.memory || '—')}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Loại phòng</p>
              <p class="row-value">${escapeHtml(container.roomTypeName || 'Không rõ')}</p>
              <p class="row-note">TypeMatchGid: ${escapeHtml(container.typeMatchGid ?? '—')}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Trạng thái phòng</p>
              <p class="row-value">${
                container.isBusy === true
                  ? 'Đang bận'
                  : container.isBusy === false
                    ? 'Đang trống'
                    : 'Không rõ'
              }</p>
              <p class="row-note">isBusy: ${escapeHtml(container.isBusy ?? '—')}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Bắt đầu game</p>
              <p class="row-value">${container.hasStarted ? 'Đã bắt đầu' : 'Chưa bắt đầu'}</p>
              <p class="row-note">Room: ${escapeHtml(container.roomNameRef || '—')}</p>
            </div>
          </div>
          <div class="row-actions">
            <button
              class="chip-action chip-button"
              data-action="log"
              data-id="${escapeHtml(container.id)}"
              data-name="${escapeHtml(container.name)}"
            >
              Xem log
            </button>
          </div>
        </article>
      `,
    )
    .join('');
};

const fetchContainers = async () => {
  setLoading(true, 'Đang tải danh sách container...');
  try {
    const data = await apiFetch('containers');
    containers = Array.isArray(data?.containers) ? data.containers : data || [];
    currentPage = 1;
    renderContainers();
  } catch (error) {
    dockerGrid.innerHTML = `<div class="docker-error">${escapeHtml(
      error.message || 'Không thể tải danh sách container.',
    )}</div>`;
    showToast(error.message || 'Không thể tải danh sách container.', 'error');
  } finally {
    setLoading(false);
  }
};

const openLogModal = (title) => {
  logTitle.textContent = title;
  logModal.classList.remove('hidden');
};

const closeLogModal = () => {
  logModal.classList.add('hidden');
  logContent.textContent = '';
};

const loadContainerLog = async (containerId, name) => {
  openLogModal(name ? `Log · ${name}` : 'Log container');
  logContent.textContent = 'Đang tải log...';
  try {
    const { logs } = await apiFetch(`containers/${encodeURIComponent(containerId)}/logs`);
    logContent.textContent = logs || 'Không có log để hiển thị.';
  } catch (error) {
    logContent.textContent = error.message || 'Không thể tải log.';
    showToast(error.message || 'Không thể tải log.', 'error');
  }
};

backDashboardButton?.addEventListener('click', () => {
  window.location.href = './index.html';
});

logoutButton.addEventListener('click', () => {
  clearToken();
  window.location.href = './index.html';
});

refreshButton.addEventListener('click', fetchContainers);

searchInput.addEventListener('input', (event) => {
  searchTerm = event.target.value;
  currentPage = 1;
  renderContainers();
});

prevPageButton.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderContainers();
  }
});

nextPageButton.addEventListener('click', () => {
  const filtered = getFilteredContainers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage < totalPages) {
    currentPage += 1;
    renderContainers();
  }
});

closeLogButton.addEventListener('click', closeLogModal);

logModal.addEventListener('click', (event) => {
  if (event.target === logModal) {
    closeLogModal();
  }
});

dockerGrid.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  if (action !== 'log') return;

  const containerId = target.dataset.id;
  const name = target.dataset.name;
  if (!containerId) return;

  loadContainerLog(containerId, name);
});

(async () => {
  await ensureSession();
  await fetchContainers();
})();
