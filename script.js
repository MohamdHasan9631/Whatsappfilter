// Global variables
let currentNumbers = [];
let checkingProgress = 0;
let totalNumbers = 0;
let backendStatus = 'connecting';
let statusCheckInterval = null;
let currentResults = [];
let isTableView = true; // Default to table view
let currentFileData = null;
let processedFiles = [];
let numbersChecked = 0;
let sessionStartTime = Date.now();

// Backend API configuration
const API_BASE = window.location.origin; // Same domain as frontend

// Sidebar and navigation functionality
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('show');
    mainContent.classList.toggle('sidebar-collapsed');
}

function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Remove active state from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Activate corresponding nav item
    const clickedItem = event?.target.closest('.nav-item');
    if (clickedItem) {
        clickedItem.classList.add('active');
    }
    
    // Close sidebar on mobile after selection
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.remove('show');
    }
}

// Account and connection management
function showAccountModal() {
    document.getElementById('account-modal').style.display = 'flex';
    updateAccountModalInfo();
}

function closeAccountModal() {
    document.getElementById('account-modal').style.display = 'none';
}

function updateAccountModalInfo() {
    const connectedAccount = document.getElementById('connected-account').textContent;
    const accountName = document.getElementById('modal-account-name');
    const accountNumber = document.getElementById('modal-account-number');
    const numbersCheckedEl = document.getElementById('numbers-checked');
    const sessionTimeEl = document.getElementById('session-time');
    
    if (connectedAccount && connectedAccount !== 'None') {
        accountName.textContent = connectedAccount;
        accountNumber.textContent = connectedAccount;
    } else {
        accountName.textContent = 'Not Connected';
        accountNumber.textContent = 'No WhatsApp account connected';
    }
    
    numbersCheckedEl.textContent = numbersChecked.toString();
    
    const sessionTime = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(sessionTime / 60);
    const seconds = sessionTime % 60;
    sessionTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function refreshAccountInfo() {
    checkBackendStatus();
    updateAccountModalInfo();
}

function connectWhatsApp() {
    showQRModal();
}

function disconnectWhatsApp() {
    // Implementation for disconnecting WhatsApp
    fetch(`${API_BASE}/disconnect`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            updateConnectionStatus('disconnected');
            updateAccountInfo('Not Connected', 'Click to connect WhatsApp');
            closeAccountModal();
        })
        .catch(error => {
            console.error('Error disconnecting:', error);
        });
}

function refreshConnection() {
    checkBackendStatus();
}

// Phone number validation and formatting with enhanced error messages
function validatePhoneNumber(number) {
    try {
        // Check if number is provided
        if (!number || typeof number !== 'string') {
            return { valid: false, error: 'Please enter a valid phone number' };
        }
        
        // Remove all non-digit characters except +
        const cleanNumber = number.replace(/[^\d+]/g, '');
        
        // Check if number is empty after cleaning
        if (!cleanNumber) {
            return { valid: false, error: 'The entered number is empty or contains invalid characters' };
        }
        
        // Basic validation
        if (!cleanNumber.startsWith('+')) {
            return { 
                valid: false, 
                error: 'Number must start with + followed by country code (e.g., +962791234567)' 
            };
        }
        
        // Check minimum length
        if (cleanNumber.length < 10) {
            return { 
                valid: false, 
                error: `Number is too short. Should contain 10-15 digits (current: ${cleanNumber.length - 1})` 
            };
        }
        
        // Check maximum length
        if (cleanNumber.length > 15) {
            return { 
                valid: false, 
                error: `Number is too long. Should contain 10-15 digits (current: ${cleanNumber.length - 1})` 
            };
        }
        
        // Check if it's just a + sign
        if (cleanNumber === '+') {
            return { valid: false, error: 'Please enter the phone number after the + sign' };
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
                } else {
                    return { 
                        valid: false, 
                        error: `Invalid number format for the specified country. Check country code and phone number` 
                    };
                }
            } catch (e) {
                return { 
                    valid: false, 
                    error: `Error parsing number: ${e.message || 'Unsupported format'}` 
                };
            }
        }
        
        return { valid: true, formatted: cleanNumber };
    } catch (error) {
        return { 
            valid: false, 
            error: `Unexpected error processing number: ${error.message || 'Unknown error'}` 
        };
    }
}

// Check backend connection status
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const data = await response.json();
        
        backendStatus = data.status;
        updateConnectionStatus(data.status, data.qrCode);
        
        // Update account info if connected
        if (data.status === 'connected' && data.accountInfo) {
            updateAccountInfo(data.accountInfo.name || data.accountInfo.number, 'Connected and ready');
        }
        
        return data;
    } catch (error) {
        console.error('Server connection error:', error);
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
            statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Connecting...</span>';
            break;
            
        case 'connected':
            statusElement.classList.add('connected');
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i><span>Connected - Ready to check</span>';
            break;
            
        case 'qr_ready':
            statusElement.classList.add('connecting');
            statusElement.innerHTML = '<i class="fas fa-qrcode"></i><span>Click to show QR code</span>';
            statusElement.onclick = () => showQRModal(qrCode);
            statusElement.style.cursor = 'pointer';
            break;
            
        case 'disconnected':
            statusElement.classList.add('disconnected');
            statusElement.innerHTML = '<i class="fas fa-times-circle"></i><span>Disconnected</span>';
            break;
            
        case 'error':
        default:
            statusElement.classList.add('error');
            statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Connection error</span>';
            break;
    }
}

// Update account information in navbar
function updateAccountInfo(name, status) {
    const accountName = document.getElementById('account-name');
    const accountStatus = document.getElementById('account-status');
    const connectedAccount = document.getElementById('connected-account');
    
    if (accountName) accountName.textContent = name;
    if (accountStatus) accountStatus.textContent = status;
    if (connectedAccount) connectedAccount.textContent = name !== 'Not Connected' ? name : 'None';
}

