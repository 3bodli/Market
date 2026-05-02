// ----------------------------------------------
// نظام نقاط البيع (POS) - للماركت
// حفظ البيانات في localStorage
// ----------------------------------------------

// --- الحالة العامة للتطبيق ---
let currentCart = [];        // السلة الحالية: { name, price, quantity, total }
let dailySales = [];         // سجل المبيعات اليومية: كل فاتورة تخزن فيها نسخة من السلة + المجموع

// --- دوال تحميل وحفظ البيانات ---
function loadData() {
    const savedCart = localStorage.getItem('pos_cart');
    const savedDaily = localStorage.getItem('pos_dailySales');
    if(savedCart) currentCart = JSON.parse(savedCart);
    if(savedDaily) dailySales = JSON.parse(savedDaily);
    renderCart();
    updateTotals();
    renderSoldItemsToday();
}

function saveCart() {
    localStorage.setItem('pos_cart', JSON.stringify(currentCart));
}

function saveDaily() {
    localStorage.setItem('pos_dailySales', JSON.stringify(dailySales));
}

// --- إضافة منتج للسلة ---
function addToCart(name, price) {
    if(!name || price <= 0) {
        alert("يرجى إدخال اسم المنتج وسعر صالح (أكبر من 0)");
        return false;
    }
    // البحث عن نفس المنتج في السلة
    const existing = currentCart.find(item => item.name === name && item.price === price);
    if(existing) {
        existing.quantity++;
        existing.total = existing.quantity * existing.price;
    } else {
        currentCart.push({
            name: name,
            price: parseFloat(price),
            quantity: 1,
            total: parseFloat(price)
        });
    }
    saveCart();
    renderCart();
    updateTotals();
    return true;
}

// --- حذف منتج من السلة ---
function removeFromCart(index) {
    currentCart.splice(index, 1);
    saveCart();
    renderCart();
    updateTotals();
}

// --- عرض السلة في الجدول ---
function renderCart() {
    const tbody = document.getElementById('cartBody');
    if(!tbody) return;
    if(currentCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">⚠️ السلة فارغة، أضف منتجات</td></tr>';
        return;
    }
    let html = '';
    currentCart.forEach((item, idx) => {
        html += `<tr>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td>${item.quantity}</td>
                    <td>${item.total.toFixed(2)}</td>
                    <td><button class="remove-btn" data-index="${idx}">✖</button></td>
                 </tr>`;
    });
    tbody.innerHTML = html;
    // إعادة ربط أزرار الحذف
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            removeFromCart(idx);
        });
    });
}

// --- تحديث الإجماليات والضريبة وصافي الربح ---
function updateTotals() {
    const totalSales = currentCart.reduce((sum, item) => sum + item.total, 0);
    const tax = totalSales * 0.10;
    const netProfit = totalSales - tax;
    const finalTotal = totalSales;
    
    document.getElementById('totalSalesSpan').innerText = totalSales.toFixed(2);
    document.getElementById('taxSpan').innerText = tax.toFixed(2);
    document.getElementById('netProfitSpan').innerText = netProfit.toFixed(2);
    document.getElementById('finalTotalSpan').innerText = finalTotal.toFixed(2);
}

// --- معالجة إنهاء البيع (checkout) ---
function checkout() {
    if(currentCart.length === 0) {
        alert("لا يوجد منتجات للبيع!");
        return;
    }
    const invoiceTotal = currentCart.reduce((sum, item) => sum + item.total, 0);
    const invoiceTax = invoiceTotal * 0.10;
    const invoiceProfit = invoiceTotal - invoiceTax;
    
    // نسخ عميق للسلة الحالية
    const invoiceCopy = JSON.parse(JSON.stringify(currentCart));
    const saleRecord = {
        date: new Date().toLocaleString('ar-EG'),
        products: invoiceCopy,
        total: invoiceTotal,
        profit: invoiceProfit,
        tax: invoiceTax
    };
    dailySales.push(saleRecord);
    saveDaily();
    
    // مسح السلة الحالية
    currentCart = [];
    saveCart();
    renderCart();
    updateTotals();
    renderSoldItemsToday();
    
    alert(`✅ تمت عملية البيع\nالمبلغ الكلي: ${invoiceTotal.toFixed(2)}\nالضريبة: ${invoiceTax.toFixed(2)}\nصافي الربح: ${invoiceProfit.toFixed(2)}`);
    // يمكن إضافة طباعة تلقائية بإزالة التعليق عن السطر التالي
    // window.print();
}

// --- عرض المنتجات التي تم بيعها اليوم بشكل مفيد ---
function renderSoldItemsToday() {
    const container = document.getElementById('soldItemsList');
    if(!container) return;
    if(dailySales.length === 0) {
        container.innerHTML = '<p class="empty-msg">لا توجد مبيعات مسجلة حتى الآن</p>';
        return;
    }
    // تجميع كل المنتجات المباعة
    let itemsList = [];
    dailySales.forEach(invoice => {
        invoice.products.forEach(prod => {
            itemsList.push(`${prod.name} × ${prod.quantity}`);
        });
    });
    // تلخيص المنتجات المتكررة
    const summary = {};
    itemsList.forEach(item => {
        summary[item] = (summary[item] || 0) + 1;
    });
    let html = '<ul style="margin:0; padding-right:20px;">';
    for(let [productText, times] of Object.entries(summary)) {
        html += `<li>${productText} (${times} فاتورة)</li>`;
    }
    html += '</ul>';
    container.innerHTML = html;
}

// --- مسح بيانات اليوم بالكامل (السلة والمبيعات) ---
function resetDailyData() {
    if(confirm("⚠️ هل أنت متأكد أنك تريد مسح كل بيانات اليوم الحالية والسلة؟ لا يمكن التراجع.")) {
        currentCart = [];
        dailySales = [];
        saveCart();
        saveDaily();
        renderCart();
        updateTotals();
        renderSoldItemsToday();
        alert("تم مسح بيانات اليوم والسلة بنجاح.");
    }
}

// --- دالة مساعدة لتجنب XSS ---
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
        return m;
    });
}

// --- ربط الأحداث عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    const addBtn = document.getElementById('addBtn');
    const productName = document.getElementById('productName');
    const productPrice = document.getElementById('productPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const resetDayBtn = document.getElementById('resetDayBtn');
    const resetDayBtnHeader = document.getElementById('resetDayBtnHeader');
    
    if(addBtn) {
        addBtn.addEventListener('click', () => {
            const name = productName.value.trim();
            const price = parseFloat(productPrice.value);
            if(addToCart(name, price)) {
                productName.value = '';
                productPrice.value = '';
                productName.focus();
            }
        });
    }
    if(checkoutBtn) checkoutBtn.addEventListener('click', checkout);
    if(resetDayBtn) resetDayBtn.addEventListener('click', resetDailyData);
    if(resetDayBtnHeader) resetDayBtnHeader.addEventListener('click', resetDailyData);
});
