// ============================================================
// نظام POS المتكامل - إدارة المنتجات + نقطة البيع
// مع دعم Google Sheets (التجميع الذكي)
// ============================================================

// ---------- رابط Google Sheets API (غيّره إلى الرابط الخاص بك) ----------
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwC2UVYwIXUH638VEpvuOU0b9YAX7g-R4Z-5qvrFDY26jKLDLVXPhNA7-aLYXcBgL2v4A/exec';

// ---------- البيانات الأساسية ----------
let products = [];
let currentCart = [];
let dailySales = [];

// ---------- تحميل البيانات المحفوظة ----------
function loadData() {
    const savedProducts = localStorage.getItem('pos_products');
    const savedCart = localStorage.getItem('pos_cart');
    const savedDaily = localStorage.getItem('pos_dailySales');
    if (savedProducts) products = JSON.parse(savedProducts);
    if (savedCart) currentCart = JSON.parse(savedCart);
    if (savedDaily) dailySales = JSON.parse(savedDaily);

    if (document.getElementById('cartItemsContainer')) {
        renderCartModern();
        updateTotalsModern();
        renderSoldItemsModern();
    }
    if (document.getElementById('productsBody')) renderProductsTable();
    if (document.getElementById('productsGrid')) renderModernProductsGrid('');
}

function saveProducts() { localStorage.setItem('pos_products', JSON.stringify(products)); }
function saveCart() { localStorage.setItem('pos_cart', JSON.stringify(currentCart)); }
function saveDaily() { localStorage.setItem('pos_dailySales', JSON.stringify(dailySales)); }

// ========== إدارة المنتجات ==========
function addOrUpdateProduct(barcode, name, cost, price, stock) {
    if (!barcode || !name || cost <= 0 || price <= 0) {
        showFormMessage('املأ جميع الحقول بشكل صحيح (الأسعار أكبر من 0)', 'red');
        return false;
    }
    const index = products.findIndex(p => p.barcode === barcode);
    const newProduct = { barcode, name, cost: parseFloat(cost), price: parseFloat(price), stock: parseFloat(stock) };
    if (index !== -1) products[index] = newProduct;
    else products.push(newProduct);
    saveProducts();
    if (document.getElementById('productsGrid')) renderModernProductsGrid('');
    if (document.getElementById('productsBody')) renderProductsTable();
    showFormMessage(index !== -1 ? 'تم التحديث' : 'تمت الإضافة', 'green');
    return true;
}

function deleteProduct(barcode) {
    if (confirm('حذف المنتج نهائياً؟')) {
        products = products.filter(p => p.barcode !== barcode);
        saveProducts();
        renderProductsTable();
        if (document.getElementById('productsGrid')) renderModernProductsGrid('');
    }
}