// Country code to flag mapping for better flag display
function getCountryFlag(countryCode) {
    if (!countryCode) return '';
    return `<span class="fi fi-${countryCode.toLowerCase()}" title="${getCountryName(countryCode)}"></span>`;
}

// Enhanced country name mapping
function getCountryName(countryCode) {
    const countries = {
        'US': 'United States',
        'CA': 'Canada', 
        'GB': 'United Kingdom',
        'JO': 'Jordan',
        'SA': 'Saudi Arabia',
        'AE': 'United Arab Emirates',
        'EG': 'Egypt',
        'LB': 'Lebanon',
        'SY': 'Syria',
        'IQ': 'Iraq',
        'KW': 'Kuwait',
        'QA': 'Qatar',
        'BH': 'Bahrain',
        'OM': 'Oman',
        'YE': 'Yemen',
        'PS': 'Palestine',
        'FR': 'France',
        'DE': 'Germany',
        'IT': 'Italy',
        'ES': 'Spain',
        'AU': 'Australia',
        'NZ': 'New Zealand',
        'IN': 'India',
        'PK': 'Pakistan',
        'BD': 'Bangladesh',
        'MY': 'Malaysia',
        'SG': 'Singapore',
        'TH': 'Thailand',
        'PH': 'Philippines',
        'ID': 'Indonesia',
        'VN': 'Vietnam',
        'CN': 'China',
        'JP': 'Japan',
        'KR': 'South Korea',
        'RU': 'Russia',
        'TR': 'Turkey',
        'IR': 'Iran',
        'IL': 'Israel',
        'BR': 'Brazil',
        'MX': 'Mexico',
        'AR': 'Argentina',
        'CL': 'Chile',
        'CO': 'Colombia',
        'PE': 'Peru',
        'ZA': 'South Africa',
        'NG': 'Nigeria',
        'KE': 'Kenya',
        'GH': 'Ghana',
        'ET': 'Ethiopia',
        'MA': 'Morocco',
        'DZ': 'Algeria',
        'TN': 'Tunisia',
        'LY': 'Libya'
    };
    
    return countries[countryCode] || countryCode;
}

// Get timezone information for country
function getTimeZoneInfo(countryCode) {
    const timeZones = {
        'US': 'UTC-5 to UTC-10',
        'CA': 'UTC-3.5 to UTC-8',
        'GB': 'UTC+0',
        'JO': 'UTC+3',
        'SA': 'UTC+3',
        'AE': 'UTC+4',
        'EG': 'UTC+2',
        'LB': 'UTC+2',
        'SY': 'UTC+3',
        'IQ': 'UTC+3',
        'KW': 'UTC+3',
        'QA': 'UTC+3',
        'BH': 'UTC+3',
        'OM': 'UTC+4',
        'YE': 'UTC+3',
        'PS': 'UTC+2',
        'FR': 'UTC+1',
        'DE': 'UTC+1',
        'IT': 'UTC+1',
        'ES': 'UTC+1',
        'AU': 'UTC+8 to UTC+11',
        'NZ': 'UTC+12',
        'IN': 'UTC+5.5',
        'CN': 'UTC+8',
        'JP': 'UTC+9',
        'KR': 'UTC+9',
        'RU': 'UTC+2 to UTC+12',
        'BR': 'UTC-2 to UTC-5',
        'MX': 'UTC-6 to UTC-8'
    };
    
    return timeZones[countryCode] || 'Unknown';
}

// Get region information
function getRegionInfo(countryCode) {
    const regions = {
        'US': 'North America',
        'CA': 'North America',
        'JO': 'Middle East',
        'SA': 'Middle East',
        'AE': 'Middle East',
        'EG': 'Middle East & Africa',
        'LB': 'Middle East',
        'SY': 'Middle East',
        'IQ': 'Middle East',
        'KW': 'Middle East',
        'QA': 'Middle East',
        'BH': 'Middle East',
        'OM': 'Middle East',
        'YE': 'Middle East',
        'PS': 'Middle East',
        'FR': 'Europe',
        'DE': 'Europe',
        'GB': 'Europe',
        'IT': 'Europe',
        'ES': 'Europe',
        'AU': 'Oceania',
        'NZ': 'Oceania',
        'IN': 'Asia',
        'CN': 'Asia',
        'JP': 'Asia',
        'KR': 'Asia',
        'RU': 'Europe & Asia',
        'BR': 'South America',
        'MX': 'North America',
        'ZA': 'Africa',
        'NG': 'Africa',
        'EG': 'Africa'
    };
    
    return regions[countryCode] || 'Unknown';
}

// Enhanced carrier information with real libphonenumbers integration
function getCarrierInfo(phoneNumber) {
    try {
        if (typeof libphonenumber !== 'undefined') {
            const phone = libphonenumber.parsePhoneNumber(phoneNumber);
            if (phone.isValid()) {
                const country = phone.country;
                const nationalNumber = phone.nationalNumber;
                const carrier = getCarrierByCountryAndNumber(country, nationalNumber);
                
                return {
                    country: getCountryName(country),
                    countryCode: country,
                    carrier: carrier,
                    numberType: phone.getType() || 'Unknown',
                    region: getRegionInfo(country),
                    timeZone: getTimeZoneInfo(country),
                    isValid: true,
                    nationalNumber: nationalNumber,
                    countryCallingCode: phone.countryCallingCode,
                    formatted: phone.format('INTERNATIONAL')
                };
            }
        }
        
        // Fallback for basic carrier detection
        return getBasicCarrierInfo(phoneNumber);
    } catch (error) {
        return {
            country: 'Unknown',
            carrier: 'Unknown',
            error: 'Cannot determine carrier information',
            isValid: false
        };
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
    // Generate a placeholder image based on phone number using canvas (local generation)
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    const colorIndex = parseInt(phoneNumber.slice(-1)) % colors.length;
    const initials = phoneNumber.slice(-2);
    
    try {
        // Create a canvas to generate a local placeholder
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Draw background circle
        ctx.fillStyle = colors[colorIndex];
        ctx.beginPath();
        ctx.arc(64, 64, 64, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw initials
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, 64, 64);
        
        // Return data URL
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.warn('فشل في إنشاء صورة محلية، استخدام الخدمة الخارجية:', error);
        // Fallback to external service if canvas fails
        return `https://ui-avatars.com/api/?name=${initials}&background=${colors[colorIndex].slice(1)}&color=fff&size=128`;
    }
}

// Enhanced image validation
function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Check for data URLs (base64 images)
    if (url.startsWith('data:image/')) return true;
    
    // Check for valid HTTP/HTTPS URLs
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}

