// ============================================================
// نظام POS المتكامل - إدارة المنتجات + نقطة البيع
// ============================================================

// ---------- قاعدة البيانات (localStorage) ----------
let products = [];      // قائمة المنتجات { barcode, name, cost, price, stock }
let currentCart = [];   // السلة الحالية { barcode, name, price, quantity, cost, profit }
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
        showFormMessage('يرجى ملء جميع الحقول بشكل صحيح', 'red');
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
    return true;
}

function deleteProduct(barcode) {
    if(confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        products = products.filter(p => p.barcode !== barcode);
        saveProducts();
        renderProductsTable();
        showFormMessage('تم حذف المنتج', 'green');
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
        tbody.innerHTML = '<tr><td colspan="6">لا توجد منتجات</td><tr>';
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
            <td><button class="btn-danger delete-prod" data-barcode="${p.barcode}"><i class="fas fa-trash"></i></button></td>
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

function displayProductInfo(barcode) {
    const product = findProductByBarcode(barcode);
    const infoDiv = document.getElementById('productInfo');
    if(!product) {
        infoDiv.classList.add('hidden');
        alert('المنتج غير موجود! يرجى إضافته من صفحة إدارة المنتجات');
        return false;
    }
    document.getElementById('dispName').innerText = product.name;
    document.getElementById('dispPrice').innerText = product.price;
    document.getElementById('dispStock').innerText = product.stock;
    infoDiv.classList.remove('hidden');
    return product;
}

function addCurrentToCart() {
    const barcode = document.getElementById('barcodeInput').value.trim();
    const product = findProductByBarcode(barcode);
    if(!product) {
        alert('المنتج غير موجود');
        return;
    }
    const quantity = parseInt(document.getElementById('quantityInput').value);
    if(quantity > product.stock) {
        alert(`الكمية المتوفرة فقط ${product.stock}`);
        return;
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
    
    // تنظيف الحقول
    document.getElementById('barcodeInput').value = '';
    document.getElementById('quantityInput').value = '1';
    document.getElementById('productInfo').classList.add('hidden');
    document.getElementById('barcodeInput').focus();
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
}

function renderCart() {
    const tbody = document.getElementById('cartBody');
    if(!tbody) return;
    if(currentCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">⚠️ السلة فارغة</td><tr>';
        return;
    }
    let html = '';
    currentCart.forEach((item, idx) => {
        html += `<tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.price.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>${item.totalPrice.toFixed(2)}</td>
            <td style="color:#2b6e3c">${item.totalProfit.toFixed(2)}</td>
            <td><button class="remove-btn" data-index="${idx}">✖</button></td>
        </tr>`;
    });
    tbody.innerHTML = html;
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => removeCartItem(parseInt(btn.getAttribute('data-index'))));
    });
}

function updateTotals() {
    const totalSales = currentCart.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalProfit = currentCart.reduce((sum, item) => sum + item.totalProfit, 0);
    document.getElementById('totalSalesSpan').innerText = totalSales.toFixed(2);
    document.getElementById('totalProfitSpan').innerText = totalProfit.toFixed(2);
    document.getElementById('finalTotalSpan').innerText = totalSales.toFixed(2);
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
        container.innerHTML = '<p class="empty-msg">لا توجد مبيعات</p>';
        return;
    }
    let html = '<ul>';
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
    }
}

function escapeHtml(str) {
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
    
    // صفحة البيع (index.html)
    if(document.getElementById('barcodeInput')) {
        const barcodeInput = document.getElementById('barcodeInput');
        const searchBtn = document.getElementById('searchBtn');
        const addToCartBtn = document.getElementById('addToCartBtn');
        const checkoutBtn = document.getElementById('checkoutBtn');
        const resetDayBtn = document.getElementById('resetDayBtn');
        
        searchBtn.addEventListener('click', () => {
            displayProductInfo(barcodeInput.value.trim());
        });
        barcodeInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') displayProductInfo(barcodeInput.value.trim());
        });
        addToCartBtn.addEventListener('click', addCurrentToCart);
        checkoutBtn.addEventListener('click', checkout);
        if(resetDayBtn) resetDayBtn.addEventListener('click', resetDaily);
    }
    
    // صفحة إدارة المنتجات (inventory.html)
    if(document.getElementById('saveProductBtn')) {
        const saveBtn = document.getElementById('saveProductBtn');
        const searchInput = document.getElementById('searchProducts');
        
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
        });
        
        if(searchInput) {
            searchInput.addEventListener('input', () => renderProductsTable());
        }
    }
});
