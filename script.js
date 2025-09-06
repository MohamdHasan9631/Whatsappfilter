// Global variables
let currentNumbers = [];
let checkingProgress = 0;
let totalNumbers = 0;
let backendStatus = 'connecting';
let statusCheckInterval = null;

// Backend API configuration
const API_BASE = window.location.origin; // Same domain as frontend

// Tab switching functionality
function showTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Hide all tab buttons active state
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab content
    document.getElementById(tabName).classList.add('active');
    
    // Activate corresponding button
    event.target.classList.add('active');
}

// Phone number validation and formatting
function validatePhoneNumber(number) {
    try {
        // Remove all non-digit characters except +
        const cleanNumber = number.replace(/[^\d+]/g, '');
        
        // Basic validation
        if (!cleanNumber.startsWith('+')) {
            return { valid: false, error: 'الرقم يجب أن يبدأ بـ +' };
        }
        
        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
            return { valid: false, error: 'طول الرقم غير صحيح' };
        }
        
        // Use libphonenumber for validation if available
        if (typeof libphonenumber !== 'undefined') {
            try {
                const phoneNumber = libphonenumber.parsePhoneNumber(cleanNumber);
                if (phoneNumber.isValid()) {
                    return {
                        valid: true,
                        formatted: phoneNumber.formatInternational(),
                        country: phoneNumber.country,
                        nationalNumber: phoneNumber.nationalNumber,
                        countryCode: phoneNumber.countryCallingCode
                    };
                }
            } catch (e) {
                return { valid: false, error: 'صيغة الرقم غير صحيحة' };
            }
        }
        
        return { valid: true, formatted: cleanNumber };
    } catch (error) {
        return { valid: false, error: 'خطأ في تحليل الرقم' };
    }
}

// Check backend connection status
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const data = await response.json();
        
        backendStatus = data.status;
        updateConnectionStatus(data.status, data.qrCode);
        
        return data;
    } catch (error) {
        console.error('خطأ في الاتصال بالخادم:', error);
        backendStatus = 'error';
        updateConnectionStatus('error');
        return null;
    }
}

// Update connection status UI
function updateConnectionStatus(status, qrCode = null) {
    const statusElement = document.getElementById('connection-status');
    
    // Remove all status classes
    statusElement.className = 'connection-status';
    
    switch (status) {
        case 'connecting':
        case 'initializing':
            statusElement.classList.add('connecting');
            statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>جاري الاتصال...</span>';
            break;
            
        case 'connected':
            statusElement.classList.add('connected');
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i><span>متصل - جاهز للفحص</span>';
            break;
            
        case 'qr_ready':
            statusElement.classList.add('qr-ready');
            statusElement.innerHTML = '<i class="fas fa-qrcode"></i><span>اضغط لعرض رمز QR</span>';
            statusElement.onclick = () => showQRModal(qrCode);
            break;
            
        case 'disconnected':
            statusElement.classList.add('disconnected');
            statusElement.innerHTML = '<i class="fas fa-times-circle"></i><span>غير متصل</span>';
            break;
            
        case 'error':
        default:
            statusElement.classList.add('disconnected');
            statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>خطأ في الاتصال</span>';
            break;
    }
}

// Show QR Code Modal
function showQRModal(qrCode = null) {
    const modal = document.getElementById('qr-modal');
    const qrContainer = document.getElementById('qr-code-container');
    
    if (qrCode) {
        qrContainer.innerHTML = `<img src="${qrCode}" alt="QR Code" class="qr-code-image">`;
    } else {
        qrContainer.innerHTML = `
            <div class="qr-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري إنشاء رمز QR...</p>
            </div>
        `;
    }
    
    modal.style.display = 'flex';
}

// Close QR Modal
function closeQRModal() {
    document.getElementById('qr-modal').style.display = 'none';
}

// Refresh QR Code
async function refreshQR() {
    try {
        const response = await fetch(`${API_BASE}/api/qr`);
        const data = await response.json();
        
        if (data.qrCode) {
            showQRModal(data.qrCode);
        } else {
            showMessage(document.getElementById('qr-code-container'), 'لا يوجد رمز QR متاح', 'warning');
        }
    } catch (error) {
        console.error('خطأ في تحديث رمز QR:', error);
        showMessage(document.getElementById('qr-code-container'), 'فشل في تحديث رمز QR', 'error');
    }
}