// Extract profile picture URL from profilePicture object
function extractProfilePictureUrl(profilePicture) {
    if (!profilePicture) return null;
    
    // If it's already a string URL, return it
    if (typeof profilePicture === 'string') {
        return isValidImageUrl(profilePicture) ? profilePicture : null;
    }
    
    // If it's an object, extract the best available URL
    if (typeof profilePicture === 'object') {
        // Priority: imgFull > img > eurl
        const urls = [
            profilePicture.imgFull,
            profilePicture.img, 
            profilePicture.eurl
        ];
        
        for (const url of urls) {
            if (url && isValidImageUrl(url)) {
                return url;
            }
        }
    }
    
    return null;
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
    const phoneNumber = numberInput.value.trim();
    
    if (!phoneNumber) {
        showMessage('Please enter a phone number', 'error');
        return;
    }
    
    // Check backend connection
    if (backendStatus !== 'connected') {
        showMessage('WhatsApp client is not connected. Please ensure connection first.', 'error');
        return;
    }
    
    // Validate phone number
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
        displaySingleWhatsAppResult({
            number: phoneNumber,
            error: validation.error
        });
        return;
    }
    
    // Show loading
    showLoading(true);
    
    try {
        // Check WhatsApp status using real API
        const whatsappInfo = await checkWhatsAppStatus(validation.formatted || phoneNumber);
        
        // Add validation info to the result
        const resultData = {
            ...whatsappInfo,
            number: validation.formatted || phoneNumber,
            country: validation.country,
            formatted: validation.formatted
        };
        
        // Display result in DataTable
        displaySingleWhatsAppResult(resultData);
        
        // Increment counter
        numbersChecked++;
        
    } catch (error) {
        displaySingleWhatsAppResult({
            number: phoneNumber,
            error: 'Error during check: ' + error.message
        });
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
        const numbers = parseNumbersFromFile(fileContent, fileInput.files[0].name);
        
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
            
            // Store results for export
            storeResults(result.data);
            
            result.data.forEach((data, index) => {
                // Update progress
                checkingProgress = index + 1;
                updateProgress((checkingProgress / totalNumbers) * 100, checkingProgress, totalNumbers);
                
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
                updateProgress((checkingProgress / totalNumbers) * 100, checkingProgress, totalNumbers);
                
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
            
            // Store results for export
            storeResults(results);
            
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
    const phoneNumber = numberInput.value.trim();
    
    if (!phoneNumber) {
        showMessage('Please enter a phone number', 'error');
        return;
    }
    
    // Validate phone number
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
        displayCarrierResult({
            number: phoneNumber,
            error: validation.error
        });
        return;
    }
    
    // Get carrier info
    const carrierInfo = getCarrierInfo(validation.formatted || phoneNumber);
    
    // Display result in DataTable
    displayCarrierResult({
        number: validation.formatted || phoneNumber,
        formatted: validation.formatted,
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
        const numbers = parseNumbersFromFile(fileContent, fileInput.files[0].name);
        
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
        
        <!-- Export buttons -->
        <div class="export-controls" style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button onclick="exportResults('all')" class="btn-secondary">
                <i class="fas fa-download"></i> تصدير جميع النتائج
            </button>
            <button onclick="exportResults('valid')" class="btn-secondary">
                <i class="fas fa-check-circle"></i> تصدير الصالحة فقط
            </button>
            <button onclick="exportResults('invalid')" class="btn-secondary">
                <i class="fas fa-times-circle"></i> تصدير غير الصالحة فقط
            </button>
            <button onclick="toggleTableView()" class="btn-secondary">
                <i class="fas fa-table"></i> عرض جدولي
            </button>
        </div>
        
        <!-- Filter controls -->
        <div class="filter-controls" style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <span style="color: white; font-weight: bold;">تصفية النتائج:</span>
            <select id="status-filter" onchange="filterResults()" class="filter-select">
                <option value="all">جميع النتائج</option>
                <option value="valid">لديها واتساب فقط</option>
                <option value="invalid">ليس لديها واتساب</option>
                <option value="errors">الأخطاء فقط</option>
            </select>
            <select id="type-filter" onchange="filterResults()" class="filter-select">
                <option value="all">جميع الأنواع</option>
                <option value="business">تجارية فقط</option>
                <option value="personal">شخصية فقط</option>
            </select>
            <button onclick="resetFilters()" class="btn-secondary" style="font-size: 0.8rem; padding: 5px 10px;">
                <i class="fas fa-undo"></i> إعادة تعيين
            </button>
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

// Create enhanced profile picture component
function createProfilePictureComponent(profilePicture, phoneNumber, isLarge = false) {
    const size = isLarge ? 'large' : 'normal';
    const profilePictureUrl = extractProfilePictureUrl(profilePicture);
    const fallbackUrl = generateProfilePicture(phoneNumber);
    
    return `
        <div class="profile-picture-container ${size}">
            <div class="profile-picture-wrapper">
                ${profilePictureUrl ? `
                    <img class="profile-picture primary" 
                         src="${profilePictureUrl}" 
                         alt="صورة الملف الشخصي الأساسية"
                         onload="handleProfilePictureLoad(this)" 
                         onerror="handleProfilePictureError(this, '${fallbackUrl}', '${phoneNumber}')"
                         style="opacity: 0; transition: opacity 0.3s ease;">
                ` : ''}
                <img class="profile-picture fallback" 
                     src="${fallbackUrl}" 
                     alt="صورة الملف الشخصي البديلة"
                     onload="handleProfilePictureLoad(this)" 
                     onerror="handleProfilePictureFinalError(this)"
                     style="opacity: ${profilePictureUrl ? '0' : '0'}; transition: opacity 0.3s ease;">
                <div class="profile-picture-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="profile-picture-icon" style="display: none;">
                    <i class="fas fa-user"></i>
                </div>
            </div>
        </div>
    `;
}

// Handle profile picture loading
function handleProfilePictureLoad(img) {
    const container = img.closest('.profile-picture-wrapper');
    const loading = container.querySelector('.profile-picture-loading');
    
    if (loading) loading.style.display = 'none';
    img.style.opacity = '1';
    
    // Hide other images if this one loaded successfully
    if (img.classList.contains('primary')) {
        const fallback = container.querySelector('.fallback');
        if (fallback) fallback.style.opacity = '0';
    }
}

// Handle profile picture error
function handleProfilePictureError(img, fallbackUrl, phoneNumber) {
    console.warn('فشل في تحميل صورة الملف الشخصي الأساسية، جاري المحاولة مع البديل');
    
    const container = img.closest('.profile-picture-wrapper');
    const fallback = container.querySelector('.fallback');
    
    img.style.opacity = '0';
    
    if (fallback) {
        fallback.style.opacity = '0';
        setTimeout(() => {
            fallback.style.opacity = '1';
        }, 100);
    }
}

// Handle final profile picture error
function handleProfilePictureFinalError(img) {
    console.warn('فشل في تحميل جميع صور الملف الشخصي، عرض الأيقونة البديلة');
    
    const container = img.closest('.profile-picture-wrapper');
    const loading = container.querySelector('.profile-picture-loading');
    const icon = container.querySelector('.profile-picture-icon');
    
    if (loading) loading.style.display = 'none';
    if (icon) icon.style.display = 'flex';
    img.style.opacity = '0';
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
                    ${createProfilePictureComponent(data.profilePicture, data.number)}
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
    
    // Add click handler for profile picture showcase if WhatsApp account exists
    if (!data.error && data.hasWhatsApp) {
        const profilePictureUrl = extractProfilePictureUrl(data.profilePicture);
        if (profilePictureUrl) {
            const avatarElement = resultDiv.querySelector('.result-avatar');
            if (avatarElement) {
                avatarElement.style.cursor = 'pointer';
                avatarElement.addEventListener('click', () => {
                    showProfileShowcase(data, profilePictureUrl);
                });
            }
        }
    }
}

// Show profile picture showcase
function showProfileShowcase(data, profilePictureUrl) {
    const showcase = document.getElementById('profile-showcase');
    const showcaseProfilePicture = showcase.querySelector('.showcase-profile-picture');
    const showcaseNumber = document.getElementById('showcase-number');
    const showcaseName = document.getElementById('showcase-name');
    
    // Update showcase content
    showcaseProfilePicture.innerHTML = createProfilePictureComponent(data.profilePicture, data.number, true);
    showcaseNumber.textContent = data.number;
    showcaseName.textContent = data.name || (data.country ? getCountryName(data.country) : 'غير محدد');
    
    // Store current profile data for download/fullscreen functions
    window.currentProfileData = {
        number: data.number,
        name: data.name,
        profilePictureUrl: profilePictureUrl
    };
    
    // Show showcase
    showcase.style.display = 'block';
    showcase.scrollIntoView({ behavior: 'smooth' });
}

// Close profile showcase
function closeProfileShowcase() {
    const showcase = document.getElementById('profile-showcase');
    showcase.style.display = 'none';
}

// Download profile picture
function downloadProfilePicture() {
    if (!window.currentProfileData) return;
    
    const { profilePictureUrl, number } = window.currentProfileData;
    
    // Create a temporary link element to trigger download
    const link = document.createElement('a');
    link.href = profilePictureUrl;
    link.download = `profile_${number}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Open profile picture fullscreen
function openProfilePictureFullscreen() {
    if (!window.currentProfileData) return;
    
    const { profilePictureUrl } = window.currentProfileData;
    window.open(profilePictureUrl, '_blank');
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

function updateProgress(percentage, current = null, total = null) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    progressFill.style.width = percentage + '%';
    
    // Enhanced progress text with current/total info
    if (current !== null && total !== null) {
        progressText.textContent = `جاري فحص ${current} من ${total} (${Math.round(percentage)}%)`;
    } else {
        progressText.textContent = Math.round(percentage) + '%';
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error('فشل في قراءة الملف'));
        reader.readAsText(file);
    });
}

// Parse numbers from file content (supports TXT and CSV) with enhanced error handling
function parseNumbersFromFile(fileContent, fileName) {
    const fileExtension = fileName.split('.').pop().toLowerCase();
    let numbers = [];
    let errorMessages = [];
    
    try {
        if (fileExtension === 'csv') {
            // Parse CSV - look for phone numbers in any column
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                throw new Error('الملف فارغ');
            }
            
            for (let i = 0; i < lines.length; i++) {
                const lineNumber = i + 1;
                const line = lines[i].trim();
                
                if (!line) continue;
                
                // Split by comma and handle quoted values
                const cells = line.split(',').map(cell => 
                    cell.trim().replace(/^["']|["']$/g, '') // Remove quotes
                );
                
                let foundNumber = false;
                
                // Find cells that look like phone numbers
                for (const cell of cells) {
                    if (cell && (cell.startsWith('+') || /^\d{8,}$/.test(cell))) {
                        let cleanNumber = cell.startsWith('+') ? cell : '+' + cell;
                        
                        // Basic cleanup
                        cleanNumber = cleanNumber.replace(/[^\d+]/g, '');
                        
                        if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
                            numbers.push(cleanNumber);
                            foundNumber = true;
                            break; // Only take first phone number from each row
                        }
                    }
                }
                
                // Track lines without valid numbers for reporting
                if (!foundNumber && lineNumber <= 10) { // Only report first 10 errors
                    errorMessages.push(`السطر ${lineNumber}: لم يتم العثور على رقم صالح`);
                }
            }
            
            // Provide feedback about parsing
            if (numbers.length === 0) {
                throw new Error('لم يتم العثور على أي أرقام صالحة في ملف CSV. تأكد من وجود عمود يحتوي على أرقام الهواتف');
            }
            
        } else {
            // Parse TXT - one number per line
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                throw new Error('الملف فارغ');
            }
            
            for (let i = 0; i < lines.length; i++) {
                const lineNumber = i + 1;
                const line = lines[i].trim();
                
                if (line) {
                    numbers.push(line);
                } else if (lineNumber <= 10) {
                    errorMessages.push(`السطر ${lineNumber}: سطر فارغ`);
                }
            }
        }
        
        // Log parsing results for user feedback
        if (errorMessages.length > 0) {
            console.warn('تحذيرات في تحليل الملف:', errorMessages);
        }
        
        return numbers;
        
    } catch (error) {
        throw new Error(`خطأ في تحليل الملف: ${error.message}`);
    }
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

// Image handling functions for better profile picture display
function handleImageLoad(img) {
    // Hide loading indicator
    const loadingDiv = img.parentElement.querySelector('.image-loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
    
    // Show the image with fade-in effect
    img.style.opacity = '1';
    
    // Hide fallback icon
    const fallbackIcon = img.parentElement.querySelector('.profile-fallback-icon');
    if (fallbackIcon) {
        fallbackIcon.style.display = 'none';
    }
}

function handleImageError(img, phoneNumber) {
    // Hide loading indicator
    const loadingDiv = img.parentElement.querySelector('.image-loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
    
    // Log the error for debugging
    console.warn('فشل في تحميل صورة الملف الشخصي:', img.src);
    
    // Try to use generated placeholder instead of just showing icon
    if (phoneNumber) {
        const placeholderUrl = generateProfilePicture(phoneNumber);
        if (placeholderUrl !== img.src) {
            img.onload = () => handleImageLoad(img);
            img.onerror = () => {
                // If placeholder also fails, show fallback icon
                img.style.display = 'none';
                const fallbackIcon = img.parentElement.querySelector('.profile-fallback-icon');
                if (fallbackIcon) {
                    fallbackIcon.style.display = 'block';
                }
            };
            img.src = placeholderUrl;
            return;
        }
    }
    
    // Hide the failed image
    img.style.display = 'none';
    
    // Show fallback icon
    const fallbackIcon = img.parentElement.querySelector('.profile-fallback-icon');
    if (fallbackIcon) {
        fallbackIcon.style.display = 'block';
    }
}

// Enhanced image loading with retry mechanism
function loadProfileImage(imageUrl, container) {
    if (!imageUrl || !container) return;
    
    // Create image element
    const img = document.createElement('img');
    img.alt = 'صورة الملف الشخصي';
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s ease';
    
    // Create loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'image-loading';
    loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Create fallback icon
    const fallbackIcon = document.createElement('i');
    fallbackIcon.className = 'fas fa-user profile-fallback-icon';
    fallbackIcon.style.display = 'none';
    
    // Add elements to container
    container.appendChild(img);
    container.appendChild(fallbackIcon);
    container.appendChild(loadingDiv);
    
    // Set up event handlers
    img.onload = () => handleImageLoad(img);
    img.onerror = () => handleImageError(img);
    
    // Start loading the image
    img.src = imageUrl;
    
    // Fallback timeout in case image takes too long
    setTimeout(() => {
        if (img.style.opacity === '0' && loadingDiv.style.display !== 'none') {
            handleImageError(img);
        }
    }, 10000); // 10 second timeout
}

// Export results functionality
function exportResults(type = 'all') {
    if (!currentResults || currentResults.length === 0) {
        showMessage(document.getElementById('bulk-result'), 'لا توجد نتائج للتصدير', 'warning');
        return;
    }
    
    let dataToExport = [];
    
    switch (type) {
        case 'valid':
            dataToExport = currentResults.filter(result => !result.error && result.hasWhatsApp);
            break;
        case 'invalid':
            dataToExport = currentResults.filter(result => result.error || !result.hasWhatsApp);
            break;
        case 'all':
        default:
            dataToExport = currentResults;
            break;
    }
    
    if (dataToExport.length === 0) {
        showMessage(document.getElementById('bulk-result'), 'لا توجد نتائج من هذا النوع للتصدير', 'warning');
        return;
    }
    
    // Prepare CSV data
    const csvHeaders = ['الرقم', 'الحالة', 'النوع', 'الاسم', 'معلومات تجارية', 'الدولة', 'مشغل الشبكة', 'صورة الملف الشخصي'];
    const csvData = [csvHeaders];
    
    dataToExport.forEach(result => {
        const row = [
            result.number || '',
            result.error ? 'خطأ' : (result.hasWhatsApp ? 'لديه واتساب' : 'ليس لديه واتساب'),
            result.isBusiness ? 'تجاري' : 'شخصي',
            result.name || '',
            result.businessInfo || '',
            result.country || '',
            result.carrier || '',
            result.profilePicture ? 'متوفرة' : 'غير متوفرة'
        ];
        csvData.push(row);
    });
    
    // Convert to CSV format
    const csvContent = csvData.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    
    // Create and download file
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `whatsapp_results_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage(document.getElementById('bulk-result'), `تم تصدير ${dataToExport.length} نتيجة بنجاح`, 'success');
}

// Toggle between card view and table view
function toggleTableView() {
    isTableView = !isTableView;
    const resultContainer = document.getElementById('bulk-result');
    
    if (isTableView) {
        displayResultsAsTable(resultContainer, currentResults);
    } else {
        displayResultsAsCards(resultContainer, currentResults);
    }
    
    // Update button text
    const toggleButton = document.querySelector('button[onclick="toggleTableView()"]');
    if (toggleButton) {
        toggleButton.innerHTML = isTableView ? 
            '<i class="fas fa-th-large"></i> عرض البطاقات' : 
            '<i class="fas fa-table"></i> عرض جدولي';
    }
}

// Display results as table
function displayResultsAsTable(container, results) {
    if (!results || results.length === 0) {
        return;
    }
    
    let tableHTML = `
        <div class="results-table-container">
            <table class="results-table">
                <thead>
                    <tr>
                        <th onclick="sortTable(0)">الرقم <i class="fas fa-sort"></i></th>
                        <th onclick="sortTable(1)">الحالة <i class="fas fa-sort"></i></th>
                        <th onclick="sortTable(2)">النوع <i class="fas fa-sort"></i></th>
                        <th onclick="sortTable(3)">الاسم <i class="fas fa-sort"></i></th>
                        <th onclick="sortTable(4)">الدولة <i class="fas fa-sort"></i></th>
                        <th onclick="sortTable(5)">صورة <i class="fas fa-sort"></i></th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach(result => {
        const status = result.error ? 'خطأ' : (result.hasWhatsApp ? 'متوفر' : 'غير متوفر');
        const statusClass = result.error ? 'error' : (result.hasWhatsApp ? 'success' : 'warning');
        const type = result.isBusiness ? 'تجاري' : 'شخصي';
        const hasImage = result.profilePicture ? 'متوفرة' : 'غير متوفرة';
        
        tableHTML += `
            <tr class="${statusClass}">
                <td dir="ltr">${result.number || ''}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>${result.hasWhatsApp ? type : '-'}</td>
                <td>${result.name || '-'}</td>
                <td>${result.country || '-'}</td>
                <td>${result.hasWhatsApp ? hasImage : '-'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

// Display results as cards (original view)
function displayResultsAsCards(container, results) {
    container.innerHTML = '';
    results.forEach(result => {
        displayWhatsAppResult(container, result);
    });
}

// Sort table functionality
let sortDirection = {};

function sortTable(columnIndex) {
    const table = document.querySelector('.results-table tbody');
    const rows = Array.from(table.querySelectorAll('tr'));
    
    // Toggle sort direction
    sortDirection[columnIndex] = !sortDirection[columnIndex];
    const isAscending = sortDirection[columnIndex];
    
    rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent.trim();
        const bValue = b.cells[columnIndex].textContent.trim();
        
        if (isAscending) {
            return aValue.localeCompare(bValue, 'ar');
        } else {
            return bValue.localeCompare(aValue, 'ar');
        }
    });
    
    // Clear and re-append sorted rows
    table.innerHTML = '';
    rows.forEach(row => table.appendChild(row));
    
    // Update sort icons
    document.querySelectorAll('.results-table th i').forEach((icon, index) => {
        if (index === columnIndex) {
            icon.className = isAscending ? 'fas fa-sort-up' : 'fas fa-sort-down';
        } else {
            icon.className = 'fas fa-sort';
        }
    });
}

// Update the bulk check function to store results globally
function storeResults(results) {
    currentResults = results;
}

// Filter results functionality
function filterResults() {
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const typeFilter = document.getElementById('type-filter')?.value || 'all';
    
    if (!currentResults || currentResults.length === 0) {
        return;
    }
    
    let filteredResults = currentResults.filter(result => {
        // Status filter
        let statusMatch = true;
        switch (statusFilter) {
            case 'valid':
                statusMatch = !result.error && result.hasWhatsApp;
                break;
            case 'invalid':
                statusMatch = !result.error && !result.hasWhatsApp;
                break;
            case 'errors':
                statusMatch = !!result.error;
                break;
            case 'all':
            default:
                statusMatch = true;
                break;
        }
        
        // Type filter
        let typeMatch = true;
        if (typeFilter !== 'all' && result.hasWhatsApp && !result.error) {
            switch (typeFilter) {
                case 'business':
                    typeMatch = result.isBusiness;
                    break;
                case 'personal':
                    typeMatch = !result.isBusiness;
                    break;
                default:
                    typeMatch = true;
                    break;
            }
        } else if (typeFilter !== 'all') {
            typeMatch = false; // Hide non-WhatsApp results when filtering by type
        }
        
        return statusMatch && typeMatch;
    });
    
    // Display filtered results
    const resultContainer = document.getElementById('bulk-result');
    if (isTableView) {
        displayResultsAsTable(resultContainer, filteredResults);
    } else {
        displayResultsAsCards(resultContainer, filteredResults);
    }
    
    // Update summary to show filter info
    if (filteredResults.length !== currentResults.length) {
        const summaryContainer = document.getElementById('bulk-summary');
        const filterInfo = document.createElement('div');
        filterInfo.className = 'filter-info';
        filterInfo.style.cssText = 'background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; margin-top: 10px; font-size: 0.9rem;';
        filterInfo.innerHTML = `<i class="fas fa-filter"></i> تم عرض ${filteredResults.length} من ${currentResults.length} نتيجة`;
        
        // Remove existing filter info
        const existingInfo = summaryContainer.querySelector('.filter-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        
        summaryContainer.appendChild(filterInfo);
    }
}

// Reset filters
function resetFilters() {
    const statusFilter = document.getElementById('status-filter');
    const typeFilter = document.getElementById('type-filter');
    
    if (statusFilter) statusFilter.value = 'all';
    if (typeFilter) typeFilter.value = 'all';
    
    // Remove filter info
    const filterInfo = document.querySelector('.filter-info');
    if (filterInfo) {
        filterInfo.remove();
    }
    
    // Show all results
    const resultContainer = document.getElementById('bulk-result');
    if (isTableView) {
        displayResultsAsTable(resultContainer, currentResults);
    } else {
        displayResultsAsCards(resultContainer, currentResults);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('WhatsApp Number Checker application loaded successfully');
    
    // Initialize connection status
    updateConnectionStatus('connecting');
    
    // Start status monitoring
    checkBackendStatus();
    statusCheckInterval = setInterval(checkBackendStatus, 5000); // Check every 5 seconds
    
    // Add keyboard support for Enter key
    document.getElementById('single-number')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkSingleNumber();
        }
    });
    
    document.getElementById('carrier-number')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkCarrier();
        }
    });
    
    // Add file upload handler for file management
    document.getElementById('manage-file')?.addEventListener('change', handleFileUpload);
    
    // Initialize mobile menu
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        sidebar?.classList.add('collapsed');
    }
    
    // Handle window resize
    window.addEventListener('resize', function() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (window.innerWidth <= 768) {
            sidebar?.classList.add('collapsed');
            mainContent?.classList.add('sidebar-collapsed');
        } else {
            sidebar?.classList.remove('show');
        }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', function() {
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }
    });
    
    // Add test button for localhost development (can be removed in production)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const testButton = document.createElement('button');
        testButton.innerHTML = '<i class="fas fa-vial"></i> Test Results';
        testButton.className = 'btn-secondary';
        testButton.style.cssText = 'position: fixed; top: 10px; left: 10px; z-index: 1000; font-size: 0.8rem; padding: 5px 10px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 5px;';
        testButton.onclick = createMockResults;
        testButton.title = 'For testing purposes only - not visible in production';
        document.body.appendChild(testButton);
    }
});

