/* ============ حالة عامة ============ */
let CURRENT_USER = JSON.parse(sessionStorage.getItem('connect_user') || 'null');
let CURRENT_SECTION = 'dashboard';
let CACHE = {}; // كاش بسيط للبيانات المجلوبة من الشيت

const root = document.getElementById('root');

/* ============ اتصال بالـ API ============ */

async function api(action, payload) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('PASTE_') === 0) {
    throw new Error('https://script.google.com/macros/s/AKfycbwZJYstsoQpr5duvtN-qiml-AdceTQwA_S7Xy75zOccQQsO4gP_L6r7dfR0p7yLC2o3/exec');
  }
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action: action }, payload || {}))
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'حصل خطأ غير معروف');
  return data;
}

function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 3000);
}

/* ============ تسجيل الدخول ============ */

function renderLogin(errorMsg) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="logo-mark">C</div>
        <h1>${SHOP_NAME}</h1>
        <p class="subtitle">نظام إدارة المحل — سجّل دخولك للمتابعة</p>
        ${errorMsg ? `<div class="error-msg">${errorMsg}</div>` : ''}
        <form id="login-form">
          <div class="field">
            <label>اسم المستخدم</label>
            <input type="text" name="username" required autocomplete="username" />
          </div>
          <div class="field">
            <label>كلمة المرور</label>
            <input type="password" name="password" required autocomplete="current-password" />
          </div>
          <button class="btn btn-primary btn-block" type="submit">دخول</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'جاري الدخول...';
    try {
      const data = await api('login', { username: fd.get('username'), password: fd.get('password') });
      CURRENT_USER = data.user;
      sessionStorage.setItem('connect_user', JSON.stringify(CURRENT_USER));
      renderApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function logout() {
  sessionStorage.removeItem('connect_user');
  CURRENT_USER = null;
  renderLogin();
}

/* ============ الهيكل الرئيسي ============ */

const NAV_ITEMS = [
  { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
  { id: 'scan', label: 'بيع بالباركود', icon: '🔍' },
  { id: 'maintenance', label: 'الصيانة', icon: '🛠️' },
  { id: 'accessories', label: 'الإكسسوارات', icon: '🎧' },
  { id: 'devices', label: 'الأجهزة', icon: '📱' },
  { id: 'cash', label: 'تحويلات الكاش', icon: '💵' },
  { id: 'inventory', label: 'المخزون', icon: '📦' },
  { id: 'accounting', label: 'الحسابات', icon: '📊' },
  { id: 'users', label: 'الموظفين', icon: '👤', adminOnly: true }
];

function renderApp() {
  if (!CURRENT_USER) return renderLogin();

  const navHtml = NAV_ITEMS
    .filter(function (item) { return !item.adminOnly || CURRENT_USER.role === 'مدير النظام'; })
    .map(function (item) {
      return `<li><button class="nav-btn ${item.id === CURRENT_SECTION ? 'active' : ''}" data-nav="${item.id}">
        <span>${item.icon}</span><span class="label">${item.label}</span>
      </button></li>`;
    }).join('');

  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="logo-mark">C</div>
          <div><strong>${SHOP_NAME}</strong><span>موبايلات واكسسوارات</span></div>
        </div>
        <ul class="nav-list">${navHtml}</ul>
        <div class="user-box">
          <div class="name">${CURRENT_USER.name}</div>
          <div class="role">${CURRENT_USER.role}</div>
          <button class="btn btn-outline btn-sm btn-block" id="logout-btn">تسجيل الخروج</button>
        </div>
      </aside>
      <div class="main-area">
        <div class="topbar">
          <div>
            <h2 id="page-title"></h2>
            <div class="breadcrumb" id="page-breadcrumb"></div>
          </div>
        </div>
        <div class="content" id="page-content"></div>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-nav]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      CURRENT_SECTION = btn.getAttribute('data-nav');
      renderApp();
    });
  });
  document.getElementById('logout-btn').addEventListener('click', logout);

  const titleMap = {};
  NAV_ITEMS.forEach(function (i) { titleMap[i.id] = i.label; });
  document.getElementById('page-title').textContent = titleMap[CURRENT_SECTION] || '';

  const renderers = {
    dashboard: renderDashboard,
    scan: renderScan,
    maintenance: renderMaintenance,
    accessories: renderAccessories,
    devices: renderDevices,
    cash: renderCash,
    inventory: renderInventory,
    accounting: renderAccounting,
    users: renderUsers
  };
  (renderers[CURRENT_SECTION] || renderDashboard)();
}

function content() { return document.getElementById('page-content'); }

function setBreadcrumb(text) {
  document.getElementById('page-breadcrumb').textContent = text || '';
}

/* ============ مودال عام ============ */

function openModal(title, bodyHtml, onMount) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal"><h3>${title}</h3><div id="modal-body">${bodyHtml}</div></div>`;
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  if (onMount) onMount(overlay);
  return overlay;
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(function (m) { m.remove(); });
}

/* ============ الرئيسية (Dashboard) ============ */

