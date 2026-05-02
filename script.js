// ============================================================
// نظام POS المتكامل - إدارة المنتجات + نقطة البيع
// ============================================================

// ---------- قاعدة البيانات (localStorage) ----------
let products = [];      // قائمة المنتجات { barcode, name, cost, price, stock }
let currentCart = [];   // السلة الحالية { barcode, name, price, quantity, cost, profitPerUnit, totalPrice, totalProfit }
let dailySales = [];    // مبيعات اليوم

// ---------- تحميل وحفظ البيانات ----------
function loadData() {
    const savedProducts = localStorage.getItem('pos_products');
    const savedCart = localStorage.getItem('pos_cart');
    const savedDaily = localStorage.getItem('pos_dailySales');
    
    if(savedProducts) products = JSON.parse(savedProducts);
    if(savedCart) currentCart = JSON.parse(savedCart);
    if(savedDaily) dailySales = JSON.parse(savedDaily);
    
    // إذا كانت صفحة البيع مفتوحة
    if(document.getElementById('cartBody')) {
        renderCart();
        updateTotals();
        renderSoldItems();
    }
    // إذا كانت صفحة إدارة المنتجات مفتوحة
    if(document.getElementById('productsBody')) {
        renderProductsTable();
    }
}

function saveProducts() {
    localStorage.setItem('pos_products', JSON.stringify(products));
}

function saveCart() {
    localStorage.setItem('pos_cart', JSON.stringify(currentCart));
}

function saveDaily() {
    localStorage.setItem('pos_dailySales', JSON.stringify(dailySales));
}

// ---------- دوال إدارة المنتجات (inventory.html) ----------
function addOrUpdateProduct(barcode, name, cost, price, stock) {
    if(!barcode || !name || cost <= 0 || price <= 0) {
        showFormMessage('يرجى ملء جميع الحقول بشكل صحيح (الأسعار أكبر من 0)', 'red');
        return false;
    }
    
    const existingIndex = products.findIndex(p => p.barcode === barcode);
    if(existingIndex !== -1) {
        // تحديث منتج موجود
        products[existingIndex] = { barcode, name, cost: parseFloat(cost), price: parseFloat(price), stock: parseFloat(stock) };
        showFormMessage('تم تحديث المنتج بنجاح', 'green');
    } else {
        // إضافة منتج جديد
        products.push({ barcode, name, cost: parseFloat(cost), price: parseFloat(price), stock: parseFloat(stock) });
        showFormMessage('تم إضافة المنتج بنجاح', 'green');
    }
    saveProducts();
    renderProductsTable();
    // إذا كانت صفحة البيع مفتوحة، نحدث شبكة المنتجات أيضاً
    if(document.getElementById('productsGrid')) {
        renderProductsGrid(document.getElementById('productSearchInput')?.value || '');
    }
    return true;
}

function deleteProduct(barcode) {
    if(confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        products = products.filter(p => p.barcode !== barcode);
        saveProducts();
        renderProductsTable();
        showFormMessage('تم حذف المنتج', 'green');
        if(document.getElementById('productsGrid')) {
            renderProductsGrid(document.getElementById('productSearchInput')?.value || '');
        }
    }
}

function renderProductsTable() {
    const tbody = document.getElementById('productsBody');
    if(!tbody) return;
    
    const searchTerm = document.getElementById('searchProducts')?.value.toLowerCase() || '';
    let filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.barcode.toLowerCase().includes(searchTerm)
    );
    
    if(filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">لا توجد منتجات. أضف منتجاً جديداً باستخدام النموذج أعلاه.</td></tr>';
        return;
    }
    
    let html = '';
    filtered.forEach(p => {
        html += `<tr>
            <td>${escapeHtml(p.barcode)}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${p.cost.toFixed(2)}</td>
            <td>${p.price.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td><button class="btn-danger delete-prod" data-barcode="${p.barcode}"><i class="fas fa-trash"></i> حذف</button></td>
        </tr>`;
    });
    tbody.innerHTML = html;
    
    document.querySelectorAll('.delete-prod').forEach(btn => {
        btn.addEventListener('click', () => deleteProduct(btn.getAttribute('data-barcode')));
    });
}

function showFormMessage(msg, color) {
    const msgDiv = document.getElementById('formMessage');
    if(msgDiv) {
        msgDiv.innerText = msg;
        msgDiv.style.color = color === 'red' ? '#e53e3e' : '#2b9348';
        setTimeout(() => { msgDiv.innerText = ''; }, 3000);
    }
}

// ---------- دوال البيع (index.html) ----------
function findProductByBarcode(barcode) {
    return products.find(p => p.barcode === barcode);
}

