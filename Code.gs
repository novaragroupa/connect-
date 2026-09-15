/**
 * CONNECT — نظام إدارة محل موبايلات وإكسسوارات
 * الباك اند: Google Apps Script فوق Google Sheets
 *
 * طريقة التركيب:
 * 1) افتح Google Sheet جديد فاضي.
 * 2) من القائمة: Extensions > Apps Script.
 * 3) امسح أي كود موجود، والصق هذا الملف كامل.
 * 4) نفّذ (Run) الدالة setupSheets() مرة واحدة فقط (هتطلب صلاحيات، وافق عليها).
 *    هي هتنشئ كل الشيتات المطلوبة + مستخدم مدير افتراضي.
 * 5) من Deploy > New deployment > اختر Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6) انسخ الرابط (Web app URL) وحطه في ملف web/config.js عندك في الموقع.
 *
 * أول يوزر بعد setupSheets():
 *   Username: admin
 *   Password: admin123
 * (غيّره فورًا من داخل النظام)
 */

// لو السكريبت "غير مربوط" بشيت (يعني عملته من script.google.com مباشرة ومش من
// جوه الشيت عن طريق Extensions > Apps Script)، لازم تحط رقم الشيت هنا.
// الرقم موجود في رابط الشيت نفسه بين /d/ و /edit، مثال:
// https://docs.google.com/spreadsheets/d/‎هذا_هو_الرقم‎/edit
const SPREADSHEET_ID = '1-MSLdTIkjpDS-v0QPDsTY4ymlkdNFH6WKjN4UvrD1yo';

function getSpreadsheet_() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.indexOf('PASTE_') !== 0) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('محتاج تحط SPREADSHEET_ID في أول الكود، أو تفتح هذا السكريبت من جوه الشيت نفسه عن طريق Extensions > Apps Script');
}

const SHEETS = {
  USERS: 'Users',
  MAINTENANCE: 'Maintenance',
  ACC_CATEGORIES: 'AccessoryCategories',
  ACC_ITEMS: 'AccessoryItems',
  ACC_SALES: 'AccessorySales',
  DEVICES: 'Devices',
  DEVICE_SALES: 'DeviceSales',
  CASH: 'CashTransfers'
};

const SCHEMAS = {
  Users: ['id', 'username', 'password', 'role', 'name', 'createdAt'],
  Maintenance: ['id', 'date', 'deviceCategory', 'caseType', 'deviceType', 'faultType',
    'customerName', 'customerPhone', 'wholesaleCost', 'profitCost', 'total', 'employee'],
  AccessoryCategories: ['id', 'name', 'createdAt'],
  AccessoryItems: ['id', 'code', 'categoryId', 'categoryName', 'name', 'wholesalePrice',
    'profitPrice', 'totalPrice', 'quantity', 'dateAdded'],
  AccessorySales: ['id', 'code', 'itemId', 'itemName', 'categoryName', 'customerName',
    'customerPhone', 'quantity', 'wholesalePrice', 'profitPrice', 'unitPrice', 'totalPrice', 'employee', 'date'],
  Devices: ['id', 'code', 'condition', 'name', 'wholesalePrice', 'profitPrice', 'totalPrice',
    'warranty', 'quantity', 'dateAdded'],
  DeviceSales: ['id', 'code', 'deviceId', 'deviceName', 'condition', 'warranty', 'customerName',
    'customerPhone', 'quantity', 'wholesalePrice', 'profitPrice', 'unitPrice', 'totalPrice', 'employee', 'date'],
  CashTransfers: ['id', 'type', 'customerName', 'customerPhone', 'amount', 'employee', 'date']
};

function setupSheets() {
  const ss = getSpreadsheet_();
  Object.keys(SCHEMAS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SCHEMAS[name]);
      sh.setFrozenRows(1);
    }
  });
  // امسح شيت "Sheet1" الافتراضي لو موجود وفاضي
  const def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0) ss.deleteSheet(def);

  // أضف مستخدم مدير افتراضي لو مفيش يوزرز
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  if (usersSheet.getLastRow() < 2) {
    usersSheet.appendRow([Utilities.getUuid(), 'admin', 'admin123', 'مدير النظام', 'المدير العام', new Date()]);
  }
}

/* ============ أدوات عامة ============ */

function getSheet_(name) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('الشيت غير موجود: ' + name);
  return sh;
}

function sheetToObjects_(sh) {
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = values.slice(1);
  return rows
    .map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    })
    .filter(function (obj) { return obj.id !== '' && obj.id !== undefined && obj.id !== null; });
}