async function renderDashboard() {
  setBreadcrumb('نظرة عامة سريعة');
  content().innerHTML = `<div class="empty-state">جاري تحميل البيانات...</div>`;
  try {
    const [maint, accSales, devSales, accItems, devices] = await Promise.all([
      api('listMaintenance'), api('listAccessorySales'), api('listDeviceSales'),
      api('listAccessoryItems'), api('listDevices')
    ]);
    const today = new Date().toISOString().substring(0, 10);
    const todaySales = [].concat(maint.items, accSales.items, devSales.items)
      .filter(function (r) { return String(r.date).substring(0, 10) === today; });
    const todayTotal = todaySales.reduce(function (s, r) { return s + Number(r.total || r.totalPrice || 0); }, 0);
    const todayProfit = todaySales.reduce(function (s, r) { return s + Number(r.profitCost || r.profitPrice || 0); }, 0);
    const lowStock = accItems.items.filter(function (i) { return Number(i.quantity) <= 2; }).length
      + devices.items.filter(function (i) { return Number(i.quantity) <= 2; }).length;

    content().innerHTML = `
      <div class="grid grid-4">
        <div class="card stat-card"><div class="stat-label">مبيعات اليوم</div><div class="stat-value brown">${todayTotal.toLocaleString()} ج.م</div></div>
        <div class="card stat-card"><div class="stat-label">أرباح اليوم</div><div class="stat-value dark">${todayProfit.toLocaleString()} ج.م</div></div>
        <div class="card stat-card"><div class="stat-label">عمليات اليوم</div><div class="stat-value dark">${todaySales.length}</div></div>
        <div class="card stat-card"><div class="stat-label">أصناف على وشك النفاذ</div><div class="stat-value brown">${lowStock}</div></div>
      </div>
      <div class="card" style="margin-top:20px">
        <h3 style="margin-top:0">آخر العمليات اليوم</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الوقت</th><th>النوع</th><th>العميل</th><th>الإجمالي</th><th>الموظف</th></tr></thead>
            <tbody>
              ${todaySales.slice(-10).reverse().map(function (r) {
                const type = r.deviceCategory ? 'صيانة' : (r.categoryName ? 'اكسسوار' : 'جهاز');
                return `<tr><td>${String(r.date).substring(11)}</td><td>${type}</td><td>${r.customerName || '-'}</td>
                <td>${Number(r.total || r.totalPrice || 0).toLocaleString()} ج.م</td><td>${r.employee || '-'}</td></tr>`;
              }).join('') || `<tr><td colspan="5" class="empty-state">لا توجد عمليات اليوم بعد</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    content().innerHTML = `<div class="empty-state">تعذر تحميل البيانات: ${err.message}</div>`;
  }
}

/* ============ بيع بالباركود / الكود ============ */

let scanCustomer = { name: '', phone: '' };

async function renderScan() {
  setBreadcrumb('اكتب كود المنتج أو امسحه بالباركود');
  content().innerHTML = `
    <div class="card" style="max-width:520px">
      <h3 style="margin-top:0">بيانات العميل</h3>
      <div class="grid grid-2">
        <div class="field"><label>اسم العميل</label><input type="text" id="scan-customer-name" value="${scanCustomer.name}" /></div>
        <div class="field"><label>رقم العميل</label><input type="text" id="scan-customer-phone" value="${scanCustomer.phone}" /></div>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0" />
      <h3 style="margin-top:0">كود المنتج</h3>
      <div class="field">
        <label>امسح الباركود بالسكانر أو اكتب الكود يدويًا واضغط Enter</label>
        <input type="text" id="scan-code-input" placeholder="مثال: 123456" autocomplete="off" />
      </div>
      <button class="btn btn-primary btn-block" id="scan-search-btn">بحث عن المنتج</button>
    </div>
    <div id="scan-result" style="max-width:520px;margin-top:16px"></div>
  `;

  const codeInput = document.getElementById('scan-code-input');
  codeInput.focus();
  codeInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doScanSearch(); }
  });
  document.getElementById('scan-search-btn').addEventListener('click', doScanSearch);
}

function readScanCustomer() {
  scanCustomer.name = document.getElementById('scan-customer-name').value.trim();
  scanCustomer.phone = document.getElementById('scan-customer-phone').value.trim();
}