// Test function to demonstrate table view and export functionality (localhost only)
function createMockResults() {
    const mockResults = [
        {
            number: '+962791234567',
            hasWhatsApp: true,
            isBusiness: false,
            name: 'Ahmed Ali',
            country: 'Jordan',
            profilePicture: true
        },
        {
            number: '+966501234567',
            hasWhatsApp: true,
            isBusiness: true,
            name: 'Mohammed Hassan',
            country: 'Saudi Arabia',
            businessInfo: 'Tech Company',
            profilePicture: false
        },
        {
            number: '+1234567890',
            hasWhatsApp: false,
            country: 'USA'
        },
        {
            number: '+971501234567',
            hasWhatsApp: true,
            isBusiness: true,
            name: 'Fatima Al-Zahra',
            country: 'UAE',
            businessInfo: 'Restaurant Chain',
            profilePicture: true
        },
        {
            number: '+invalid123',
            error: 'الرقم يجب أن يبدأ برمز + متبوعاً برمز الدولة (مثال: +962791234567)'
        }
    ];
    
    // Store results for export and filtering
    storeResults(mockResults);
    
    // Calculate and display summary
    const stats = calculateStats(mockResults);
    displayResultsSummary(document.getElementById('bulk-summary'), stats, mockResults.length);
    
    // Display results as cards initially
    displayResultsAsCards(document.getElementById('bulk-result'), mockResults);
    
    console.log('Mock results created for testing');
}