// دالة مساعدة لإضافة المنتج للسلة بالباركود (والكمية 1 افتراضياً)
function addProductToCartByBarcode(barcode, quantity = 1) {
    const product = findProductByBarcode(barcode);
    if(!product) {
        alert('المنتج غير موجود!');
        return false;
    }
    if(product.stock <= 0) {
        alert(`المنتج ${product.name} غير متوفر بالمخزون!`);
        return false;
    }
    if(quantity > product.stock) {
        alert(`الكمية المتوفرة فقط ${product.stock}`);
        return false;
    }
    
    const existing = currentCart.find(item => item.barcode === barcode);
    if(existing) {
        existing.quantity += quantity;
        existing.totalPrice = existing.quantity * existing.price;
        existing.totalProfit = existing.quantity * existing.profitPerUnit;
    } else {
        const profitPerUnit = product.price - product.cost;
        currentCart.push({
            barcode: product.barcode,
            name: product.name,
            price: product.price,
            quantity: quantity,
            cost: product.cost,
            profitPerUnit: profitPerUnit,
            totalPrice: quantity * product.price,
            totalProfit: quantity * profitPerUnit
        });
    }
    
    // خصم من المخزون
    product.stock -= quantity;
    saveProducts();
    saveCart();
    renderCart();
    updateTotals();
    
    // تحديث شبكة المنتجات لو كانت مفتوحة (لتغيير الكمية المعروضة)
    if(document.getElementById('productsGrid')) {
        const searchVal = document.getElementById('productSearchInput')?.value || '';
        renderProductsGrid(searchVal);
    }
    return true;
}

function removeCartItem(index) {
    const item = currentCart[index];
    // إعادة الكمية للمخزون
    const product = findProductByBarcode(item.barcode);
    if(product) {
        product.stock += item.quantity;
        saveProducts();
    }
    currentCart.splice(index, 1);
    saveCart();
    renderCart();
    updateTotals();
    if(document.getElementById('productsGrid')) {
        const searchVal = document.getElementById('productSearchInput')?.value || '';
        renderProductsGrid(searchVal);
    }
}

function renderCart() {
    const tbody = document.getElementById('cartBody');
    if(!tbody) return;
    if(currentCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">⚠️ السلة فارغة</td></tr>';
        return;
    }
    let html = '';
    currentCart.forEach((item, idx) => {
        html += `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.price.toFixed(2)}</td>
            <td>
                <button class="qty-btn" data-index="${idx}" data-change="-1">-</button>
                ${item.quantity}
                <button class="qty-btn" data-index="${idx}" data-change="1">+</button>
            </td>
            <td>${item.totalPrice.toFixed(2)}</td>
            <td><button class="remove-btn" data-index="${idx}">✖</button></td>
        </tr>`;
    });
    tbody.innerHTML = html;
    
    // أزرار تغيير الكمية
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.getAttribute('data-index'));
            const change = parseInt(btn.getAttribute('data-change'));
            changeItemQuantity(idx, change);
        });
    });
    
    // أزرار الحذف
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            removeCartItem(idx);
        });
    });
}

function changeItemQuantity(index, delta) {
    const item = currentCart[index];
    if(!item) return;
    const newQuantity = item.quantity + delta;
    if(newQuantity < 1) {
        removeCartItem(index);
        return;
    }
    const product = findProductByBarcode(item.barcode);
    if(product && newQuantity > product.stock + item.quantity) {
        alert(`لا يمكن زيادة الكمية. المتوفر في المخزون: ${product.stock + item.quantity}`);
        return;
    }
    // تعديل الكمية وتحديث المخزون
    if(product) {
        product.stock -= delta;  // delta تكون +1 أو -1
        saveProducts();
    }
    item.quantity = newQuantity;
    item.totalPrice = item.quantity * item.price;
    item.totalProfit = item.quantity * item.profitPerUnit;
    saveCart();
    renderCart();
    updateTotals();
    if(document.getElementById('productsGrid')) {
        const searchVal = document.getElementById('productSearchInput')?.value || '';
        renderProductsGrid(searchVal);
    }
}

function updateTotals() {
    const totalSales = currentCart.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalProfit = currentCart.reduce((sum, item) => sum + item.totalProfit, 0);
    if(document.getElementById('totalSalesSpan')) document.getElementById('totalSalesSpan').innerText = totalSales.toFixed(2);
    if(document.getElementById('totalProfitSpan')) document.getElementById('totalProfitSpan').innerText = totalProfit.toFixed(2);
    if(document.getElementById('finalTotalSpan')) document.getElementById('finalTotalSpan').innerText = totalSales.toFixed(2);
}

function checkout() {
    if(currentCart.length === 0) {
        alert('السلة فارغة');
        return;
    }
    const invoiceTotal = currentCart.reduce((sum, i) => sum + i.totalPrice, 0);
    const invoiceProfit = currentCart.reduce((sum, i) => sum + i.totalProfit, 0);
    
    dailySales.push({
        date: new Date().toLocaleString('ar-EG'),
        items: JSON.parse(JSON.stringify(currentCart)),
        total: invoiceTotal,
        profit: invoiceProfit
    });
    saveDaily();
    
    currentCart = [];
    saveCart();
    renderCart();
    updateTotals();
    renderSoldItems();
    alert(`✅ تم البيع\nالمجموع: ${invoiceTotal.toFixed(2)}\nالربح: ${invoiceProfit.toFixed(2)}`);
}

