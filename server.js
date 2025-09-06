const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Global variables
let client = null;
let clientStatus = 'disconnected';
let qrCode = null;

// Initialize WhatsApp client
async function initializeClient() {
    try {
        console.log('تهيئة عميل الواتساب...');
        clientStatus = 'initializing';
        
        client = await wppconnect.create({
            session: 'whatsapp-filter',
            puppeteerOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-features=VizDisplayCompositor'
                ]
            },
            catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
                console.log('رمز QR جديد - المحاولة:', attempts);
                qrCode = base64Qrimg;
                clientStatus = 'qr_ready';
            },
            statusFind: (statusSession, session) => {
                console.log('حالة الجلسة:', statusSession, session);
                if (statusSession === 'isLogged') {
                    clientStatus = 'connected';
                    qrCode = null;
                    console.log('تم تسجيل الدخول بنجاح!');
                } else if (statusSession === 'notLogged') {
                    clientStatus = 'qr_ready';
                    console.log('يتطلب مسح رمز QR');
                } else if (statusSession === 'autocloseCalled') {
                    clientStatus = 'qr_ready';
                    console.log('تم إغلاق الجلسة تلقائياً، يتطلب إعادة تشغيل');
                } else if (statusSession === 'browserClose') {
                    clientStatus = 'disconnected';
                    console.log('تم إغلاق المتصفح');
                }
            },
            logQR: false,
            autoClose: 0, // Disable auto close
            disableGoogleAnalytics: true,
            updatesLog: false
        });
        
        console.log('تم إنشاء عميل الواتساب بنجاح');
        
    } catch (error) {
        console.error('خطأ في تهيئة عميل الواتساب:', error);
        clientStatus = 'error';
    }
}

// Check if a number has WhatsApp
async function checkWhatsAppNumber(number) {
    if (!client || clientStatus !== 'connected') {
        throw new Error('عميل الواتساب غير متصل');
    }
    
    try {
        console.log('🔍 Debug - Starting WhatsApp check for number:', number);
        
        // Clean the number - more robust approach
        let cleanNumber = number.replace(/[^\d+]/g, '');
        
        // Ensure the number starts with + for international format
        if (!cleanNumber.startsWith('+')) {
            cleanNumber = '+' + cleanNumber;
        }
        
        // Format for WhatsApp: remove + and add @c.us
        const formattedNumber = cleanNumber.replace(/^\+/, '') + '@c.us';
        
        console.log('🔍 Debug - Original number:', number);
        console.log('🔍 Debug - Clean number:', cleanNumber);
        console.log('🔍 Debug - Formatted number for WhatsApp:', formattedNumber);

        // Check if number exists on WhatsApp
        const result = await client.checkNumberStatus(formattedNumber);
        console.log('🔍 Debug - checkNumberStatus response for', formattedNumber, ':', JSON.stringify(result, null, 2));
        
        // Handle different possible response structures from different wppconnect versions
        let hasWhatsApp = false;
        
        if (result && typeof result === 'object') {
            // Check various possible properties that indicate WhatsApp existence
            hasWhatsApp = !!(
                result.numberExists ||           // Standard property
                result.exists ||                 // Alternative property name  
                (result.canReceiveMessage && result.status !== 404 && result.status !== 500) || // Can receive messages
                (result.status === 200)          // HTTP-like status indicating success
            );
        }
        
        // If the primary check suggests no WhatsApp, try alternative verification
        if (!hasWhatsApp) {
            console.log('🔍 Primary check failed, trying alternative verification...');
            try {
                // Try to get contact info as an alternative check
                const contactInfo = await client.getContact(formattedNumber);
                if (contactInfo && contactInfo.id && contactInfo.id._serialized) {
                    console.log('✅ Alternative check: Contact info found, number likely has WhatsApp');
                    hasWhatsApp = true;
                }
            } catch (altError) {
                console.log('❌ Alternative check also failed:', altError.message);
            }
        }
        
        if (!hasWhatsApp) {
            console.log('❌ Number reported as NOT existing on WhatsApp');
            console.log('  - numberExists:', result?.numberExists);
            console.log('  - exists:', result?.exists);
            console.log('  - canReceiveMessage:', result?.canReceiveMessage);
            console.log('  - status:', result?.status);
            return {
                hasWhatsApp: false,
                number: cleanNumber,
                status: 'لا يوجد واتساب'
            };
        }
        
        console.log('✅ Number exists on WhatsApp, proceeding with additional checks...');
        
        // Try to get contact info
        let contactInfo = null;
        try {
            contactInfo = await client.getContact(formattedNumber);
        } catch (e) {
            console.warn('لا يمكن الحصول على معلومات الاتصال:', e.message);
        }
        
        // Try to get profile picture
        let profilePicture = null;
        try {
            profilePicture = await client.getProfilePicFromServer(formattedNumber);
        } catch (e) {
            console.warn('لا يمكن الحصول على صورة الملف الشخصي:', e.message);
        }
        
        // Try to get business profile
        let isBusiness = false;
        let businessInfo = null;
        try {
            const businessProfile = await client.getBusinessProfilesProducts(formattedNumber);
            isBusiness = businessProfile && businessProfile.length > 0;
            
            if (isBusiness) {
                // Try to get more business details
                try {
                    const businessDetails = await client.getContact(formattedNumber);
                    businessInfo = {
                        description: businessDetails?.businessProfile?.description || null,
                        category: businessDetails?.businessProfile?.category || null,
                        website: businessDetails?.businessProfile?.website || null,
                        email: businessDetails?.businessProfile?.email || null,
                        address: businessDetails?.businessProfile?.address || null,
                        products: businessProfile || []
                    };
                } catch (businessError) {
                    console.warn('لا يمكن الحصول على تفاصيل الحساب التجاري:', businessError.message);
                }
            }
        } catch (e) {
            // Not a business account or can't access business info
        }
        
        return {
            hasWhatsApp: true,
            number: cleanNumber,
            profilePicture: profilePicture,
            isBusiness: isBusiness,
            businessInfo: businessInfo,
            name: contactInfo?.name || contactInfo?.pushname || null,
            status: contactInfo?.status || null,
            lastSeen: 'غير متاح', // WhatsApp doesn't allow reading last seen for privacy
            isContact: contactInfo?.isMyContact || false
        };
        
    } catch (error) {
        console.error('خطأ في فحص رقم الواتساب:', error);
        throw new Error('فشل في فحص الرقم: ' + error.message);
    }
}