function appendObject_(sh, headers, obj) {
  const row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
}

function findRowIndexById_(sh, id) {
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id');
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) return r + 1; // 1-based row number
  }
  return -1;
}

function updateCellByHeader_(sh, rowNum, headers, header, value) {
  const col = headers.indexOf(header) + 1;
  if (col > 0) sh.getRange(rowNum, col).setValue(value);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Africa/Cairo', 'yyyy-MM-dd HH:mm:ss');
}

/* ============ نقطة الدخول ============ */

function doGet(e) {
  return jsonOut_({ ok: true, message: 'CONNECT API شغال' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result;

    switch (action) {
      case 'login': result = login_(body); break;
      case 'addUser': result = addUser_(body); break;
      case 'listUsers': result = { items: sheetToObjects_(getSheet_(SHEETS.USERS)).map(stripPassword_) }; break;

      case 'addMaintenance': result = addMaintenance_(body); break;
      case 'listMaintenance': result = { items: sheetToObjects_(getSheet_(SHEETS.MAINTENANCE)) }; break;

      case 'addAccessoryCategory': result = addAccessoryCategory_(body); break;
      case 'listAccessoryCategories': result = { items: sheetToObjects_(getSheet_(SHEETS.ACC_CATEGORIES)) }; break;

      case 'addAccessoryItem': result = addAccessoryItem_(body); break;
      case 'listAccessoryItems': result = { items: sheetToObjects_(getSheet_(SHEETS.ACC_ITEMS)) }; break;
      case 'sellAccessoryItem': result = sellAccessoryItem_(body); break;
      case 'listAccessorySales': result = { items: sheetToObjects_(getSheet_(SHEETS.ACC_SALES)) }; break;

      case 'addDevice': result = addDevice_(body); break;
      case 'listDevices': result = { items: sheetToObjects_(getSheet_(SHEETS.DEVICES)) }; break;
      case 'sellDevice': result = sellDevice_(body); break;
      case 'listDeviceSales': result = { items: sheetToObjects_(getSheet_(SHEETS.DEVICE_SALES)) }; break;

      case 'addCashTransfer': result = addCashTransfer_(body); break;
      case 'listCashTransfers': result = { items: sheetToObjects_(getSheet_(SHEETS.CASH)) }; break;

      case 'accountingSummary': result = accountingSummary_(); break;

      case 'findProductByCode': result = findProductByCode_(body); break;
      case 'sellByCode': result = sellByCode_(body); break;

      default: result = { error: 'إجراء غير معروف: ' + action };
    }
    return jsonOut_(Object.assign({ ok: true }, result));
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function stripPassword_(u) {
  const copy = Object.assign({}, u);
  delete copy.password;
  return copy;
}

/* ============ المستخدمين ============ */

function login_(body) {
  const users = sheetToObjects_(getSheet_(SHEETS.USERS));
  const found = users.find(function (u) {
    return String(u.username) === String(body.username) && String(u.password) === String(body.password);
  });
  if (!found) return { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  return { user: stripPassword_(found) };
}

function addUser_(body) {
  const sh = getSheet_(SHEETS.USERS);
  const users = sheetToObjects_(sh);
  if (users.some(function (u) { return u.username === body.username; })) {
    return { error: 'اسم المستخدم موجود بالفعل' };
  }
  const obj = {
    id: Utilities.getUuid(),
    username: body.username,
    password: body.password,
    role: body.role, // 'مدير النظام' أو 'حسابات'
    name: body.name,
    createdAt: nowStr_()
  };
  appendObject_(sh, SCHEMAS.Users, obj);
  return { user: stripPassword_(obj) };
}

/* ============ الصيانة ============ */

function addMaintenance_(body) {
  const sh = getSheet_(SHEETS.MAINTENANCE);
  const wholesale = Number(body.wholesaleCost) || 0;
  const profit = Number(body.profitCost) || 0;
  const obj = {
    id: Utilities.getUuid(),
    date: nowStr_(),
    deviceCategory: body.deviceCategory, // هاردوير / سوفتوير
    caseType: body.caseType, // كشف اعطال / عطل معروف
    deviceType: body.deviceType || '',
    faultType: body.faultType || '',
    customerName: body.customerName || '',
    customerPhone: body.customerPhone || '',
    wholesaleCost: wholesale,
    profitCost: profit,
    total: wholesale + profit,
    employee: body.employee || ''
  };
  appendObject_(sh, SCHEMAS.Maintenance, obj);
  return { item: obj };
}

/* ============ الإكسسوارات ============ */

function addAccessoryCategory_(body) {
  const sh = getSheet_(SHEETS.ACC_CATEGORIES);
  const obj = { id: Utilities.getUuid(), name: body.name, createdAt: nowStr_() };
  appendObject_(sh, SCHEMAS.AccessoryCategories, obj);
  return { item: obj };
}

function genCode_() {
  // كود عددي فريد من 6 أرقام لو الموظف مكتبش كود يدوي أو من الماسح
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codeExists_(code) {
  const accItems = sheetToObjects_(getSheet_(SHEETS.ACC_ITEMS));
  const devices = sheetToObjects_(getSheet_(SHEETS.DEVICES));
  return accItems.some(function (i) { return String(i.code) === String(code); }) ||
    devices.some(function (d) { return String(d.code) === String(code); });
}

function addAccessoryItem_(body) {
  const sh = getSheet_(SHEETS.ACC_ITEMS);
  const wholesale = Number(body.wholesalePrice) || 0;
  const profit = Number(body.profitPrice) || 0;
  let code = (body.code || '').toString().trim();
  if (!code) { do { code = genCode_(); } while (codeExists_(code)); }
  else if (codeExists_(code)) { return { error: 'الكود ده مستخدم بالفعل لمنتج تاني' }; }
  const obj = {
    id: Utilities.getUuid(),
    code: code,
    categoryId: body.categoryId,
    categoryName: body.categoryName,
    name: body.name,
    wholesalePrice: wholesale,
    profitPrice: profit,
    totalPrice: wholesale + profit,
    quantity: Number(body.quantity) || 0,
    dateAdded: nowStr_()
  };
  appendObject_(sh, SCHEMAS.AccessoryItems, obj);
  return { item: obj };
}

function sellAccessoryItem_(body) {
  const sh = getSheet_(SHEETS.ACC_ITEMS);
  const rowNum = findRowIndexById_(sh, body.itemId);
  if (rowNum === -1) return { error: 'الصنف غير موجود' };
  const items = sheetToObjects_(sh);
  const item = items.find(function (i) { return String(i.id) === String(body.itemId); });
  const qty = Number(item.quantity) || 0;
  const sellQty = Math.max(1, Number(body.quantity) || 1);
  if (sellQty > qty) return { error: 'الكمية المطلوبة (' + sellQty + ') أكبر من المتاح بالمخزون (' + qty + ')' };

  updateCellByHeader_(sh, rowNum, SCHEMAS.AccessoryItems, 'quantity', qty - sellQty);

  const salesSh = getSheet_(SHEETS.ACC_SALES);
  const sale = {
    id: Utilities.getUuid(),
    code: item.code || '',
    itemId: item.id,
    itemName: item.name,
    categoryName: item.categoryName,
    customerName: body.customerName || '',
    customerPhone: body.customerPhone || '',
    quantity: sellQty,
    wholesalePrice: Number(item.wholesalePrice) * sellQty,
    profitPrice: Number(item.profitPrice) * sellQty,
    unitPrice: item.totalPrice,
    totalPrice: Number(item.totalPrice) * sellQty,
    employee: body.employee || '',
    date: nowStr_()
  };
  appendObject_(salesSh, SCHEMAS.AccessorySales, sale);
  return { sale: sale, remainingQuantity: qty - sellQty };
}

/* ============ الأجهزة ============ */

function addDevice_(body) {
  const sh = getSheet_(SHEETS.DEVICES);
  const wholesale = Number(body.wholesalePrice) || 0;
  const profit = Number(body.profitPrice) || 0;
  let code = (body.code || '').toString().trim();
  if (!code) { do { code = genCode_(); } while (codeExists_(code)); }
  else if (codeExists_(code)) { return { error: 'الكود ده مستخدم بالفعل لمنتج تاني' }; }
  const obj = {
    id: Utilities.getUuid(),
    code: code,
    condition: body.condition, // جديد / مستعمل
    name: body.name,
    wholesalePrice: wholesale,
    profitPrice: profit,
    totalPrice: wholesale + profit,
    warranty: body.warranty, // له ضمان / بدون ضمان
    quantity: Number(body.quantity) || 0,
    dateAdded: nowStr_()
  };
  appendObject_(sh, SCHEMAS.Devices, obj);
  return { item: obj };
}

function sellDevice_(body) {
  const sh = getSheet_(SHEETS.DEVICES);
  const rowNum = findRowIndexById_(sh, body.deviceId);
  if (rowNum === -1) return { error: 'الجهاز غير موجود' };
  const items = sheetToObjects_(sh);
  const dev = items.find(function (i) { return String(i.id) === String(body.deviceId); });
  const qty = Number(dev.quantity) || 0;
  const sellQty = Math.max(1, Number(body.quantity) || 1);
  if (sellQty > qty) return { error: 'الكمية المطلوبة (' + sellQty + ') أكبر من المتاح بالمخزون (' + qty + ')' };

  updateCellByHeader_(sh, rowNum, SCHEMAS.Devices, 'quantity', qty - sellQty);

  const salesSh = getSheet_(SHEETS.DEVICE_SALES);
  const sale = {
    id: Utilities.getUuid(),
    code: dev.code || '',
    deviceId: dev.id,
    deviceName: dev.name,
    condition: dev.condition,
    warranty: dev.warranty,
    customerName: body.customerName || '',
    customerPhone: body.customerPhone || '',
    quantity: sellQty,
    wholesalePrice: Number(dev.wholesalePrice) * sellQty,
    profitPrice: Number(dev.profitPrice) * sellQty,
    unitPrice: dev.totalPrice,
    totalPrice: Number(dev.totalPrice) * sellQty,
    employee: body.employee || '',
    date: nowStr_()
  };
  appendObject_(salesSh, SCHEMAS.DEVICE_SALES, sale);
  return { sale: sale, remainingQuantity: qty - sellQty };
}

/* ============ تحويلات الكاش ============ */

function addCashTransfer_(body) {
  const sh = getSheet_(SHEETS.CASH);
  const obj = {
    id: Utilities.getUuid(),
    type: body.type, // سحب / ايداع
    customerName: body.customerName || '',
    customerPhone: body.customerPhone || '',
    amount: Number(body.amount) || 0,
    employee: body.employee || '',
    date: nowStr_()
  };
  appendObject_(sh, SCHEMAS.CashTransfers, obj);
  return { item: obj };
}

/* ============ البحث بالكود / البيع بالباركود ============ */

function findProductByCode_(body) {
  const code = String(body.code || '').trim();
  if (!code) return { error: 'محتاج تدخل كود أو تمسح باركود المنتج' };

  const accItems = sheetToObjects_(getSheet_(SHEETS.ACC_ITEMS));
  const accMatch = accItems.find(function (i) { return String(i.code) === code; });
  if (accMatch) return { found: true, type: 'accessory', item: accMatch };

  const devices = sheetToObjects_(getSheet_(SHEETS.DEVICES));
  const devMatch = devices.find(function (d) { return String(d.code) === code; });
  if (devMatch) return { found: true, type: 'device', item: devMatch };

  return { found: false };
}

function sellByCode_(body) {
  const code = String(body.code || '').trim();
  const lookup = findProductByCode_({ code: code });
  if (lookup.error) return lookup;
  if (!lookup.found) return { error: 'مفيش منتج بالكود ده في النظام' };

  if (lookup.type === 'accessory') {
    return sellAccessoryItem_({
      itemId: lookup.item.id, customerName: body.customerName,
      customerPhone: body.customerPhone, employee: body.employee, quantity: body.quantity
    });
  }
  return sellDevice_({
    deviceId: lookup.item.id, customerName: body.customerName,
    customerPhone: body.customerPhone, employee: body.employee, quantity: body.quantity
  });
}

/* ============ الحسابات ============ */

function accountingSummary_() {
  const maintenance = sheetToObjects_(getSheet_(SHEETS.MAINTENANCE));
  const accSales = sheetToObjects_(getSheet_(SHEETS.ACC_SALES));
  const devSales = sheetToObjects_(getSheet_(SHEETS.DEVICE_SALES));

  function toRecord(date, wholesale, profit, total, category) {
    return { date: String(date).substring(0, 10), wholesale: Number(wholesale) || 0,
      profit: Number(profit) || 0, total: Number(total) || 0, category: category };
  }

  const records = [];
  maintenance.forEach(function (m) {
    records.push(toRecord(m.date, m.wholesaleCost, m.profitCost, m.total, 'صيانة'));
  });
  accSales.forEach(function (s) {
    records.push(toRecord(s.date, s.wholesalePrice, s.profitPrice, s.totalPrice, 'اكسسوارات'));
  });
  devSales.forEach(function (s) {
    records.push(toRecord(s.date, s.wholesalePrice, s.profitPrice, s.totalPrice, 'اجهزة'));
  });

  return { records: records };
}