function renderSoldItems() {
    const container = document.getElementById('soldItemsList');
    if(!container) return;
    if(dailySales.length === 0) {
        container.innerHTML = '<p class="empty-msg">لا توجد مبيعات مسجلة اليوم</p>';
        return;
    }
    let html = '<ul style="margin:0; padding-right:20px;">';
    dailySales.slice().reverse().forEach(sale => {
        html += `<li><strong>${sale.date}</strong> - المجموع: ${sale.total.toFixed(2)} (ربح: ${sale.profit.toFixed(2)})</li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

function resetDaily() {
    if(confirm('مسح مبيعات اليوم والسلة الحالية؟')) {
        dailySales = [];
        currentCart = [];
        saveDaily();
        saveCart();
        renderCart();
        updateTotals();
        renderSoldItems();
        if(document.getElementById('productsGrid')) {
            const searchVal = document.getElementById('productSearchInput')?.value || '';
            renderProductsGrid(searchVal);
        }
    }
}

// دالة عرض شبكة المنتجات في صفحة البيع (بدلاً من البحث بالباركود)
function renderProductsGrid(filter = '') {
    const productsGrid = document.getElementById('productsGrid');
    if(!productsGrid) return;
    
    let filteredProducts = products;
    if(filter) {
        filteredProducts = products.filter(p => 
            p.name.toLowerCase().includes(filter.toLowerCase()) || 
            p.barcode.toLowerCase().includes(filter.toLowerCase())
        );
    }
    
    if(filteredProducts.length === 0) {
        productsGrid.innerHTML = '<div class="empty-msg">لا توجد منتجات متاحة. أضف منتجات من قائمة الإدارة أولاً.</div>';
        return;
    }
    
    let html = '';
    filteredProducts.forEach(product => {
        // أيقونة بسيطة حسب الاسم
        let iconClass = 'fa-box';
        if(product.name.includes('خبز') || product.name.includes('كاس')) iconClass = 'fa-bread-slice';
        else if(product.name.includes('حليب') || product.name.includes('لبن')) iconClass = 'fa-tint';
        else if(product.name.includes('موية') || product.name.includes('ماء')) iconClass = 'fa-water';
        else if(product.name.includes('بيض')) iconClass = 'fa-egg';
        
        html += `
            <div class="product-card" data-barcode="${escapeHtml(product.barcode)}">
                <i class="fas ${iconClass}"></i>
                <div class="product-name">${escapeHtml(product.name)}</div>
                <div class="product-price">${product.price.toFixed(2)} ل.س</div>
                <div class="product-stock">المتبقي: ${product.stock}</div>
                <button class="quick-add" data-barcode="${escapeHtml(product.barcode)}"><i class="fas fa-cart-plus"></i> أضف</button>
            </div>
        `;
    });
    productsGrid.innerHTML = html;
    
    // إضافة حدث الضغط على البطاقة
    document.querySelectorAll('.product-card').forEach(card => {
        const barcode = card.getAttribute('data-barcode');
        card.addEventListener('click', (e) => {
            if(e.target.classList.contains('quick-add') || e.target.closest('.quick-add')) return;
            addProductToCartByBarcode(barcode);
        });
        const quickBtn = card.querySelector('.quick-add');
        if(quickBtn) {
            quickBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addProductToCartByBarcode(barcode);
            });
        }
    });
}

function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
        return m;
    });
}

// ---------- تهيئة الصفحات ----------
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // صفحة البيع (index.html) - عرض شبكة المنتجات
    if(document.getElementById('productsGrid')) {
        const searchInput = document.getElementById('productSearchInput');
        const checkoutBtn = document.getElementById('checkoutBtn');
        const resetDayBtn = document.getElementById('resetDayBtn');
        
        renderProductsGrid('');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderProductsGrid(e.target.value);
            });
        }
        if(checkoutBtn) checkoutBtn.addEventListener('click', checkout);
        if(resetDayBtn) resetDayBtn.addEventListener('click', resetDaily);
    }
    
    // صفحة إدارة المنتجات (inventory.html)
    if(document.getElementById('saveProductBtn')) {
        const saveBtn = document.getElementById('saveProductBtn');
        const searchInput = document.getElementById('searchProducts');
        
        if(saveBtn) {
            saveBtn.addEventListener('click', () => {
                const barcode = document.getElementById('prodBarcode').value.trim();
                const name = document.getElementById('prodName').value.trim();
                const cost = parseFloat(document.getElementById('prodCost').value);
                const price = parseFloat(document.getElementById('prodPrice').value);
                const stock = parseFloat(document.getElementById('prodStock').value);
                addOrUpdateProduct(barcode, name, cost, price, stock);
                // تنظيف الحقول
                document.getElementById('prodBarcode').value = '';
                document.getElementById('prodName').value = '';
                document.getElementById('prodCost').value = '';
                document.getElementById('prodPrice').value = '';
                document.getElementById('prodStock').value = '';
                document.getElementById('prodBarcode').focus();
            });
        }
        
        if(searchInput) {
            searchInput.addEventListener('input', () => renderProductsTable());
        }
        renderProductsTable();
    }
});