// Display single WhatsApp result in DataTable
function displaySingleWhatsAppResult(data) {
    const tableContainer = document.getElementById('single-result-table');
    const tbody = document.getElementById('single-result-tbody');
    
    if (!tableContainer || !tbody) return;
    
    // Clear previous results
    tbody.innerHTML = '';
    
    if (data.error) {
        tbody.innerHTML = `
            <tr>
                <td>${data.number}</td>
                <td colspan="6" style="color: #dc3545; text-align: center;">
                    <i class="fas fa-exclamation-triangle"></i> ${data.error}
                </td>
            </tr>
        `;
    } else {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="number-cell">
                    <strong>${data.number}</strong>
                    ${data.formatted && data.formatted !== data.number ? `<br><small>${data.formatted}</small>` : ''}
                </div>
            </td>
            <td>
                <div class="country-cell">
                    ${getCountryFlag(data.country)}
                    ${getCountryName(data.country) || 'Unknown'}
                </div>
            </td>
            <td>
                <span class="status-badge ${data.hasWhatsApp ? 'whatsapp' : 'no-whatsapp'}">
                    ${data.hasWhatsApp ? 'Has WhatsApp' : 'No WhatsApp'}
                </span>
            </td>
            <td>
                ${data.hasWhatsApp ? 
                    `<span class="status-badge ${data.isBusiness ? 'business' : 'personal'}">
                        ${data.isBusiness ? 'Business' : 'Personal'}
                    </span>` : 
                    '<span class="text-muted">-</span>'
                }
            </td>
            <td>${data.name || '<span class="text-muted">-</span>'}</td>
            <td>
                ${data.hasWhatsApp && data.profilePicture ? 
                    `<img src="${data.profilePicture}" alt="Profile" style="width: 30px; height: 30px; border-radius: 50%; cursor: pointer;" onclick="showProfileShowcase(${JSON.stringify(data).replace(/"/g, '&quot;')}, '${data.profilePicture}')">` :
                    '<span class="text-muted">-</span>'
                }
            </td>
            <td>
                <div class="action-buttons">
                    ${data.hasWhatsApp ? `
                        <button class="btn btn-sm btn-primary" onclick="openWhatsApp('${data.number}')" title="Open in WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="copyToClipboard('${data.number}')" title="Copy Number">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    }
    
    // Show the table
    tableContainer.style.display = 'block';
    
    // Hide the old result container
    const oldContainer = document.getElementById('single-result');
    if (oldContainer) {
        oldContainer.style.display = 'none';
    }
}

// Display carrier result in DataTable
function displayCarrierResult(data) {
    const tableContainer = document.getElementById('carrier-result-table');
    const tbody = document.getElementById('carrier-result-tbody');
    
    if (!tableContainer || !tbody) return;
    
    // Clear previous results
    tbody.innerHTML = '';
    
    if (data.error) {
        tbody.innerHTML = `
            <tr>
                <td>${data.number}</td>
                <td colspan="6" style="color: #dc3545; text-align: center;">
                    <i class="fas fa-exclamation-triangle"></i> ${data.error}
                </td>
            </tr>
        `;
    } else {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="number-cell">
                    <strong>${data.number}</strong>
                    ${data.formatted && data.formatted !== data.number ? `<br><small>${data.formatted}</small>` : ''}
                </div>
            </td>
            <td>
                <div class="country-cell">
                    ${getCountryFlag(data.countryCode)}
                    ${data.country || 'Unknown'}
                </div>
            </td>
            <td>
                <strong>${data.carrier || 'Unknown'}</strong>
            </td>
            <td>
                <span class="badge badge-info">${data.numberType || 'Unknown'}</span>
            </td>
            <td>${data.region || 'Unknown'}</td>
            <td>${data.timeZone || 'Unknown'}</td>
            <td>
                <span class="status-badge ${data.isValid ? 'whatsapp' : 'no-whatsapp'}">
                    ${data.isValid ? 'Valid' : 'Invalid'}
                </span>
            </td>
        `;
        tbody.appendChild(row);
    }
    
    // Show the table
    tableContainer.style.display = 'block';
    
    // Hide the old result container
    const oldContainer = document.getElementById('carrier-result');
    if (oldContainer) {
        oldContainer.style.display = 'none';
    }
}

// File Management Functions
// Handle file upload for management
function handleFileUpload() {
    const fileInput = document.getElementById('manage-file');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentFileData = {
            name: file.name,
            content: e.target.result,
            lines: e.target.result.split('\n').filter(line => line.trim())
        };
        
        showFileTools();
        showFilePreview();
    };
    reader.readAsText(file);
}

