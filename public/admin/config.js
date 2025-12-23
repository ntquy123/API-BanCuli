const sessionState = document.getElementById('session-state');
const adminName = document.getElementById('admin-name');
const adminMeta = document.getElementById('admin-meta');
const logoutButton = document.getElementById('logout');
const backDashboardButton = document.getElementById('back-dashboard');
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');

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
const searchInput = document.getElementById('language-search');
const paginationInfo = document.getElementById('pagination-info');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');

const generalGrid = document.getElementById('general-grid');
const generalCount = document.getElementById('general-count');
const generalForm = document.getElementById('general-form');
const generalCodeInput = document.getElementById('general-code');
const generalNameInput = document.getElementById('general-name');
const generalParentInput = document.getElementById('general-parent');
const generalDescriptionInput = document.getElementById('general-description');
const generalCancelEdit = document.getElementById('cancel-general-edit');
const generalSubmitButton = document.getElementById('submit-general');
const generalFormTitle = document.getElementById('general-form-title');
const generalFormMode = document.getElementById('general-form-mode');
const generalSearchInput = document.getElementById('general-search');
const generalPaginationInfo = document.getElementById('general-pagination');
const generalPrevButton = document.getElementById('general-prev');
const generalNextButton = document.getElementById('general-next');

const itemGrid = document.getElementById('item-grid');
const itemCount = document.getElementById('item-count');
const itemForm = document.getElementById('item-form');
const itemIdInput = document.getElementById('item-id');
const itemNameInput = document.getElementById('item-name');
const itemDescriptionInput = document.getElementById('item-description');
const itemLevelInput = document.getElementById('item-level');
const itemTypeInput = document.getElementById('item-type');
const itemLocationInput = document.getElementById('item-location');
const itemPriceInput = document.getElementById('item-price');
const itemPriceBallInput = document.getElementById('item-price-ball');
const itemElementInput = document.getElementById('item-element');
const itemLevelRequiredInput = document.getElementById('item-level-required');
const itemIsLevelUpSelect = document.getElementById('item-is-level-up');
const itemIsOpenSelect = document.getElementById('item-is-open');
const itemMassInput = document.getElementById('item-mass');
const itemGravityInput = document.getElementById('item-gravity');
const itemDragInput = document.getElementById('item-drag');
const itemBouncinessInput = document.getElementById('item-bounciness');
const itemElasticityInput = document.getElementById('item-elasticity');
const itemImpactInput = document.getElementById('item-impact');
const itemCancelEdit = document.getElementById('cancel-item-edit');
const itemSubmitButton = document.getElementById('submit-item');
const itemFormTitle = document.getElementById('item-form-title');
const itemFormMode = document.getElementById('item-form-mode');
const itemSearchInput = document.getElementById('item-search');
const itemPaginationInfo = document.getElementById('item-pagination');
const itemPrevButton = document.getElementById('item-prev');
const itemNextButton = document.getElementById('item-next');

const loadingBackdrop = document.getElementById('loading-backdrop');
const loadingText = document.getElementById('loading-text');
const toast = document.getElementById('toast');

const TOKEN_KEY = 'admin_ui_token';
const PAGE_SIZE = 10;

let languages = [];
let editingCode = null;
let searchTerm = '';
let currentPage = 1;

let generals = [];
let editingGeneral = null;
let generalSearchTerm = '';
let generalPage = 1;

let items = [];
let editingItem = null;
let itemSearchTerm = '';
let itemPage = 1;

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

const activateTab = (tabId) => {
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
  tabPanels.forEach((panel) => panel.classList.toggle('active', panel.dataset.tabPanel === tabId));
};

// Language helpers
const updateLanguageCount = (filteredLength = languages.length) => {
  if (filteredLength !== languages.length) {
    languageCount.textContent = `${filteredLength}/${languages.length} bản ghi`;
    return;
  }
  languageCount.textContent = `${languages.length} bản ghi`;
};