function renderProductsTable() {
    const tbody = document.getElementById('productsBody');
    if (!tbody) return;
    const search = document.getElementById('searchProducts')?.value.toLowerCase() || '';
    let filtered = products.filter(p => p.name.toLowerCase().includes(search) || p.barcode.includes(search));
    if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="6">لا توجد منتجات. أضف منتجاً جديداً باستخدام النموذج أعلاه.</td></tr>'; return; }
    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>${escapeHtml(p.barcode)}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${p.cost.toFixed(2)}</td>
            <td>${p.price.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td><button class="delete-prod" data-barcode="${p.barcode}"><i class="fas fa-trash"></i> حذف</button></td>
        </tr>
    `).join('');
    document.querySelectorAll('.delete-prod').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.barcode)));
}

function showFormMessage(msg, color) {
    const div = document.getElementById('formMessage');
    if (div) { div.innerText = msg; div.style.color = color === 'red' ? '#ef476f' : '#06d6a0'; setTimeout(() => div.innerText = '', 2500); }
}

// ========== شبكة المنتجات الحديثة ==========
function renderModernProductsGrid(filter = '') {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    let filtered = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()) || p.barcode.includes(filter));
    if (!filtered.length) { grid.innerHTML = '<div class="empty-msg">لا توجد منتجات</div>'; return; }
    grid.innerHTML = filtered.map(p => `
        <div class="product-modern-card" data-barcode="${p.barcode}">
            <div class="product-icon"><i class="fas ${getIcon(p.name)}"></i></div>
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-price">${p.price.toFixed(2)} ل.س</div>
            <div class="product-stock">المتبقي: ${p.stock}</div>
            <button class="quick-add" data-barcode="${p.barcode}"><i class="fas fa-cart-plus"></i> أضف</button>
        </div>
    `).join('');
    document.querySelectorAll('.product-modern-card').forEach(card => {
        card.addEventListener('click', (e) => { if (!e.target.classList.contains('quick-add')) addToCart(card.dataset.barcode); });
        const btn = card.querySelector('.quick-add');
        if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); addToCart(btn.dataset.barcode); });
    });
}

function getIcon(name) {
    if (name.includes('خبز')) return 'fa-bread-slice';
    if (name.includes('حليب')) return 'fa-tint';
    if (name.includes('ماء')) return 'fa-water';
    if (name.includes('بيض')) return 'fa-egg';
    if (name.includes('جبن')) return 'fa-cheese';
    return 'fa-box';
}

// ========== السلة ==========
function addToCart(barcode, qty = 1) {
    const product = products.find(p => p.barcode === barcode);
    if (!product) { alert('المنتج غير موجود!'); return; }
    if (product.stock < qty) { alert(`الكمية المتوفرة فقط ${product.stock}`); return; }
    
    const existing = currentCart.find(i => i.barcode === barcode);
    if (existing) {
        existing.quantity += qty;
        existing.totalPrice = existing.quantity * existing.price;
        existing.totalProfit = existing.quantity * existing.profitPerUnit;
    } else {
        const profit = product.price - product.cost;
        currentCart.push({
            barcode: product.barcode,
            name: product.name,
            price: product.price,
            quantity: qty,
            cost: product.cost,
            profitPerUnit: profit,
            totalPrice: qty * product.price,
            totalProfit: qty * profit
        });
    }
    product.stock -= qty;
    saveProducts(); saveCart();
    renderCartModern(); updateTotalsModern();
    if (document.getElementById('productsGrid')) renderModernProductsGrid(document.getElementById('productSearchInput')?.value || '');
}

function removeCartItem(index) {
    const item = currentCart[index];
    const product = products.find(p => p.barcode === item.barcode);
    if (product) product.stock += item.quantity;
    currentCart.splice(index, 1);
    saveProducts(); saveCart();
    renderCartModern(); updateTotalsModern();
    if (document.getElementById('productsGrid')) renderModernProductsGrid(document.getElementById('productSearchInput')?.value || '');
}

function changeQty(index, delta) {
    const item = currentCart[index];
    const newQty = item.quantity + delta;
    if (newQty < 1) { removeCartItem(index); return; }
    const product = products.find(p => p.barcode === item.barcode);
    if (product && delta > 0 && product.stock < delta) { alert('الكمية غير متوفرة'); return; }
    if (product && delta > 0) product.stock -= delta;
    if (product && delta < 0) product.stock -= delta;
    item.quantity = newQty;
    item.totalPrice = newQty * item.price;
    item.totalProfit = newQty * item.profitPerUnit;
    saveProducts(); saveCart();
    renderCartModern(); updateTotalsModern();
    if (document.getElementById('productsGrid')) renderModernProductsGrid(document.getElementById('productSearchInput')?.value || '');
}

function renderCartModern() {
    const container = document.getElementById('cartItemsContainer');
    const badge = document.getElementById('cartCount');
    if (!container) return;
    if (!currentCart.length) { container.innerHTML = `<div class="empty-cart"><i class="fas fa-box-open"></i><p>السلة فارغة</p><span>اضغط على أي منتج لإضافته</span></div>`; if (badge) badge.innerText = '0'; return; }
    if (badge) badge.innerText = currentCart.reduce((s, i) => s + i.quantity, 0);
    container.innerHTML = currentCart.map((item, idx) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.name)}</div>
                <div class="cart-item-price">${item.price.toFixed(2)} ل.س</div>
            </div>
            <div class="cart-item-controls">
                <button class="qty-modern-btn" data-idx="${idx}" data-delta="-1">-</button>
                <span class="qty-modern">${item.quantity}</span>
                <button class="qty-modern-btn" data-idx="${idx}" data-delta="1">+</button>
                <button class="cart-item-remove" data-idx="${idx}"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.qty-modern-btn').forEach(btn => btn.addEventListener('click', (e) => { const idx = parseInt(btn.dataset.idx), delta = parseInt(btn.dataset.delta); changeQty(idx, delta); }));
    document.querySelectorAll('.cart-item-remove').forEach(btn => btn.addEventListener('click', (e) => { const idx = parseInt(btn.dataset.idx); removeCartItem(idx); }));
}

function updateTotalsModern() {
    const total = currentCart.reduce((s, i) => s + i.totalPrice, 0);
    const profit = currentCart.reduce((s, i) => s + i.totalProfit, 0);
    if (document.getElementById('totalSalesSpan')) document.getElementById('totalSalesSpan').innerText = total.toFixed(2);
    if (document.getElementById('totalProfitSpan')) document.getElementById('totalProfitSpan').innerText = profit.toFixed(2);
    if (document.getElementById('finalTotalSpan')) document.getElementById('finalTotalSpan').innerText = total.toFixed(2);
}

// ========== Google Sheets: إرسال المنتج للتجميع الذكي ==========
async function syncProductToSheets(product) {
    const now = new Date();
    const payload = {
        barcode: String(product.barcode),
        name: product.name,
        quantity: product.quantity,
        profit: product.totalProfit,
        price: product.price,
        cost: product.cost,
        date: now.toLocaleDateString('ar-EG'),
        time: now.toLocaleTimeString('ar-EG')
    };
    
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(`✅ تم تحديث المنتج ${product.name} في Google Sheets`);
    } catch (error) {
        console.error(`❌ فشل تحديث المنتج ${product.name}:`, error);
    }
}

// ========== إنهاء البيع ==========
function checkout() {
    if (!currentCart.length) { alert('السلة فارغة'); return; }
    
    const total = currentCart.reduce((s, i) => s + i.totalPrice, 0);
    const profit = currentCart.reduce((s, i) => s + i.totalProfit, 0);
    
    // حفظ الفاتورة محلياً لـ "مبيعات اليوم"
    dailySales.push({
        date: new Date().toLocaleString('ar-EG'),
        items: JSON.parse(JSON.stringify(currentCart)),
        total: total,
        profit: profit
    });
    saveDaily();
    
    // --- إرسال كل منتج إلى Google Sheets للتجميع الذكي ---
    currentCart.forEach(product => {
        syncProductToSheets(product);
    });
    // ---------------------------------------------------
    
    currentCart = [];
    saveCart();
    renderCartModern();
    updateTotalsModern();
    renderSoldItemsModern();
    
    alert(`✅ تم البيع\nالمجموع: ${total.toFixed(2)}\nالربح: ${profit.toFixed(2)}`);
}

function renderSoldItemsModern() {
    const container = document.getElementById('soldItemsList');
    if (!container) return;
    if (!dailySales.length) { container.innerHTML = '<span>لا توجد مبيعات اليوم</span>'; return; }
    container.innerHTML = dailySales.slice().reverse().map(s => `<span><i class="fas fa-receipt"></i> ${s.date} | المجموع: ${s.total.toFixed(2)} | الربح: ${s.profit.toFixed(2)}</span>`).join('');
}

function resetDaily() {
    if (confirm('مسح كل مبيعات اليوم والسلة الحالية؟')) {
        dailySales = [];
        currentCart = [];
        saveDaily();
        saveCart();
        renderCartModern();
        updateTotalsModern();
        renderSoldItemsModern();
        if (document.getElementById('productsGrid')) renderModernProductsGrid('');
    }
}

// ========== دعم قارئ الباركود USB والموبايل ==========
function initBarcodeScanner() {
    const scanInput = document.getElementById('barcodeScannerInput');
    if (!scanInput) return;
    scanInput.focus();
    const manualBtn = document.getElementById('manualScanBtn');
    if (manualBtn) {
        manualBtn.addEventListener('click', () => {
            const barcode = scanInput.value.trim();
            if (barcode) processScannedBarcode(barcode);
            else showScanFeedback('الرجاء إدخال الباركود أو مسحه', 'error');
        });
    }
    scanInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); const barcode = scanInput.value.trim(); if (barcode) processScannedBarcode(barcode); }
    });
    scanInput.addEventListener('blur', () => { setTimeout(() => scanInput.focus(), 100); });
}

function processScannedBarcode(barcode) {
    const scanInput = document.getElementById('barcodeScannerInput');
    const product = products.find(p => p.barcode === barcode);
    if (!product) {
        showScanFeedback(`❌ المنتج ذو الباركود "${barcode}" غير موجود!`, 'error');
        if (scanInput) { scanInput.style.border = '1px solid var(--danger)'; setTimeout(() => { if (scanInput) scanInput.style.border = ''; }, 500); }
        scanInput.value = ''; scanInput.focus();
        return;
    }
    if (product.stock <= 0) {
        showScanFeedback(`⚠️ المنتج "${product.name}" غير متوفر بالمخزون!`, 'error');
        scanInput.value = ''; scanInput.focus();
        return;
    }
    addToCart(barcode, 1);
    showScanFeedback(`✅ تم إضافة ${product.name} للسلة`, 'success');
    const addedCard = document.querySelector(`.product-modern-card[data-barcode="${barcode}"]`);
    if (addedCard) { addedCard.classList.add('scan-flash'); setTimeout(() => addedCard.classList.remove('scan-flash'), 300); }
    scanInput.value = ''; scanInput.focus();
}

function showScanFeedback(message, type = 'success') {
    const feedback = document.getElementById('scanFeedback');
    if (!feedback) return;
    feedback.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${message}`;
    feedback.className = `scan-feedback ${type === 'error' ? 'error' : ''}`;
    setTimeout(() => { if (feedback) { feedback.innerHTML = ''; feedback.className = 'scan-feedback'; } }, 2000);
}

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]); }

// ========== بدء التشغيل ==========
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initBarcodeScanner();
    if (document.getElementById('productsGrid')) {
        const search = document.getElementById('productSearchInput');
        if (search) search.addEventListener('input', e => renderModernProductsGrid(e.target.value));
        document.getElementById('checkoutBtn')?.addEventListener('click', checkout);
        document.getElementById('resetDayBtn')?.addEventListener('click', resetDaily);
    }
    if (document.getElementById('saveProductBtn')) {
        document.getElementById('saveProductBtn').addEventListener('click', () => {
            addOrUpdateProduct(
                document.getElementById('prodBarcode').value.trim(),
                document.getElementById('prodName').value.trim(),
                parseFloat(document.getElementById('prodCost').value),
                parseFloat(document.getElementById('prodPrice').value),
                parseFloat(document.getElementById('prodStock').value)
            );
            ['prodBarcode', 'prodName', 'prodCost', 'prodPrice', 'prodStock'].forEach(id => document.getElementById(id).value = '');
        });
        document.getElementById('searchProducts')?.addEventListener('input', () => renderProductsTable());
        renderProductsTable();
    }
});