// Retry connection
async function retryConnection() {
    try {
        const response = await fetch(`${API_BASE}/api/restart`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeQRModal();
            updateConnectionStatus('connecting');
            showMessage(document.querySelector('.header'), 'تم إعادة تشغيل الاتصال', 'success');
        } else {
            showMessage(document.getElementById('qr-code-container'), data.error || 'فشل في إعادة التشغيل', 'error');
        }
    } catch (error) {
        console.error('خطأ في إعادة المحاولة:', error);
        showMessage(document.getElementById('qr-code-container'), 'فشل في إعادة المحاولة', 'error');
    }
}

// Real WhatsApp checking using backend API
async function checkWhatsAppStatus(phoneNumber) {
    try {
        const response = await fetch(`${API_BASE}/api/check-whatsapp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ number: phoneNumber })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.data;
        
    } catch (error) {
        console.error('خطأ في فحص الواتساب:', error);
        throw error;
    }
}

// Generate placeholder profile picture
function generateProfilePicture(phoneNumber) {
    // Generate a placeholder image based on phone number
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    const colorIndex = parseInt(phoneNumber.slice(-1)) % colors.length;
    const initials = phoneNumber.slice(-2);
    
    // Return placeholder image URL
    return `https://ui-avatars.com/api/?name=${initials}&background=${colors[colorIndex].slice(1)}&color=fff&size=128`;
}

// Generate random last seen
function generateLastSeen() {
    const options = [
        'متصل الآن',
        'آخر ظهور منذ دقيقة',
        'آخر ظهور منذ 5 دقائق',
        'آخر ظهور منذ ساعة',
        'آخر ظهور اليوم',
        'آخر ظهور أمس',
        'آخر ظهور منذ أسبوع'
    ];
    return options[Math.floor(Math.random() * options.length)];
}

// Generate random status
function generateStatus() {
    const statuses = [
        'متاح',
        'مشغول',
        'في اجتماع',
        'لا تزعجني',
        '',
        'أعمل من المنزل',
        'في إجازة'
    ];
    return statuses[Math.floor(Math.random() * statuses.length)];
}

// Get carrier information
function getCarrierInfo(phoneNumber) {
    try {
        if (typeof libphonenumber !== 'undefined') {
            const phone = libphonenumber.parsePhoneNumber(phoneNumber);
            if (phone.isValid()) {
                const country = phone.country;
                const carrier = getCarrierByCountryAndNumber(country, phone.nationalNumber);
                
                return {
                    country: getCountryName(country),
                    countryCode: country,
                    carrier: carrier,
                    numberType: phone.getType() || 'غير محدد',
                    region: getRegionInfo(country)
                };
            }
        }
        
        // Fallback for basic carrier detection
        return getBasicCarrierInfo(phoneNumber);
    } catch (error) {
        return {
            country: 'غير محدد',
            carrier: 'غير محدد',
            error: 'لا يمكن تحديد معلومات المشغل'
        };
    }
}

// Basic carrier detection (simplified)
function getBasicCarrierInfo(phoneNumber) {
    const carriers = {
        // USA
        '+1201': 'Verizon',
        '+1202': 'Verizon',
        '+1203': 'AT&T',
        '+1212': 'Verizon',
        '+1213': 'T-Mobile',
        '+1214': 'AT&T',
        '+1215': 'Verizon',
        '+1216': 'T-Mobile',
        '+1217': 'AT&T',
        '+1218': 'Verizon',
        
        // Canada
        '+1416': 'Bell Canada',
        '+1437': 'Rogers',
        '+1647': 'Telus',
        '+1905': 'Bell Canada',
        '+1289': 'Rogers',
        '+1519': 'Telus',
        '+1613': 'Bell Canada',
        '+1343': 'Rogers',
        
        // Jordan
        '+96277': 'Zain Jordan',
        '+96278': 'Orange Jordan',
        '+96279': 'Umniah',
        
        // Saudi Arabia
        '+96650': 'STC',
        '+96651': 'STC',
        '+96652': 'STC',
        '+96653': 'STC',
        '+96654': 'STC',
        '+96655': 'STC',
        '+96656': 'Mobily',
        '+96657': 'Mobily',
        '+96658': 'Zain KSA',
        '+96659': 'Zain KSA',
        
        // UAE
        '+97150': 'Etisalat',
        '+97151': 'Etisalat',
        '+97152': 'Etisalat',
        '+97154': 'Etisalat',
        '+97155': 'du',
        '+97156': 'du',
        '+97158': 'du'
    };
    
    // Find matching carrier
    for (const prefix in carriers) {
        if (phoneNumber.startsWith(prefix)) {
            return {
                country: getCountryFromPrefix(prefix),
                carrier: carriers[prefix],
                countryCode: prefix.substring(0, prefix.length - 2)
            };
        }
    }
    
    return {
        country: 'غير محدد',
        carrier: 'غير محدد',
        error: 'لا يمكن تحديد معلومات المشغل'
    };
}

// Get carrier by country and number
function getCarrierByCountryAndNumber(country, nationalNumber) {
    const carrierMap = {
        'US': {
            patterns: {
                'Verizon': ['201', '202', '212', '215', '218'],
                'AT&T': ['203', '214', '217'],
                'T-Mobile': ['213', '216'],
                'Sprint': ['219', '220']
            }
        },
        'CA': {
            patterns: {
                'Bell Canada': ['416', '905', '613'],
                'Rogers': ['437', '289', '343'],
                'Telus': ['647', '519']
            }
        },
        'JO': {
            patterns: {
                'Zain Jordan': ['77'],
                'Orange Jordan': ['78'],
                'Umniah': ['79']
            }
        },
        'SA': {
            patterns: {
                'STC': ['50', '51', '52', '53', '54', '55'],
                'Mobily': ['56', '57'],
                'Zain KSA': ['58', '59']
            }
        },
        'AE': {
            patterns: {
                'Etisalat': ['50', '51', '52', '54'],
                'du': ['55', '56', '58']
            }
        }
    };
    
    if (carrierMap[country]) {
        const patterns = carrierMap[country].patterns;
        const numberStr = nationalNumber.toString();
        
        for (const carrier in patterns) {
            for (const pattern of patterns[carrier]) {
                if (numberStr.startsWith(pattern)) {
                    return carrier;
                }
            }
        }
    }
    
    return 'غير محدد';
}

// Get country name from code
function getCountryName(countryCode) {
    const countries = {
        'US': 'الولايات المتحدة',
        'CA': 'كندا',
        'JO': 'الأردن',
        'SA': 'السعودية',
        'AE': 'الإمارات',
        'EG': 'مصر',
        'LB': 'لبنان',
        'SY': 'سوريا',
        'IQ': 'العراق',
        'KW': 'الكويت',
        'QA': 'قطر',
        'BH': 'البحرين',
        'OM': 'عمان',
        'YE': 'اليمن',
        'PS': 'فلسطين',
        'IL': 'إسرائيل',
        'TR': 'تركيا',
        'FR': 'فرنسا',
        'DE': 'ألمانيا',
        'GB': 'بريطانيا',
        'IT': 'إيطاليا',
        'ES': 'إسبانيا'
    };
    
    return countries[countryCode] || countryCode;
}

// Get country from phone prefix
function getCountryFromPrefix(prefix) {
    const prefixMap = {
        '+1': 'الولايات المتحدة / كندا',
        '+962': 'الأردن',
        '+966': 'السعودية',
        '+971': 'الإمارات',
        '+20': 'مصر',
        '+961': 'لبنان',
        '+963': 'سوريا',
        '+964': 'العراق',
        '+965': 'الكويت',
        '+974': 'قطر',
        '+973': 'البحرين',
        '+968': 'عمان',
        '+967': 'اليمن',
        '+970': 'فلسطين',
        '+972': 'إسرائيل'
    };
    
    for (const code in prefixMap) {
        if (prefix.startsWith(code)) {
            return prefixMap[code];
        }
    }
    
    return 'غير محدد';
}

// Get region information
function getRegionInfo(countryCode) {
    const regions = {
        'US': 'أمريكا الشمالية',
        'CA': 'أمريكا الشمالية',
        'JO': 'الشرق الأوسط',
        'SA': 'الشرق الأوسط',
        'AE': 'الشرق الأوسط',
        'EG': 'الشرق الأوسط',
        'LB': 'الشرق الأوسط',
        'SY': 'الشرق الأوسط',
        'IQ': 'الشرق الأوسط',
        'KW': 'الشرق الأوسط',
        'QA': 'الشرق الأوسط',
        'BH': 'الشرق الأوسط',
        'OM': 'الشرق الأوسط',
        'YE': 'الشرق الأوسط',
        'PS': 'الشرق الأوسط'
    };
    
    return regions[countryCode] || 'غير محدد';
}

// Single number WhatsApp check
async function checkSingleNumber() {
    const numberInput = document.getElementById('single-number');
    const resultContainer = document.getElementById('single-result');
    const phoneNumber = numberInput.value.trim();
    
    if (!phoneNumber) {
        showMessage(resultContainer, 'يرجى إدخال رقم الهاتف', 'error');
        return;
    }
    
    // Check backend connection
    if (backendStatus !== 'connected') {
        showMessage(resultContainer, 'عميل الواتساب غير متصل. يرجى التأكد من الاتصال أولاً.', 'error');
        return;
    }
    
    // Validate phone number
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
        showMessage(resultContainer, validation.error, 'error');
        return;
    }
    
    // Show loading
    showLoading(true);
    
    try {
        // Check WhatsApp status using real API
        const whatsappInfo = await checkWhatsAppStatus(validation.formatted || phoneNumber);
        
        // Display result
        displayWhatsAppResult(resultContainer, whatsappInfo);
        
    } catch (error) {
        showMessage(resultContainer, 'حدث خطأ أثناء الفحص: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Bulk WhatsApp check using real API
async function checkBulkNumbers() {
    const fileInput = document.getElementById('numbers-file');
    const resultContainer = document.getElementById('bulk-result');
    const progressContainer = document.getElementById('bulk-progress');
    
    if (!fileInput.files[0]) {
        showMessage(resultContainer, 'يرجى اختيار ملف يحتوي على الأرقام', 'error');
        return;
    }
    
    if (backendStatus !== 'connected') {
        showMessage(resultContainer, 'عميل الواتساب غير متصل. يرجى التأكد من الاتصال أولاً.', 'error');
        return;
    }
    
    try {
        const fileContent = await readFile(fileInput.files[0]);
        const numbers = fileContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (numbers.length === 0) {
            showMessage(resultContainer, 'الملف فارغ أو لا يحتوي على أرقام صحيحة', 'error');
            return;
        }
        
        totalNumbers = numbers.length;
        checkingProgress = 0;
        
        // Show progress
        progressContainer.style.display = 'block';
        resultContainer.innerHTML = '';
        
        // Hide summary initially
        document.getElementById('bulk-summary').style.display = 'none';
        
        // Use bulk API for better performance
        try {
            const response = await fetch(`${API_BASE}/api/check-whatsapp-bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ numbers: numbers })
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            // Display results and summary
            const stats = calculateStats(result.data);
            displayResultsSummary(document.getElementById('bulk-summary'), stats, numbers.length);
            
            result.data.forEach((data, index) => {
                // Update progress
                checkingProgress = index + 1;
                updateProgress((checkingProgress / totalNumbers) * 100);
                
                // Display result
                if (data.error) {
                    displayWhatsAppResult(resultContainer, {
                        number: data.number,
                        error: data.error
                    });
                } else {
                    displayWhatsAppResult(resultContainer, data);
                }
            });
            
            // Hide progress
            progressContainer.style.display = 'none';
            
        } catch (error) {
            // Fallback to individual checking if bulk fails
            console.log('فشل الفحص المجمع، سيتم الفحص الفردي...');
            
            const results = [];
            for (let i = 0; i < numbers.length; i++) {
                const number = numbers[i];
                
                // Update progress
                checkingProgress = i + 1;
                updateProgress((checkingProgress / totalNumbers) * 100);
                
                // Validate number
                const validation = validatePhoneNumber(number);
                if (!validation.valid) {
                    const errorResult = {
                        number: number,
                        error: validation.error
                    };
                    results.push(errorResult);
                    displayWhatsAppResult(resultContainer, errorResult);
                    continue;
                }
                
                try {
                    // Check WhatsApp status
                    const whatsappInfo = await checkWhatsAppStatus(validation.formatted || number);
                    results.push(whatsappInfo);
                    
                    // Display result
                    displayWhatsAppResult(resultContainer, whatsappInfo);
                    
                } catch (error) {
                    const errorResult = {
                        number: validation.formatted || number,
                        error: 'فشل في الفحص: ' + error.message
                    };
                    results.push(errorResult);
                    displayWhatsAppResult(resultContainer, errorResult);
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Display summary for fallback results
            const stats = calculateStats(results);
            displayResultsSummary(document.getElementById('bulk-summary'), stats, numbers.length);
            
            // Hide progress
            progressContainer.style.display = 'none';
        }
        
    } catch (error) {
        showMessage(resultContainer, 'حدث خطأ في قراءة الملف: ' + error.message, 'error');
        progressContainer.style.display = 'none';
    }
}

// Single carrier check
async function checkCarrier() {
    const numberInput = document.getElementById('carrier-number');
    const resultContainer = document.getElementById('carrier-result');
    const phoneNumber = numberInput.value.trim();
    
    if (!phoneNumber) {
        showMessage(resultContainer, 'يرجى إدخال رقم الهاتف', 'error');
        return;
    }
    
    // Validate phone number
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
        showMessage(resultContainer, validation.error, 'error');
        return;
    }
    
    // Get carrier info
    const carrierInfo = getCarrierInfo(validation.formatted || phoneNumber);
    
    // Display result
    displayCarrierResult(resultContainer, {
        number: validation.formatted || phoneNumber,
        ...carrierInfo
    });
}

// Bulk carrier check
async function checkBulkCarriers() {
    const fileInput = document.getElementById('carriers-file');
    const resultContainer = document.getElementById('bulk-carrier-result');
    
    if (!fileInput.files[0]) {
        showMessage(resultContainer, 'يرجى اختيار ملف يحتوي على الأرقام', 'error');
        return;
    }
    
    try {
        const fileContent = await readFile(fileInput.files[0]);
        const numbers = fileContent.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (numbers.length === 0) {
            showMessage(resultContainer, 'الملف فارغ أو لا يحتوي على أرقام صحيحة', 'error');
            return;
        }
        
        resultContainer.innerHTML = '';
        
        // Process numbers
        for (const number of numbers) {
            // Validate number
            const validation = validatePhoneNumber(number);
            if (!validation.valid) {
                displayCarrierResult(resultContainer, {
                    number: number,
                    error: validation.error
                });
                continue;
            }
            
            // Get carrier info
            const carrierInfo = getCarrierInfo(validation.formatted || number);
            
            // Display result
            displayCarrierResult(resultContainer, {
                number: validation.formatted || number,
                ...carrierInfo
            });
        }
        
        showMessage(resultContainer, `تم فحص ${numbers.length} رقم بنجاح`, 'success');
        
    } catch (error) {
        showMessage(resultContainer, 'حدث خطأ في قراءة الملف: ' + error.message, 'error');
    }
}

// Calculate statistics from results
function calculateStats(results) {
    const stats = {
        total: results.length,
        withWhatsApp: 0,
        withoutWhatsApp: 0,
        businessAccounts: 0,
        personalAccounts: 0,
        errors: 0,
        withProfilePicture: 0,
        businessDetails: []
    };
    
    results.forEach(result => {
        if (result.error) {
            stats.errors++;
        } else if (result.hasWhatsApp) {
            stats.withWhatsApp++;
            if (result.isBusiness) {
                stats.businessAccounts++;
                if (result.businessInfo) {
                    stats.businessDetails.push({
                        number: result.number,
                        name: result.name,
                        businessInfo: result.businessInfo
                    });
                }
            } else {
                stats.personalAccounts++;
            }
            if (result.profilePicture) {
                stats.withProfilePicture++;
            }
        } else {
            stats.withoutWhatsApp++;
        }
    });
    
    return stats;
}

// Display results summary
function displayResultsSummary(container, stats, totalChecked) {
    container.style.display = 'block';
    container.innerHTML = `
        <h3><i class="fas fa-chart-bar"></i> ملخص النتائج</h3>
        <div class="summary-stats">
            <div class="stat-item">
                <div class="stat-number">${totalChecked}</div>
                <div class="stat-label">تم فحصها</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.withWhatsApp}</div>
                <div class="stat-label">لديها واتساب</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.businessAccounts}</div>
                <div class="stat-label">حسابات تجارية</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.personalAccounts}</div>
                <div class="stat-label">حسابات شخصية</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.withProfilePicture}</div>
                <div class="stat-label">لديها صورة</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.errors}</div>
                <div class="stat-label">أخطاء</div>
            </div>
        </div>
        ${stats.businessDetails.length > 0 ? `
            <div style="margin-top: 20px;">
                <h4 style="color: white; margin-bottom: 10px;">
                    <i class="fas fa-building"></i> الحسابات التجارية المكتشفة: ${stats.businessDetails.length}
                </h4>
                <div style="font-size: 0.9rem; opacity: 0.9;">
                    ${stats.businessDetails.map(business => business.name || business.number).join(' • ')}
                </div>
            </div>
        ` : ''}
    `;
}

// Display WhatsApp result
function displayWhatsAppResult(container, data) {
    const resultDiv = document.createElement('div');
    resultDiv.className = `result-item ${data.error ? 'error' : ''} fade-in`;
    
    if (data.error) {
        resultDiv.innerHTML = `
            <div class="result-header">
                <div class="result-avatar">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="result-info">
                    <h3>${data.number}</h3>
                    <p style="color: #ff4757;">${data.error}</p>
                </div>
            </div>
        `;
    } else {
        resultDiv.innerHTML = `
            <div class="result-header">
                <div class="result-avatar">
                    ${data.profilePicture ? 
                        `<img src="${data.profilePicture}" alt="صورة الملف الشخصي" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                         <i class="fas fa-user" style="display: none;"></i>` : 
                        '<i class="fas fa-user"></i>'
                    }
                </div>
                <div class="result-info">
                    <h3>${data.number}</h3>
                    <p>${data.name || (data.country ? getCountryName(data.country) : 'غير محدد')}</p>
                    <div style="margin-top: 8px;">
                        <span class="status-badge ${data.hasWhatsApp ? 'whatsapp' : 'no-whatsapp'}">
                            ${data.hasWhatsApp ? 'يوجد واتساب' : 'لا يوجد واتساب'}
                        </span>
                        ${data.hasWhatsApp && data.isBusiness ? 
                            '<span class="status-badge business" style="margin-right: 5px;">حساب تجاري</span>' : 
                            data.hasWhatsApp ? '<span class="status-badge personal" style="margin-right: 5px;">حساب شخصي</span>' : ''
                        }
                    </div>
                </div>
            </div>
            ${data.hasWhatsApp ? `
                <div class="result-details">
                    ${data.name ? `
                        <div class="detail-item">
                            <div class="label">الاسم</div>
                            <div class="value success">${data.name}</div>
                        </div>
                    ` : ''}
                    <div class="detail-item">
                        <div class="label">آخر ظهور</div>
                        <div class="value">${data.lastSeen || 'غير متاح'}</div>
                    </div>
                    ${data.status ? `
                        <div class="detail-item">
                            <div class="label">الحالة</div>
                            <div class="value">${data.status}</div>
                        </div>
                    ` : ''}
                    <div class="detail-item">
                        <div class="label">نوع الحساب</div>
                        <div class="value ${data.isBusiness ? 'warning' : 'success'}">
                            ${data.isBusiness ? 'تجاري' : 'شخصي'}
                        </div>
                    </div>
                    ${data.isContact ? `
                        <div class="detail-item">
                            <div class="label">محفوظ</div>
                            <div class="value success">محفوظ في جهات الاتصال</div>
                        </div>
                    ` : ''}
                    ${data.isBusiness && data.businessInfo ? `
                        <div class="business-details">
                            <h4><i class="fas fa-building"></i> معلومات الحساب التجاري</h4>
                            ${data.businessInfo.description ? `
                                <div class="business-detail-item">
                                    <strong>الوصف:</strong>
                                    <span>${data.businessInfo.description}</span>
                                </div>
                            ` : ''}
                            ${data.businessInfo.category ? `
                                <div class="business-detail-item">
                                    <strong>الفئة:</strong>
                                    <span>${data.businessInfo.category}</span>
                                </div>
                            ` : ''}
                            ${data.businessInfo.website ? `
                                <div class="business-detail-item">
                                    <strong>الموقع الإلكتروني:</strong>
                                    <span><a href="${data.businessInfo.website}" target="_blank">${data.businessInfo.website}</a></span>
                                </div>
                            ` : ''}
                            ${data.businessInfo.email ? `
                                <div class="business-detail-item">
                                    <strong>البريد الإلكتروني:</strong>
                                    <span>${data.businessInfo.email}</span>
                                </div>
                            ` : ''}
                            ${data.businessInfo.address ? `
                                <div class="business-detail-item">
                                    <strong>العنوان:</strong>
                                    <span>${data.businessInfo.address}</span>
                                </div>
                            ` : ''}
                            ${data.businessInfo.products && data.businessInfo.products.length > 0 ? `
                                <div class="business-detail-item">
                                    <strong>المنتجات:</strong>
                                    <span>${data.businessInfo.products.length} منتج متاح</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        `;
    }
    
    container.appendChild(resultDiv);
}

// Display carrier result
function displayCarrierResult(container, data) {
    const resultDiv = document.createElement('div');
    resultDiv.className = `result-item ${data.error ? 'error' : ''} fade-in`;
    
    if (data.error) {
        resultDiv.innerHTML = `
            <div class="result-header">
                <div class="result-avatar">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="result-info">
                    <h3>${data.number}</h3>
                    <p style="color: #ff4757;">${data.error}</p>
                </div>
            </div>
        `;
    } else {
        resultDiv.innerHTML = `
            <div class="result-header">
                <div class="result-avatar">
                    <i class="fas fa-satellite-dish"></i>
                </div>
                <div class="result-info">
                    <h3>${data.number}</h3>
                    <p>${data.country || 'غير محدد'}</p>
                </div>
            </div>
            <div class="result-details">
                <div class="detail-item">
                    <div class="label">الدولة</div>
                    <div class="value success">${data.country || 'غير محدد'}</div>
                </div>
                <div class="detail-item">
                    <div class="label">مشغل الشبكة</div>
                    <div class="value ${data.carrier !== 'غير محدد' ? 'success' : 'warning'}">
                        ${data.carrier || 'غير محدد'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="label">نوع الرقم</div>
                    <div class="value">${data.numberType || 'غير محدد'}</div>
                </div>
                ${data.region ? `
                    <div class="detail-item">
                        <div class="label">المنطقة</div>
                        <div class="value">${data.region}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    container.appendChild(resultDiv);
}

// Utility functions
function showMessage(container, message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} fade-in`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-triangle' : 
                 'info-circle';
    
    messageDiv.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.innerHTML = '';
    container.appendChild(messageDiv);
}

function showLoading(show) {
    const modal = document.getElementById('loading-modal');
    modal.style.display = show ? 'flex' : 'none';
}

function updateProgress(percentage) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    progressFill.style.width = percentage + '%';
    progressText.textContent = Math.round(percentage) + '%';
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error('فشل في قراءة الملف'));
        reader.readAsText(file);
    });
}

// File upload handlers
document.getElementById('numbers-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const uploadZone = this.parentElement.querySelector('.upload-zone');
        uploadZone.innerHTML = `
            <i class="fas fa-file-text"></i>
            <p>تم اختيار: ${file.name}</p>
            <small>حجم الملف: ${(file.size / 1024).toFixed(1)} KB</small>
        `;
    }
});

document.getElementById('carriers-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const uploadZone = this.parentElement.querySelector('.upload-zone');
        uploadZone.innerHTML = `
            <i class="fas fa-file-text"></i>
            <p>تم اختيار: ${file.name}</p>
            <small>حجم الملف: ${(file.size / 1024).toFixed(1)} KB</small>
        `;
    }
});

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('تم تحميل تطبيق فحص أرقام الواتساب بنجاح');
    
    // Initialize connection status
    updateConnectionStatus('connecting');
    
    // Start status monitoring
    checkBackendStatus();
    statusCheckInterval = setInterval(checkBackendStatus, 5000); // Check every 5 seconds
    
    // Add keyboard support for Enter key
    document.getElementById('single-number').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkSingleNumber();
        }
    });
    
    document.getElementById('carrier-number').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkCarrier();
        }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', function() {
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }
    });
});