function showFileTools() {
    const toolsContainer = document.getElementById('file-tools');
    if (toolsContainer) {
        toolsContainer.style.display = 'block';
    }
}

function showFilePreview() {
    const previewContainer = document.getElementById('file-preview');
    const previewContent = document.getElementById('file-content-preview');
    
    if (previewContainer && previewContent && currentFileData) {
        const preview = currentFileData.lines.slice(0, 10).join('\n');
        previewContent.textContent = preview;
        previewContainer.style.display = 'block';
    }
}

function addPrefixToFile() {
    if (!currentFileData) return;
    
    const newLines = currentFileData.lines.map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('+')) {
            return '+' + trimmed;
        }
        return trimmed;
    });
    
    processedFiles.push({
        name: `${currentFileData.name.replace(/\.[^/.]+$/, '')}_with_prefix.txt`,
        content: newLines.join('\n')
    });
    
    showMessage('+ prefix added to all numbers', 'success');
}

function removePrefixFromFile() {
    if (!currentFileData) return;
    
    const newLines = currentFileData.lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('+')) {
            return trimmed.substring(1);
        }
        return trimmed;
    });
    
    processedFiles.push({
        name: `${currentFileData.name.replace(/\.[^/.]+$/, '')}_without_prefix.txt`,
        content: newLines.join('\n')
    });
    
    showMessage('+ prefix removed from all numbers', 'success');
}