const getFilteredLanguages = () => {
  const keyword = searchTerm.trim().toLowerCase();
  if (!keyword) return [...languages];

  return languages.filter((language) => {
    const { code = '', vietnamText = '', englishText = '' } = language;
    return [code, vietnamText, englishText].some((value) => value.toString().toLowerCase().includes(keyword));
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

const renderLanguages = () => {
  const filtered = getFilteredLanguages();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = filtered.length ? Math.min(currentPage, totalPages) : 1;

  updateLanguageCount(filtered.length);
  updatePaginationControls(filtered.length, totalPages);

  if (!filtered.length) {
    const message = searchTerm.trim()
      ? `Không tìm thấy cấu hình cho từ khóa "${escapeHtml(searchTerm)}".`
      : 'Chưa có cấu hình ngôn ngữ nào.';
    languageGrid.innerHTML = `<div class="docker-empty">${message}</div>`;
    return;
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  languageGrid.innerHTML = pageItems
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
    currentPage = 1;
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

// SysMasGeneral helpers
const updateGeneralCount = (filteredLength = generals.length) => {
  generalCount.textContent =
    filteredLength !== generals.length
      ? `${filteredLength}/${generals.length} bản ghi`
      : `${generals.length} bản ghi`;
};

const getFilteredGenerals = () => {
  const keyword = generalSearchTerm.trim().toLowerCase();
  if (!keyword) return [...generals];

  return generals.filter((item) => {
    const { GenCode = '', GenName = '', description = '' } = item;
    return [GenCode, GenName, description || '']
      .map((value) => value?.toString().toLowerCase())
      .some((value) => value.includes(keyword));
  });
};

const updateGeneralPagination = (filteredLength, totalPages) => {
  const hasData = filteredLength > 0;
  const displayTotalPages = hasData ? totalPages : 0;
  const displayCurrentPage = hasData ? generalPage : 0;

  generalPaginationInfo.textContent = `Trang ${displayCurrentPage}/${displayTotalPages}`;
  generalPrevButton.disabled = !hasData || generalPage === 1;
  generalNextButton.disabled = !hasData || generalPage === totalPages;
};

const renderGenerals = () => {
  const filtered = getFilteredGenerals();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  generalPage = filtered.length ? Math.min(generalPage, totalPages) : 1;

  updateGeneralCount(filtered.length);
  updateGeneralPagination(filtered.length, totalPages);

  if (!filtered.length) {
    const message = generalSearchTerm.trim()
      ? `Không tìm thấy cấu hình cho từ khóa "${escapeHtml(generalSearchTerm)}".`
      : 'Chưa có cấu hình SysMasGeneral nào.';
    generalGrid.innerHTML = `<div class="docker-empty">${message}</div>`;
    return;
  }

  const startIndex = (generalPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  generalGrid.innerHTML = pageItems
    .map(
      (item) => `
        <article class="data-row">
          <div class="row-main">
            <div class="code-badge">${escapeHtml(item.GenCode)}</div>
            <div class="row-text">
              <p class="row-label">GenName</p>
              <p class="row-value">${escapeHtml(item.GenName)}</p>
            </div>
            <div class="row-text">
              <p class="row-label">ParentCode</p>
              <p class="row-value">${item.ParentCode ?? '—'}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Mô tả</p>
              <p class="row-value">${escapeHtml(item.description || '—')}</p>
            </div>
          </div>
          <div class="row-actions">
            <button class="chip-action chip-button" data-action="edit-general" data-code="${escapeHtml(
              item.GenCode
            )}">Sửa</button>
            <button class="chip-action chip-button danger" data-action="delete-general" data-code="${escapeHtml(
              item.GenCode
            )}">Xóa</button>
          </div>
        </article>
      `
    )
    .join('');
};

const fetchGenerals = async () => {
  setLoading(true, 'Đang tải SysMasGeneral...');
  try {
    const data = await apiFetch('generals');
    generals = Array.isArray(data) ? data : data?.generals || [];
    generalPage = 1;
    renderGenerals();
  } catch (error) {
    generalGrid.innerHTML = `<div class="docker-error">${escapeHtml(error.message || 'Không thể tải dữ liệu.')}</div>`;
    showToast(error.message || 'Không thể tải dữ liệu.', 'error');
  } finally {
    setLoading(false);
  }
};

const resetGeneralForm = () => {
  generalForm.reset();
  editingGeneral = null;
  generalSubmitButton.textContent = 'Thêm SysMasGeneral';
  generalFormTitle.textContent = 'Thêm mới SysMasGeneral';
  generalFormMode.textContent = 'Thêm mới';
  generalFormMode.className = 'pill neutral';
  generalCancelEdit.classList.add('hidden');
  generalCodeInput.removeAttribute('readonly');
};

const startGeneralEdit = (GenCode) => {
  const target = generals.find((item) => Number(item.GenCode) === Number(GenCode));
  if (!target) return;

  editingGeneral = target.GenCode;
  generalCodeInput.value = target.GenCode;
  generalCodeInput.setAttribute('readonly', 'readonly');
  generalNameInput.value = target.GenName;
  generalParentInput.value = target.ParentCode ?? '';
  generalDescriptionInput.value = target.description ?? '';
  generalSubmitButton.textContent = 'Lưu thay đổi';
  generalFormTitle.textContent = 'Chỉnh sửa SysMasGeneral';
  generalFormMode.textContent = 'Chỉnh sửa';
  generalFormMode.className = 'pill warm';
  generalCancelEdit.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const buildGeneralPayload = () => {
  const GenCode = Number(generalCodeInput.value);
  const GenName = generalNameInput.value.trim();
  const ParentCodeValue = generalParentInput.value;
  const ParentCode = ParentCodeValue === '' ? null : Number(ParentCodeValue);
  const description = generalDescriptionInput.value.trim() || null;

  if (!Number.isInteger(GenCode) || !GenName) {
    return { error: 'Vui lòng nhập GenCode (số nguyên) và GenName.' };
  }

  if (ParentCodeValue !== '' && !Number.isInteger(ParentCode)) {
    return { error: 'ParentCode phải là số nguyên.' };
  }

  return { GenCode, GenName, ParentCode, description };
};

const submitGeneral = async (event) => {
  event.preventDefault();
  const payload = buildGeneralPayload();

  if ('error' in payload) {
    showToast(payload.error, 'error');
    return;
  }

  const method = editingGeneral ? 'PUT' : 'POST';
  const endpoint = editingGeneral ? `generals/${encodeURIComponent(editingGeneral)}` : 'generals';
  const loadingLabel = editingGeneral ? 'Đang lưu chỉnh sửa...' : 'Đang thêm cấu hình...';

  setLoading(true, loadingLabel);
  try {
    const result = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(payload),
    });
    showToast(result?.message || 'Thao tác thành công.', 'success');
    await fetchGenerals();
    resetGeneralForm();
  } catch (error) {
    showToast(error.message || 'Không thể lưu cấu hình.', 'error');
  } finally {
    setLoading(false);
  }
};

const deleteGeneral = async (GenCode) => {
  if (!confirm(`Bạn chắc chắn muốn xóa GenCode "${GenCode}"?`)) return;
  setLoading(true, 'Đang xóa cấu hình...');
  try {
    const result = await apiFetch(`generals/${encodeURIComponent(GenCode)}`, { method: 'DELETE' });
    showToast(result?.message || 'Đã xóa cấu hình.', 'success');
    await fetchGenerals();
    if (editingGeneral === Number(GenCode)) {
      resetGeneralForm();
    }
  } catch (error) {
    showToast(error.message || 'Không thể xóa cấu hình.', 'error');
  } finally {
    setLoading(false);
  }
};

// Item helpers
const updateItemCount = (filteredLength = items.length) => {
  itemCount.textContent =
    filteredLength !== items.length ? `${filteredLength}/${items.length} bản ghi` : `${items.length} bản ghi`;
};

const getFilteredItems = () => {
  const keyword = itemSearchTerm.trim().toLowerCase();
  if (!keyword) return [...items];

  return items.filter((item) => {
    const fields = [item.id, item.name || '', item.description || ''];
    return fields
      .map((value) => value?.toString().toLowerCase())
      .some((value) => value.includes(keyword));
  });
};

const updateItemPagination = (filteredLength, totalPages) => {
  const hasData = filteredLength > 0;
  const displayTotalPages = hasData ? totalPages : 0;
  const displayCurrentPage = hasData ? itemPage : 0;

  itemPaginationInfo.textContent = `Trang ${displayCurrentPage}/${displayTotalPages}`;
  itemPrevButton.disabled = !hasData || itemPage === 1;
  itemNextButton.disabled = !hasData || itemPage === totalPages;
};

const renderItems = () => {
  const filtered = getFilteredItems();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  itemPage = filtered.length ? Math.min(itemPage, totalPages) : 1;

  updateItemCount(filtered.length);
  updateItemPagination(filtered.length, totalPages);

  if (!filtered.length) {
    const message = itemSearchTerm.trim()
      ? `Không tìm thấy item cho từ khóa "${escapeHtml(itemSearchTerm)}".`
      : 'Chưa có item nào.';
    itemGrid.innerHTML = `<div class="docker-empty">${message}</div>`;
    return;
  }

  const startIndex = (itemPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  itemGrid.innerHTML = pageItems
    .map(
      (item) => `
        <article class="data-row">
          <div class="row-main">
            <div class="code-badge">#${escapeHtml(item.id)}</div>
            <div class="row-text">
              <p class="row-label">Tên</p>
              <p class="row-value">${escapeHtml(item.name)}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Loại · Level</p>
              <p class="row-value">Type ${escapeHtml(item.typeGid)} · Level ${escapeHtml(item.level)}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Giá</p>
              <p class="row-value">${escapeHtml(item.price)} / Ball ${escapeHtml(item.priceByBall ?? '—')}</p>
            </div>
            <div class="row-text">
              <p class="row-label">Trạng thái</p>
              <p class="row-value">${item.isOpen ? 'Đang mở' : 'Đóng'} · ${
                item.isLevelUp ? 'Nâng cấp' : 'Không nâng cấp'
              }</p>
            </div>
          </div>
          <div class="row-actions">
            <button class="chip-action chip-button" data-action="edit-item" data-id="${escapeHtml(item.id)}">Sửa</button>
            <button class="chip-action chip-button danger" data-action="delete-item" data-id="${escapeHtml(
              item.id
            )}">Xóa</button>
          </div>
        </article>
      `
    )
    .join('');
};

const fetchItems = async () => {
  setLoading(true, 'Đang tải Item...');
  try {
    const data = await apiFetch('items');
    items = Array.isArray(data) ? data : data?.items || [];
    itemPage = 1;
    renderItems();
  } catch (error) {
    itemGrid.innerHTML = `<div class="docker-error">${escapeHtml(error.message || 'Không thể tải dữ liệu.')}</div>`;
    showToast(error.message || 'Không thể tải dữ liệu.', 'error');
  } finally {
    setLoading(false);
  }
};

const parseOptionalNumber = (value) => {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildItemPayload = () => {
  const id = Number(itemIdInput.value);
  const name = itemNameInput.value.trim();
  const description = itemDescriptionInput.value.trim();
  const level = Number(itemLevelInput.value);
  const typeGid = Number(itemTypeInput.value);
  const locationGid = Number(itemLocationInput.value);
  const price = Number(itemPriceInput.value);
  const priceByBall = parseOptionalNumber(itemPriceBallInput.value);
  const ElementType = parseOptionalNumber(itemElementInput.value);
  const Levelrequired = parseOptionalNumber(itemLevelRequiredInput.value);
  const isLevelUp = itemIsLevelUpSelect.value === 'true';
  const isOpen = itemIsOpenSelect.value === 'true';
  const Mass = parseOptionalNumber(itemMassInput.value);
  const GravityScale = parseOptionalNumber(itemGravityInput.value);
  const Drag = parseOptionalNumber(itemDragInput.value);
  const Bounciness = parseOptionalNumber(itemBouncinessInput.value);
  const Elasticity = parseOptionalNumber(itemElasticityInput.value);
  const ImpactResistance = parseOptionalNumber(itemImpactInput.value);

  const requiredNumbers = [id, level, typeGid, price, locationGid];
  if (requiredNumbers.some((num) => Number.isNaN(num))) {
    return { error: 'ID, Level, TypeGid, Giá và LocationGid phải là số.' };
  }

  if (!name || !description) {
    return { error: 'Tên và mô tả không được để trống.' };
  }

  return {
    id,
    name,
    description,
    level,
    typeGid,
    price,
    priceByBall,
    locationGid,
    isLevelUp,
    isOpen,
    ElementType,
    Levelrequired,
    Mass,
    GravityScale,
    Drag,
    Bounciness,
    Elasticity,
    ImpactResistance,
  };
};

const resetItemForm = () => {
  itemForm.reset();
  editingItem = null;
  itemSubmitButton.textContent = 'Thêm Item';
  itemFormTitle.textContent = 'Thêm mới Item';
  itemFormMode.textContent = 'Thêm mới';
  itemFormMode.className = 'pill neutral';
  itemCancelEdit.classList.add('hidden');
  itemIdInput.removeAttribute('readonly');
};

const startItemEdit = (id) => {
  const target = items.find((item) => Number(item.id) === Number(id));
  if (!target) return;

  editingItem = target.id;
  itemIdInput.value = target.id;
  itemIdInput.setAttribute('readonly', 'readonly');
  itemNameInput.value = target.name;
  itemDescriptionInput.value = target.description;
  itemLevelInput.value = target.level;
  itemTypeInput.value = target.typeGid;
  itemLocationInput.value = target.locationGid;
  itemPriceInput.value = target.price;
  itemPriceBallInput.value = target.priceByBall ?? '';
  itemElementInput.value = target.ElementType ?? '';
  itemLevelRequiredInput.value = target.Levelrequired ?? '';
  itemIsLevelUpSelect.value = target.isLevelUp ? 'true' : 'false';
  itemIsOpenSelect.value = target.isOpen ? 'true' : 'false';
  itemMassInput.value = target.Mass ?? '';
  itemGravityInput.value = target.GravityScale ?? '';
  itemDragInput.value = target.Drag ?? '';
  itemBouncinessInput.value = target.Bounciness ?? '';
  itemElasticityInput.value = target.Elasticity ?? '';
  itemImpactInput.value = target.ImpactResistance ?? '';
  itemSubmitButton.textContent = 'Lưu thay đổi';
  itemFormTitle.textContent = 'Chỉnh sửa Item';
  itemFormMode.textContent = 'Chỉnh sửa';
  itemFormMode.className = 'pill warm';
  itemCancelEdit.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const submitItem = async (event) => {
  event.preventDefault();
  const payload = buildItemPayload();

  if ('error' in payload) {
    showToast(payload.error, 'error');
    return;
  }

  const method = editingItem ? 'PUT' : 'POST';
  const endpoint = editingItem ? `items/${encodeURIComponent(editingItem)}` : 'items';
  const loadingLabel = editingItem ? 'Đang lưu item...' : 'Đang thêm item...';

  setLoading(true, loadingLabel);
  try {
    const result = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(payload),
    });
    showToast(result?.message || 'Thao tác thành công.', 'success');
    await fetchItems();
    resetItemForm();
  } catch (error) {
    showToast(error.message || 'Không thể lưu item.', 'error');
  } finally {
    setLoading(false);
  }
};

const deleteItem = async (id) => {
  if (!confirm(`Bạn chắc chắn muốn xóa item #${id}?`)) return;
  setLoading(true, 'Đang xóa item...');
  try {
    const result = await apiFetch(`items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast(result?.message || 'Đã xóa item.', 'success');
    await fetchItems();
    if (editingItem === Number(id)) {
      resetItemForm();
    }
  } catch (error) {
    showToast(error.message || 'Không thể xóa item.', 'error');
  } finally {
    setLoading(false);
  }
};

// Event bindings
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

generalGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const code = button.getAttribute('data-code');
  const action = button.getAttribute('data-action');

  if (action === 'edit-general') {
    startGeneralEdit(code);
  }

  if (action === 'delete-general') {
    deleteGeneral(code);
  }
});

itemGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.getAttribute('data-id');
  const action = button.getAttribute('data-action');

  if (action === 'edit-item') {
    startItemEdit(id);
  }

  if (action === 'delete-item') {
    deleteItem(id);
  }
});

languageForm.addEventListener('submit', submitLanguage);
itemForm.addEventListener('submit', submitItem);
generalForm.addEventListener('submit', submitGeneral);

cancelEditButton.addEventListener('click', resetForm);
generalCancelEdit.addEventListener('click', resetGeneralForm);
itemCancelEdit.addEventListener('click', resetItemForm);

logoutButton.addEventListener('click', () => {
  clearToken();
  window.location.href = './index.html';
});

backDashboardButton.addEventListener('click', () => {
  window.location.href = './index.html';
});

searchInput.addEventListener('input', (event) => {
  searchTerm = event.target.value;
  currentPage = 1;
  renderLanguages();
});

generalSearchInput.addEventListener('input', (event) => {
  generalSearchTerm = event.target.value;
  generalPage = 1;
  renderGenerals();
});

itemSearchInput.addEventListener('input', (event) => {
  itemSearchTerm = event.target.value;
  itemPage = 1;
  renderItems();
});

prevPageButton.addEventListener('click', () => {
  if (currentPage === 1) return;
  currentPage -= 1;
  renderLanguages();
});

nextPageButton.addEventListener('click', () => {
  const filtered = getFilteredLanguages();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage >= totalPages) return;
  currentPage += 1;
  renderLanguages();
});

generalPrevButton.addEventListener('click', () => {
  if (generalPage === 1) return;
  generalPage -= 1;
  renderGenerals();
});

generalNextButton.addEventListener('click', () => {
  const filtered = getFilteredGenerals();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (generalPage >= totalPages) return;
  generalPage += 1;
  renderGenerals();
});

itemPrevButton.addEventListener('click', () => {
  if (itemPage === 1) return;
  itemPage -= 1;
  renderItems();
});

itemNextButton.addEventListener('click', () => {
  const filtered = getFilteredItems();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (itemPage >= totalPages) return;
  itemPage += 1;
  renderItems();
});

Array.from(tabButtons).forEach((button) => {
  button.addEventListener('click', () => {
    const targetTab = button.dataset.tab;
    activateTab(targetTab);
  });
});

ensureSession()
  .then(async () => {
    await fetchLanguages();
    await fetchGenerals();
    await fetchItems();
  })
  .catch(() => {});