// API Routes

// Get client status
app.get('/api/status', (req, res) => {
    res.json({
        status: clientStatus,
        qrCode: qrCode,
        connected: clientStatus === 'connected'
    });
});

// Get QR code for authentication
app.get('/api/qr', (req, res) => {
    if (qrCode && clientStatus === 'qr_ready') {
        res.json({
            qrCode: qrCode,
            status: 'ready'
        });
    } else {
        res.json({
            qrCode: null,
            status: clientStatus
        });
    }
});

// Check single WhatsApp number
app.post('/api/check-whatsapp', async (req, res) => {
    try {
        const { number } = req.body;
        
        if (!number) {
            return res.status(400).json({
                success: false,
                error: 'رقم الهاتف مطلوب'
            });
        }
        
        if (clientStatus !== 'connected') {
            return res.status(503).json({
                success: false,
                error: 'عميل الواتساب غير متصل',
                status: clientStatus
            });
        }
        
        const result = await checkWhatsAppNumber(number);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('خطأ في فحص الواتساب:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check multiple WhatsApp numbers
app.post('/api/check-whatsapp-bulk', async (req, res) => {
    try {
        const { numbers } = req.body;
        
        if (!numbers || !Array.isArray(numbers)) {
            return res.status(400).json({
                success: false,
                error: 'قائمة الأرقام مطلوبة'
            });
        }
        
        if (clientStatus !== 'connected') {
            return res.status(503).json({
                success: false,
                error: 'عميل الواتساب غير متصل',
                status: clientStatus
            });
        }
        
        const results = [];
        
        for (let i = 0; i < numbers.length; i++) {
            const number = numbers[i];
            
            try {
                const result = await checkWhatsAppNumber(number);
                results.push(result);
                
                // Add delay between requests to avoid rate limiting
                if (i < numbers.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                results.push({
                    hasWhatsApp: false,
                    number: number,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        console.error('خطأ في فحص الأرقام المتعددة:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Restart WhatsApp client
app.post('/api/restart', async (req, res) => {
    try {
        if (client) {
            await client.close();
        }
        
        clientStatus = 'disconnected';
        qrCode = null;
        client = null;
        
        // Reinitialize after a short delay
        setTimeout(initializeClient, 2000);
        
        res.json({
            success: true,
            message: 'تم إعادة تشغيل عميل الواتساب'
        });
        
    } catch (error) {
        console.error('خطأ في إعادة التشغيل:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('خطأ في الخادم:', error);
    res.status(500).json({
        success: false,
        error: 'خطأ داخلي في الخادم'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
    console.log(`📱 افتح المتصفح على: http://localhost:${PORT}`);
    
    // Initialize WhatsApp client
    initializeClient();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('إيقاف الخادم...');
    
    if (client) {
        try {
            await client.close();
        } catch (error) {
            console.error('خطأ في إغلاق عميل الواتساب:', error);
        }
    }
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('إيقاف الخادم...');
    
    if (client) {
        try {
            await client.close();
        } catch (error) {
            console.error('خطأ في إغلاق عميل الواتساب:', error);
        }
    }
    
    process.exit(0);
});