function splitFile() {
    if (!currentFileData) return;
    
    const splitSize = parseInt(document.getElementById('split-size').value) || 1000;
    const prefix = document.getElementById('split-prefix').value || 'numbers_part';
    
    const lines = currentFileData.lines;
    const totalParts = Math.ceil(lines.length / splitSize);
    
    for (let i = 0; i < totalParts; i++) {
        const start = i * splitSize;
        const end = Math.min(start + splitSize, lines.length);
        const partLines = lines.slice(start, end);
        
        processedFiles.push({
            name: `${prefix}_${i + 1}_of_${totalParts}.txt`,
            content: partLines.join('\n')
        });
    }
    
    showMessage(`File split into ${totalParts} parts`, 'success');
}

function downloadProcessedFiles() {
    processedFiles.forEach(file => {
        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    showMessage(`Downloaded ${processedFiles.length} files`, 'success');
}

async function downloadAsZip() {
    if (typeof JSZip === 'undefined') {
        showMessage('ZIP functionality not available', 'error');
        return;
    }
    
    const zip = new JSZip();
    
    processedFiles.forEach(file => {
        zip.file(file.name, file.content);
    });
    
    try {
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'processed_numbers.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('ZIP file downloaded successfully', 'success');
    } catch (error) {
        showMessage('Error creating ZIP file', 'error');
    }
}

// Utility functions for DataTable actions
function openWhatsApp(number) {
    const cleanNumber = number.replace(/[^\d]/g, '');
    window.open(`https://wa.me/${cleanNumber}`, '_blank');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showMessage('Number copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showMessage('Number copied to clipboard!', 'success');
    });
}

function showMessage(message, type = 'info') {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
        border-radius: 8px;
        z-index: 9999;
        transition: all 0.3s ease;
        font-weight: 500;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}