async function doScanSearch() {
  readScanCustomer();
  const code = document.getElementById('scan-code-input').value.trim();
  const resultBox = document.getElementById('scan-result');
  if (!code) { toast('اكتب أو امسح كود المنتج الأول', 'error'); return; }
  resultBox.innerHTML = `<div class="empty-state">جاري البحث...</div>`;
  try {
    const data = await api('findProductByCode', { code: code });
    if (data.found) {
      renderScanFoundProduct(data, code);
    } else {
      renderScanNotFound(code);
    }
  } catch (err) {
    resultBox.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderScanFoundProduct(data, code) {
  const item = data.item;
  const label = data.type === 'accessory' ? item.categoryName : (item.condition + ' - ' + item.warranty);
  const resultBox = document.getElementById('scan-result');
  const outOfStock = Number(item.quantity) <= 0;
  resultBox.innerHTML = `
    <div class="card">
      <div class="badge badge-success">تم إيجاد المنتج</div>
      <h3>${item.name}</h3>
      <p style="color:#888;margin:4px 0">${label} — الكود: ${item.code}</p>
      <div class="row" style="display:flex;justify-content:space-between;font-size:15px;margin:10px 0">
        <span>السعر الإجمالي</span><strong>${Number(item.totalPrice).toLocaleString()} ج.م</strong>
      </div>
      <div class="row" style="display:flex;justify-content:space-between;font-size:14px;color:#888;margin-bottom:14px">
        <span>الكمية المتاحة</span><span>${item.quantity}</span>
      </div>
      ${outOfStock
        ? `<div class="error-msg">الكمية غير متاحة في المخزون</div>`
        : `<button class="btn btn-primary btn-block" id="confirm-scan-sell">تأكيد البيع للعميل</button>`}
    </div>
  `;
  if (!outOfStock) {
    document.getElementById('confirm-scan-sell').addEventListener('click', async function () {
      readScanCustomer();
      if (!scanCustomer.name || !scanCustomer.phone) {
        toast('محتاج اسم العميل ورقمه الأول', 'error'); return;
      }
      try {
        const result = await api('sellByCode', {
          code: code, customerName: scanCustomer.name, customerPhone: scanCustomer.phone, employee: CURRENT_USER.name
        });
        toast('تم تسجيل عملية البيع', 'success');
        printReceipt({
          customerName: scanCustomer.name, customerPhone: scanCustomer.phone,
          productName: result.sale.itemName || result.sale.deviceName,
          employee: CURRENT_USER.name, total: result.sale.totalPrice
        });
        document.getElementById('scan-code-input').value = '';
        document.getElementById('scan-result').innerHTML = '';
        document.getElementById('scan-code-input').focus();
      } catch (err) { toast(err.message, 'error'); }
    });
  }
}

function renderScanNotFound(code) {
  const resultBox = document.getElementById('scan-result');
  resultBox.innerHTML = `
    <div class="card">
      <div class="badge badge-danger">مفيش منتج بالكود ده</div>
      <p style="color:#888">الكود <strong>${code}</strong> مش مسجل في النظام. تقدر تضيفه دلوقتي كمنتج جديد وهيتباع فورًا للعميل.</p>
      <div class="grid grid-2">
        <button class="btn btn-dark" id="scan-add-accessory">إضافة كإكسسوار</button>
        <button class="btn btn-dark" id="scan-add-device">إضافة كجهاز</button>
      </div>
    </div>
  `;
  document.getElementById('scan-add-accessory').addEventListener('click', function () { openScanAddAccessoryForm(code); });
  document.getElementById('scan-add-device').addEventListener('click', function () { openScanAddDeviceForm(code); });
}

async function openScanAddAccessoryForm(code) {
  readScanCustomer();
  let categories = [];
  try { categories = (await api('listAccessoryCategories')).items; } catch (e) { /* ignore */ }
  const overlay = openModal('إضافة منتج جديد — كود ' + code, `
    <form id="scan-item-form">
      <div class="field">
        <label>النوع</label>
        <select name="categoryId" required>
          <option value="">اختر النوع...</option>
          ${categories.map(function (c) { return `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`; }).join('')}
          <option value="__new__">+ نوع جديد</option>
        </select>
      </div>
      <div class="field hidden" id="new-cat-field"><label>اسم النوع الجديد</label><input name="newCategoryName" /></div>
      <div class="field"><label>اسم الصنف</label><input name="name" required /></div>
      <div class="grid grid-2">
        <div class="field"><label>سعر الجملة</label><input type="number" name="wholesalePrice" value="0" required /></div>
        <div class="field"><label>سعر المكسب</label><input type="number" name="profitPrice" value="0" required /></div>
      </div>
      <div class="field"><label>الكمية</label><input type="number" name="quantity" value="1" required /></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">حفظ وبيع للعميل</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    const catSelect = el.querySelector('[name=categoryId]');
    catSelect.addEventListener('change', function () {
      el.querySelector('#new-cat-field').classList.toggle('hidden', catSelect.value !== '__new__');
    });
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#scan-item-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        let categoryId = fd.get('categoryId');
        let categoryName;
        if (categoryId === '__new__') {
          const newCat = await api('addAccessoryCategory', { name: fd.get('newCategoryName') });
          categoryId = newCat.item.id; categoryName = newCat.item.name;
        } else {
          categoryName = catSelect.options[catSelect.selectedIndex].getAttribute('data-name');
        }
        await api('addAccessoryItem', {
          code: code, categoryId: categoryId, categoryName: categoryName, name: fd.get('name'),
          wholesalePrice: fd.get('wholesalePrice'), profitPrice: fd.get('profitPrice'), quantity: fd.get('quantity')
        });
        overlay.remove();
        toast('تمت إضافة المنتج، جاري البيع...', 'success');
        await sellScannedProductNow(code);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function openScanAddDeviceForm(code) {
  readScanCustomer();
  const overlay = openModal('إضافة جهاز جديد — كود ' + code, `
    <form id="scan-device-form">
      <div class="field">
        <label>الحالة</label>
        <select name="condition" required>
          <option value="جديد">جديد</option>
          <option value="مستعمل">مستعمل</option>
        </select>
      </div>
      <div class="field"><label>اسم الجهاز</label><input name="name" required /></div>
      <div class="field">
        <label>الضمان</label>
        <select name="warranty" required>
          <option value="له ضمان">له ضمان</option>
          <option value="بدون ضمان">بدون ضمان</option>
        </select>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>سعر الجملة</label><input type="number" name="wholesalePrice" value="0" required /></div>
        <div class="field"><label>سعر المكسب</label><input type="number" name="profitPrice" value="0" required /></div>
      </div>
      <div class="field"><label>الكمية</label><input type="number" name="quantity" value="1" required /></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">حفظ وبيع للعميل</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#scan-device-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('addDevice', {
          code: code, condition: fd.get('condition'), name: fd.get('name'), warranty: fd.get('warranty'),
          wholesalePrice: fd.get('wholesalePrice'), profitPrice: fd.get('profitPrice'), quantity: fd.get('quantity')
        });
        overlay.remove();
        toast('تمت إضافة الجهاز، جاري البيع...', 'success');
        await sellScannedProductNow(code);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

async function sellScannedProductNow(code) {
  if (!scanCustomer.name || !scanCustomer.phone) {
    toast('المنتج اتضاف بنجاح، ادخل بيانات العميل وابحث بنفس الكود تاني عشان تكمل البيع', 'success');
    renderScan();
    return;
  }
  try {
    const result = await api('sellByCode', {
      code: code, customerName: scanCustomer.name, customerPhone: scanCustomer.phone, employee: CURRENT_USER.name
    });
    toast('تم البيع بنجاح', 'success');
    printReceipt({
      customerName: scanCustomer.name, customerPhone: scanCustomer.phone,
      productName: result.sale.itemName || result.sale.deviceName,
      employee: CURRENT_USER.name, total: result.sale.totalPrice
    });
    renderScan();
  } catch (err) { toast(err.message, 'error'); }
}

/* ============ الصيانة ============ */

let maintenanceTab = 'هاردوير';

async function renderMaintenance() {
  setBreadcrumb('هاردوير وسوفتوير — كشف أعطال أو عطل معروف');
  content().innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${maintenanceTab === 'هاردوير' ? 'active' : ''}" data-tab="هاردوير">هاردوير</button>
      <button class="tab-btn ${maintenanceTab === 'سوفتوير' ? 'active' : ''}" data-tab="سوفتوير">سوفتوير</button>
    </div>
    <div class="section-header">
      <div class="toolbar">
        <input type="text" id="maint-search" placeholder="بحث باسم العميل أو الجهاز..." />
        <select id="maint-filter-case">
          <option value="">كل الحالات</option>
          <option value="كشف اعطال">كشف أعطال</option>
          <option value="عطل معروف">عطل معروف</option>
        </select>
      </div>
      <button class="btn btn-primary" id="add-maint-btn">+ إضافة عملية صيانة</button>
    </div>
    <div id="maint-table" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `;

  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { maintenanceTab = b.getAttribute('data-tab'); renderMaintenance(); });
  });
  document.getElementById('add-maint-btn').addEventListener('click', openMaintenanceForm);
  document.getElementById('maint-search').addEventListener('input', loadMaintenanceTable);
  document.getElementById('maint-filter-case').addEventListener('change', loadMaintenanceTable);

  await loadMaintenanceTable();
}

async function loadMaintenanceTable() {
  const search = (document.getElementById('maint-search') || {}).value || '';
  const caseFilter = (document.getElementById('maint-filter-case') || {}).value || '';
  try {
    const data = await api('listMaintenance');
    let rows = data.items.filter(function (r) { return r.deviceCategory === maintenanceTab; });
    if (caseFilter) rows = rows.filter(function (r) { return r.caseType === caseFilter; });
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(function (r) {
        return (r.customerName || '').toLowerCase().includes(q) || (r.deviceType || '').toLowerCase().includes(q);
      });
    }
    rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    document.getElementById('maint-table').innerHTML = rows.length ? `
      <table>
        <thead><tr>
          <th>التاريخ</th><th>الحالة</th><th>نوع الجهاز</th><th>العطل</th><th>العميل</th><th>الهاتف</th>
          <th>سعر الجملة</th><th>المكسب</th><th>الإجمالي</th><th>الموظف</th>
        </tr></thead>
        <tbody>
          ${rows.map(function (r) {
            return `<tr>
              <td>${r.date}</td>
              <td><span class="badge ${r.caseType === 'كشف اعطال' ? 'badge-slate' : 'badge-brown'}">${r.caseType}</span></td>
              <td>${r.deviceType || '-'}</td><td>${r.faultType || '-'}</td>
              <td>${r.customerName || '-'}</td><td>${r.customerPhone || '-'}</td>
              <td>${Number(r.wholesaleCost).toLocaleString()}</td>
              <td>${Number(r.profitCost).toLocaleString()}</td>
              <td><strong>${Number(r.total).toLocaleString()}</strong></td>
              <td>${r.employee || '-'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : `<div class="empty-state">لا توجد عمليات مطابقة</div>`;
  } catch (err) {
    document.getElementById('maint-table').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function openMaintenanceForm() {
  const body = `
    <form id="maint-form">
      <div class="field">
        <label>نوع الحالة</label>
        <select name="caseType" required>
          <option value="كشف اعطال">كشف أعطال</option>
          <option value="عطل معروف">عطل معروف</option>
        </select>
      </div>
      <div class="field"><label>نوع الجهاز</label><input name="deviceType" required /></div>
      <div class="field hidden" id="fault-field"><label>اسم العطل</label><input name="faultType" /></div>
      <div class="field"><label>اسم العميل</label><input name="customerName" /></div>
      <div class="field hidden" id="phone-field"><label>رقم العميل</label><input name="customerPhone" /></div>
      <div class="grid grid-2">
        <div class="field"><label>التكلفة (سعر الجملة)</label><input type="number" name="wholesaleCost" value="0" required /></div>
        <div class="field"><label>تكلفة المكسب</label><input type="number" name="profitCost" value="0" required /></div>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">حفظ</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `;
  const overlay = openModal('إضافة عملية صيانة — ' + maintenanceTab, body, function (el) {
    const caseSelect = el.querySelector('[name=caseType]');
    function toggleFields() {
      const known = caseSelect.value === 'عطل معروف';
      el.querySelector('#fault-field').classList.toggle('hidden', !known);
      el.querySelector('#phone-field').classList.toggle('hidden', !known);
    }
    caseSelect.addEventListener('change', toggleFields);
    toggleFields();
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#maint-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const result = await api('addMaintenance', {
          deviceCategory: maintenanceTab,
          caseType: fd.get('caseType'),
          deviceType: fd.get('deviceType'),
          faultType: fd.get('faultType'),
          customerName: fd.get('customerName'),
          customerPhone: fd.get('customerPhone'),
          wholesaleCost: fd.get('wholesaleCost'),
          profitCost: fd.get('profitCost'),
          employee: CURRENT_USER.name
        });
        overlay.remove();
        toast('تمت إضافة عملية الصيانة', 'success');
        printReceipt({
          customerName: result.item.customerName, customerPhone: result.item.customerPhone,
          productName: (result.item.deviceType || '') + ' - صيانة ' + maintenanceTab,
          employee: result.item.employee, total: result.item.total
        });
        loadMaintenanceTable();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

/* ============ الإكسسوارات ============ */

let currentAccCategory = null;

async function renderAccessories() {
  currentAccCategory = null;
  setBreadcrumb('اختر نوع الإكسسوار');
  content().innerHTML = `<div class="empty-state">جاري التحميل...</div>`;
  try {
    const [catData, itemData] = await Promise.all([api('listAccessoryCategories'), api('listAccessoryItems')]);
    const cats = catData.items;
    content().innerHTML = `
      <div class="section-header">
        <div></div>
        <button class="btn btn-primary" id="add-cat-btn">+ إضافة نوع جديد</button>
      </div>
      <div class="grid grid-4" id="cat-grid">
        ${cats.map(function (c) {
          const count = itemData.items.filter(function (i) { return i.categoryId === c.id; }).length;
          return `<div class="category-box" data-cat-id="${c.id}" data-cat-name="${c.name}">
            <div class="icon">🎧</div><div class="name">${c.name}</div><div class="count">${count} صنف</div>
          </div>`;
        }).join('') || '<div class="empty-state">لا توجد أنواع بعد، أضف أول نوع</div>'}
      </div>
    `;
    document.getElementById('add-cat-btn').addEventListener('click', openAddCategoryForm);
    document.querySelectorAll('[data-cat-id]').forEach(function (box) {
      box.addEventListener('click', function () {
        renderAccessoryItems(box.getAttribute('data-cat-id'), box.getAttribute('data-cat-name'));
      });
    });
  } catch (err) {
    content().innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function openAddCategoryForm() {
  const overlay = openModal('إضافة نوع إكسسوار جديد', `
    <form id="cat-form">
      <div class="field"><label>اسم النوع (مثال: سماعات، شواحن)</label><input name="name" required /></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">حفظ</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#cat-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('addAccessoryCategory', { name: fd.get('name') });
        overlay.remove();
        toast('تمت إضافة النوع', 'success');
        renderAccessories();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

async function renderAccessoryItems(catId, catName) {
  setBreadcrumb('الإكسسوارات / ' + catName);
  content().innerHTML = `
    <div class="section-header">
      <button class="link-btn" id="back-cats">→ رجوع لكل الأنواع</button>
      <div class="toolbar">
        <input type="text" id="item-search" placeholder="بحث باسم الصنف..." />
        <button class="btn btn-outline btn-sm" id="add-item-btn">+ إضافة صنف</button>
      </div>
    </div>
    <div id="items-table" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `;
  document.getElementById('back-cats').addEventListener('click', renderAccessories);
  document.getElementById('add-item-btn').addEventListener('click', function () { openAddItemForm(catId, catName); });
  document.getElementById('item-search').addEventListener('input', function () { loadItemsTable(catId); });
  await loadItemsTable(catId);
}

async function loadItemsTable(catId) {
  const search = (document.getElementById('item-search') || {}).value || '';
  try {
    const data = await api('listAccessoryItems');
    let rows = data.items.filter(function (i) { return i.categoryId === catId; });
    if (search) rows = rows.filter(function (i) { return i.name.toLowerCase().includes(search.toLowerCase()); });
    document.getElementById('items-table').innerHTML = rows.length ? `
      <table>
        <thead><tr><th>الكود</th><th>الاسم</th><th>سعر الجملة</th><th>سعر المكسب</th><th>الإجمالي</th><th>الكمية</th><th>تاريخ الإضافة</th><th></th></tr></thead>
        <tbody>
          ${rows.map(function (i) {
            return `<tr>
              <td><span class="badge badge-slate">${i.code || '-'}</span></td>
              <td>${i.name}</td><td>${Number(i.wholesalePrice).toLocaleString()}</td>
              <td>${Number(i.profitPrice).toLocaleString()}</td><td><strong>${Number(i.totalPrice).toLocaleString()}</strong></td>
              <td>${i.quantity <= 2 ? '<span class="badge badge-danger">' + i.quantity + '</span>' : i.quantity}</td>
              <td>${i.dateAdded}</td>
              <td><button class="btn btn-primary btn-sm" data-sell-id="${i.id}">بيع للعميل</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : `<div class="empty-state">لا توجد أصناف في هذا النوع بعد</div>`;

    document.querySelectorAll('[data-sell-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { openSellAccessoryForm(btn.getAttribute('data-sell-id'), catId); });
    });
  } catch (err) {
    document.getElementById('items-table').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function openAddItemForm(catId, catName) {
  const overlay = openModal('إضافة صنف جديد — ' + catName, `
    <form id="item-form">
      <div class="field"><label>اسم الصنف</label><input name="name" required /></div>
      <div class="field"><label>كود المنتج (اختياري — سيبه فاضي عشان يتولد تلقائي)</label><input name="code" placeholder="اختياري" /></div>
      <div class="grid grid-2">
        <div class="field"><label>سعر الجملة</label><input type="number" name="wholesalePrice" value="0" required /></div>
        <div class="field"><label>سعر المكسب</label><input type="number" name="profitPrice" value="0" required /></div>
      </div>
      <div class="field"><label>الكمية</label><input type="number" name="quantity" value="1" required /></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">حفظ</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#item-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('addAccessoryItem', {
          categoryId: catId, categoryName: catName, name: fd.get('name'), code: fd.get('code'),
          wholesalePrice: fd.get('wholesalePrice'), profitPrice: fd.get('profitPrice'), quantity: fd.get('quantity')
        });
        overlay.remove();
        toast('تمت إضافة الصنف', 'success');
        loadItemsTable(catId);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function openSellAccessoryForm(itemId, catId) {
  const overlay = openModal('بيع للعميل', `
    <form id="sell-form">
      <div class="field"><label>اسم العميل</label><input name="customerName" required /></div>
      <div class="field"><label>رقم العميل</label><input name="customerPhone" required /></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">تأكيد البيع</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#sell-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const result = await api('sellAccessoryItem', {
          itemId: itemId, customerName: fd.get('customerName'), customerPhone: fd.get('customerPhone'), employee: CURRENT_USER.name
        });
        overlay.remove();
        toast('تم تسجيل عملية البيع', 'success');
        printReceipt({
          customerName: result.sale.customerName, customerPhone: result.sale.customerPhone,
          productName: result.sale.itemName, employee: result.sale.employee, total: result.sale.totalPrice
        });
        loadItemsTable(catId);
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

/* ============ الأجهزة ============ */

let deviceTab = 'جديد';

async function renderDevices() {
  setBreadcrumb('أجهزة جديدة ومستعملة');
  content().innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${deviceTab === 'جديد' ? 'active' : ''}" data-tab="جديد">جديد</button>
      <button class="tab-btn ${deviceTab === 'مستعمل' ? 'active' : ''}" data-tab="مستعمل">مستعمل</button>
    </div>
    <div class="section-header">
      <input type="text" id="device-search" placeholder="بحث باسم الجهاز..." />
      <button class="btn btn-primary" id="add-device-btn">+ إضافة جهاز</button>
    </div>
    <div id="devices-table" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `;
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { deviceTab = b.getAttribute('data-tab'); renderDevices(); });
  });
  document.getElementById('add-device-btn').addEventListener('click', openAddDeviceForm);
  document.getElementById('device-search').addEventListener('input', loadDevicesTable);
  await loadDevicesTable();
}

async function loadDevicesTable() {
  const search = (document.getElementById('device-search') || {}).value || '';
  try {
    const data = await api('listDevices');
    let rows = data.items.filter(function (d) { return d.condition === deviceTab; });
    if (search) rows = rows.filter(function (d) { return d.name.toLowerCase().includes(search.toLowerCase()); });
    document.getElementById('devices-table').innerHTML = rows.length ? `
      <table>
        <thead><tr><th>الكود</th><th>الاسم</th><th>الضمان</th><th>سعر الجملة</th><th>سعر المكسب</th><th>الإجمالي</th><th>الكمية</th><th></th></tr></thead>
        <tbody>
          ${rows.map(function (d) {
            return `<tr>
              <td><span class="badge badge-slate">${d.code || '-'}</span></td>
              <td>${d.name}</td>
              <td><span class="badge ${d.warranty === 'له ضمان' ? 'badge-success' : 'badge-slate'}">${d.warranty}</span></td>
              <td>${Number(d.wholesalePrice).toLocaleString()}</td><td>${Number(d.profitPrice).toLocaleString()}</td>
              <td><strong>${Number(d.totalPrice).toLocaleString()}</strong></td>
              <td>${d.quantity <= 2 ? '<span class="badge badge-danger">' + d.quantity + '</span>' : d.quantity}</td>
              <td><button class="btn btn-primary btn-sm" data-sell-device="${d.id}">بيع للعميل</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : `<div class="empty-state">لا توجد أجهزة ${deviceTab} بعد</div>`;
    document.querySelectorAll('[data-sell-device]').forEach(function (btn) {
      btn.addEventListener('click', function () { openSellDeviceForm(btn.getAttribute('data-sell-device')); });
    });
  } catch (err) {
    document.getElementById('devices-table').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function openAddDeviceForm() {
  const overlay = openModal('إضافة جهاز — ' + deviceTab, `
    <form id="device-form">
      <div class="field"><label>اسم الجهاز</label><input name="name" required /></div>
      <div class="field"><label>كود المنتج (اختياري — سيبه فاضي عشان يتولد تلقائي)</label><input name="code" placeholder="اختياري" /></div>
      <div class="field">
        <label>الضمان</label>
        <select name="warranty" required>
          <option value="له ضمان">له ضمان</option>
          <option value="بدون ضمان">بدون ضمان</option>
        </select>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>سعر الجملة</label><input type="number" name="wholesalePrice" value="0" required /></div>
        <div class="field"><label>سعر المكسب</label><input type="number" name="profitPrice" value="0" required /></div>
      </div>
      <div class="field"><label>الكمية</label><input type="number" name="quantity" value="1" required /></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">حفظ</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#device-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('addDevice', {
          condition: deviceTab, name: fd.get('name'), warranty: fd.get('warranty'), code: fd.get('code'),
          wholesalePrice: fd.get('wholesalePrice'), profitPrice: fd.get('profitPrice'), quantity: fd.get('quantity')
        });
        overlay.remove();
        toast('تمت إضافة الجهاز', 'success');
        loadDevicesTable();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

function openSellDeviceForm(deviceId) {
  const overlay = openModal('بيع جهاز للعميل', `
    <form id="sell-device-form">
      <div class="field"><label>اسم العميل</label><input name="customerName" required /></div>
      <div class="field"><label>رقم العميل</label><input name="customerPhone" required /></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">تأكيد البيع</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#sell-device-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const result = await api('sellDevice', {
          deviceId: deviceId, customerName: fd.get('customerName'), customerPhone: fd.get('customerPhone'), employee: CURRENT_USER.name
        });
        overlay.remove();
        toast('تم تسجيل بيع الجهاز', 'success');
        printReceipt({
          customerName: result.sale.customerName, customerPhone: result.sale.customerPhone,
          productName: result.sale.deviceName, employee: result.sale.employee, total: result.sale.totalPrice
        });
        loadDevicesTable();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

/* ============ تحويلات الكاش ============ */

async function renderCash() {
  setBreadcrumb('سحب وإيداع');
  content().innerHTML = `
    <div class="section-header">
      <input type="text" id="cash-search" placeholder="بحث باسم العميل..." />
      <button class="btn btn-primary" id="add-cash-btn">+ عملية جديدة</button>
    </div>
    <div id="cash-table" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `;
  document.getElementById('add-cash-btn').addEventListener('click', openCashForm);
  document.getElementById('cash-search').addEventListener('input', loadCashTable);
  await loadCashTable();
}

async function loadCashTable() {
  const search = (document.getElementById('cash-search') || {}).value || '';
  try {
    const data = await api('listCashTransfers');
    let rows = data.items;
    if (search) rows = rows.filter(function (r) { return (r.customerName || '').toLowerCase().includes(search.toLowerCase()); });
    rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    document.getElementById('cash-table').innerHTML = rows.length ? `
      <table>
        <thead><tr><th>التاريخ</th><th>النوع</th><th>العميل</th><th>الهاتف</th><th>المبلغ</th><th>الموظف</th></tr></thead>
        <tbody>
          ${rows.map(function (r) {
            return `<tr>
              <td>${r.date}</td>
              <td><span class="badge ${r.type === 'ايداع' ? 'badge-success' : 'badge-brown'}">${r.type}</span></td>
              <td>${r.customerName}</td><td>${r.customerPhone}</td>
              <td><strong>${Number(r.amount).toLocaleString()}</strong></td><td>${r.employee}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : `<div class="empty-state">لا توجد عمليات بعد</div>`;
  } catch (err) {
    document.getElementById('cash-table').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function openCashForm() {
  const overlay = openModal('عملية تحويل كاش', `
    <form id="cash-form">
      <div class="field">
        <label>نوع العملية</label>
        <select name="type" required>
          <option value="ايداع">إيداع</option>
          <option value="سحب">سحب</option>
        </select>
      </div>
      <div class="field"><label>اسم العميل</label><input name="customerName" required /></div>
      <div class="field"><label>رقم العميل</label><input name="customerPhone" required /></div>
      <div class="field"><label>المبلغ</label><input type="number" name="amount" required /></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">حفظ</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#cash-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('addCashTransfer', {
          type: fd.get('type'), customerName: fd.get('customerName'), customerPhone: fd.get('customerPhone'),
          amount: fd.get('amount'), employee: CURRENT_USER.name
        });
        overlay.remove();
        toast('تم تسجيل العملية', 'success');
        loadCashTable();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

/* ============ المخزون ============ */

async function renderInventory() {
  setBreadcrumb('كل المنتجات المتاحة بالمحل');
  content().innerHTML = `
    <div class="tabs">
      <button class="tab-btn active" data-inv-tab="accessories">الإكسسوارات</button>
      <button class="tab-btn" data-inv-tab="devices">الأجهزة</button>
    </div>
    <div id="inventory-body"></div>
  `;
  document.querySelectorAll('[data-inv-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-inv-tab]').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      loadInventoryBody(b.getAttribute('data-inv-tab'));
    });
  });
  await loadInventoryBody('accessories');
}

async function loadInventoryBody(mode) {
  const wrap = document.getElementById('inventory-body');
  wrap.innerHTML = `<div class="empty-state">جاري التحميل...</div>`;
  try {
    if (mode === 'accessories') {
      const [cats, items] = await Promise.all([api('listAccessoryCategories'), api('listAccessoryItems')]);
      wrap.innerHTML = `
        <div class="grid grid-3">
          ${cats.items.map(function (c) {
            const list = items.items.filter(function (i) { return i.categoryId === c.id; });
            const totalQty = list.reduce(function (s, i) { return s + Number(i.quantity); }, 0);
            return `<div class="card">
              <h3 style="margin-top:0">${c.name} <span class="badge badge-brown">${totalQty} قطعة</span></h3>
              ${list.length ? list.map(function (i) {
                return `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                  <div style="display:flex;justify-content:space-between"><strong>${i.name}</strong><span>${i.quantity <= 2 ? '<span class="badge badge-danger">' + i.quantity + '</span>' : i.quantity}</span></div>
                  <div style="color:#888">إجمالي السعر: ${Number(i.totalPrice).toLocaleString()} ج.م — أُضيف: ${i.dateAdded}</div>
                </div>`;
              }).join('') : '<div class="empty-state" style="padding:12px">لا توجد أصناف</div>'}
            </div>`;
          }).join('') || '<div class="empty-state">لا توجد أنواع إكسسوارات بعد</div>'}
        </div>
      `;
    } else {
      const data = await api('listDevices');
      wrap.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>الاسم</th><th>الحالة</th><th>الضمان</th><th>الإجمالي</th><th>الكمية</th><th>تاريخ الإضافة</th></tr></thead>
            <tbody>
              ${data.items.map(function (d) {
                return `<tr><td>${d.name}</td><td>${d.condition}</td><td>${d.warranty}</td>
                <td>${Number(d.totalPrice).toLocaleString()}</td>
                <td>${d.quantity <= 2 ? '<span class="badge badge-danger">' + d.quantity + '</span>' : d.quantity}</td>
                <td>${d.dateAdded}</td></tr>`;
              }).join('') || '<tr><td colspan="6" class="empty-state">لا توجد أجهزة</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

/* ============ الحسابات ============ */

async function renderAccounting() {
  setBreadcrumb('تقارير يومية / شهرية / سنوية');
  content().innerHTML = `
    <div class="tabs">
      <button class="tab-btn active" data-acc-view="daily">يومي</button>
      <button class="tab-btn" data-acc-view="monthly">شهري</button>
      <button class="tab-btn" data-acc-view="yearly">سنوي</button>
      <button class="tab-btn" data-acc-view="category">حسب القسم</button>
    </div>
    <div id="accounting-body"></div>
  `;
  document.querySelectorAll('[data-acc-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-acc-view]').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      loadAccountingBody(b.getAttribute('data-acc-view'));
    });
  });
  await loadAccountingBody('daily');
}

async function loadAccountingBody(view) {
  const wrap = document.getElementById('accounting-body');
  wrap.innerHTML = `<div class="empty-state">جاري التحميل...</div>`;
  try {
    const data = await api('accountingSummary');
    const records = data.records;

    function groupBy(keyFn) {
      const map = {};
      records.forEach(function (r) {
        const key = keyFn(r);
        if (!map[key]) map[key] = { wholesale: 0, profit: 0, total: 0 };
        map[key].wholesale += r.wholesale;
        map[key].profit += r.profit;
        map[key].total += r.total;
      });
      return map;
    }

    let map, headLabel;
    if (view === 'daily') { map = groupBy(function (r) { return r.date; }); headLabel = 'اليوم'; }
    else if (view === 'monthly') { map = groupBy(function (r) { return r.date.substring(0, 7); }); headLabel = 'الشهر'; }
    else if (view === 'yearly') { map = groupBy(function (r) { return r.date.substring(0, 4); }); headLabel = 'السنة'; }
    else { map = groupBy(function (r) { return r.category; }); headLabel = 'القسم'; }

    const keys = Object.keys(map).sort().reverse();
    wrap.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>${headLabel}</th><th>سعر الجملة</th><th>المكسب</th><th>الإجمالي</th></tr></thead>
          <tbody>
            ${keys.map(function (k) {
              const v = map[k];
              return `<tr><td>${k}</td><td>${v.wholesale.toLocaleString()} ج.م</td>
              <td>${v.profit.toLocaleString()} ج.م</td><td><strong>${v.total.toLocaleString()} ج.م</strong></td></tr>`;
            }).join('') || '<tr><td colspan="4" class="empty-state">لا توجد بيانات بعد</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

/* ============ الموظفين ============ */

async function renderUsers() {
  if (CURRENT_USER.role !== 'مدير النظام') {
    content().innerHTML = `<div class="empty-state">هذا القسم لمدير النظام فقط</div>`;
    return;
  }
  setBreadcrumb('إدارة حسابات الموظفين');
  content().innerHTML = `
    <div class="section-header"><div></div><button class="btn btn-primary" id="add-user-btn">+ إضافة موظف</button></div>
    <div id="users-table" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `;
  document.getElementById('add-user-btn').addEventListener('click', openAddUserForm);
  await loadUsersTable();
}

async function loadUsersTable() {
  try {
    const data = await api('listUsers');
    document.getElementById('users-table').innerHTML = `
      <table>
        <thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>تاريخ الإنشاء</th></tr></thead>
        <tbody>
          ${data.items.map(function (u) {
            return `<tr><td>${u.name}</td><td>${u.username}</td>
            <td><span class="badge ${u.role === 'مدير النظام' ? 'badge-brown' : 'badge-slate'}">${u.role}</span></td>
            <td>${u.createdAt}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    document.getElementById('users-table').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function openAddUserForm() {
  const overlay = openModal('إضافة موظف جديد', `
    <form id="user-form">
      <div class="field"><label>اسم الموظف</label><input name="name" required /></div>
      <div class="field"><label>اسم المستخدم (يوزر نيم)</label><input name="username" required /></div>
      <div class="field"><label>كلمة المرور</label><input type="password" name="password" required /></div>
      <div class="field">
        <label>الصلاحية</label>
        <select name="role" required>
          <option value="حسابات">حسابات</option>
          <option value="مدير النظام">مدير النظام</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">حفظ</button>
        <button type="button" class="btn btn-outline" id="cancel-btn">إلغاء</button>
      </div>
    </form>
  `, function (el) {
    el.querySelector('#cancel-btn').addEventListener('click', function () { overlay.remove(); });
    el.querySelector('#user-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('addUser', {
          name: fd.get('name'), username: fd.get('username'), password: fd.get('password'), role: fd.get('role')
        });
        overlay.remove();
        toast('تمت إضافة الموظف', 'success');
        loadUsersTable();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}

/* ============ طباعة الإيصال ============ */

function printReceipt(data) {
  const win = window.open('', '_blank', 'width=340,height=520');
  win.document.write(`
    <html dir="rtl"><head><title>إيصال</title>
    <style>
      body { font-family: 'Courier New', monospace; padding: 16px; }
      .center { text-align: center; }
      hr { border: none; border-top: 1px dashed #000; }
      .row { display: flex; justify-content: space-between; margin: 6px 0; }
    </style></head>
    <body>
      <div class="center"><h2>${SHOP_NAME}</h2></div>
      <hr />
      <div class="row"><span>العميل:</span><span>${data.customerName || '-'}</span></div>
      <div class="row"><span>الهاتف:</span><span>${data.customerPhone || '-'}</span></div>
      <div class="row"><span>المنتج:</span><span>${data.productName || '-'}</span></div>
      <div class="row"><span>الموظف:</span><span>${data.employee || '-'}</span></div>
      <hr />
      <div class="row" style="font-weight:bold;font-size:18px"><span>الإجمالي:</span><span>${Number(data.total || 0).toLocaleString()} ج.م</span></div>
      <hr />
      <div class="center">شكرًا لتعاملكم معنا</div>
      <script>window.print();</script>
    </body></html>
  `);
  win.document.close();
}

/* ============ بدء التشغيل ============ */

if (CURRENT_USER) renderApp(); else renderLogin();
