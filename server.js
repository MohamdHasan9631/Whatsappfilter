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

// Debug mode toggle - set to false for production
const DEBUG_MODE = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

// Initialize WhatsApp client
async function initializeClient() {
    try {
        console.log('🚀 Initializing WhatsApp client...');
        clientStatus = 'initializing';
        
        // Enhanced puppeteer configuration
        const puppeteerOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--disable-features=VizDisplayCompositor',
                '--disable-web-security',
                '--disable-extensions'
            ]
        };

        // Add executable path if specified in environment
        if (process.env.CHROME_EXECUTABLE_PATH) {
            puppeteerOptions.executablePath = process.env.CHROME_EXECUTABLE_PATH;
        }

        client = await wppconnect.create({
            session: 'whatsapp-filter',
            puppeteerOptions,
            catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
                console.log('📱 New QR Code generated - Attempt:', attempts);
                qrCode = base64Qrimg;
                clientStatus = 'qr_ready';
            },
            statusFind: (statusSession, session) => {
                console.log('📊 Session status:', statusSession, 'Session:', session);
                if (statusSession === 'isLogged') {
                    clientStatus = 'connected';
                    qrCode = null;
                    console.log('✅ Successfully logged in!');
                    
                    // Get account information for display
                    getConnectedAccountInfo();
                } else if (statusSession === 'notLogged') {
                    clientStatus = 'qr_ready';
                    console.log('📱 QR Code scan required');
                } else if (statusSession === 'autocloseCalled') {
                    clientStatus = 'qr_ready';
                    console.log('🔄 Session auto-closed, restart required');
                } else if (statusSession === 'browserClose') {
                    clientStatus = 'disconnected';
                    console.log('❌ Browser closed');
                }
            },
            logQR: false,
            autoClose: 0, // Disable auto close
            disableGoogleAnalytics: true,
            updatesLog: false
        });
        
        console.log('✅ WhatsApp client created successfully');
        
    } catch (error) {
        console.error('❌ Error initializing WhatsApp client:', error);
        clientStatus = 'error';
        
        // Enhanced error handling with specific error types
        if (error.message && error.message.includes('chrome')) {
            console.error('Chrome/Chromium related error. Try setting CHROME_EXECUTABLE_PATH environment variable.');
        } else if (error.message && error.message.includes('timeout')) {
            console.error('Timeout error during initialization. Check internet connection.');
        } else if (error.message && error.message.includes('ECONNREFUSED')) {
            console.error('Connection refused. Check if all required ports are available.');
        }
        
        // Attempt to retry after delay for recoverable errors
        if (!error.message || !error.message.includes('EACCES')) {
            console.log('Will retry initialization in 30 seconds...');
            setTimeout(() => {
                if (clientStatus === 'error') {
                    console.log('Retrying WhatsApp client initialization...');
                    initializeClient();
                }
            }, 30000);
        }
    }
}

// Get connected account information
async function getConnectedAccountInfo() {
    try {
        if (!client) return null;
        
        const hostDevice = await client.getHostDevice();
        const me = await client.getMe();
        
        const accountInfo = {
            name: me?.pushname || me?.name || 'Unknown',
            number: me?.id?.user || hostDevice?.id?.user || 'Unknown',
            device: hostDevice?.device || 'Unknown',
            platform: hostDevice?.platform || 'Unknown',
            connected: true
        };
        
        console.log('📱 Connected account info:', accountInfo);
        return accountInfo;
    } catch (error) {
        console.warn('⚠️ Could not get account info:', error.message);
        return null;
    }
}

// Check if a number has WhatsApp
async function checkWhatsAppNumber(number) {
    if (!client || clientStatus !== 'connected') {
        throw new Error('WhatsApp client is not connected');
    }
    
    try {
        if (DEBUG_MODE) console.log('🔍 Debug - Starting WhatsApp check for number:', number);
        
        // Clean the number - more robust approach
        let cleanNumber = number.replace(/[^\d+]/g, '');
        
        // Ensure the number starts with + for international format
        if (!cleanNumber.startsWith('+')) {
            cleanNumber = '+' + cleanNumber;
        }
        
        // Format for WhatsApp: remove + and add @c.us
        const formattedNumber = cleanNumber.replace(/^\+/, '') + '@c.us';
        
        if (DEBUG_MODE) {
            console.log('🔍 Debug - Original number:', number);
            console.log('🔍 Debug - Clean number:', cleanNumber);
            console.log('🔍 Debug - Formatted number for WhatsApp:', formattedNumber);
        }

        // Check if number exists on WhatsApp
        const result = await client.checkNumberStatus(formattedNumber);
        if (DEBUG_MODE) {
            console.log('🔍 Debug - checkNumberStatus response for', formattedNumber, ':', JSON.stringify(result, null, 2));
        }
        
        // Handle different possible response structures from different wppconnect versions
        let hasWhatsApp = false;
        
        if (result && typeof result === 'object') {
            // Check various possible properties that indicate WhatsApp existence
            hasWhatsApp = !!(
                result.numberExists ||           // Standard property
                result.exists ||                 // Alternative property name  
                (result.canReceiveMessage && result.status !== 404 && result.status !== 500) || // Can receive messages
                (result.status === 200) ||       // HTTP-like status indicating success
                (result.id && result.id._serialized && result.status !== 404) // Has valid ID and not 404
            );
        }
        
        // If the primary check suggests no WhatsApp, try alternative verification
        if (!hasWhatsApp) {
            if (DEBUG_MODE) console.log('🔍 Primary check failed, trying alternative verification...');
            try {
                // Small delay before alternative check
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Try to get contact info as an alternative check
                const contactInfo = await client.getContact(formattedNumber);
                if (contactInfo && contactInfo.id && contactInfo.id._serialized) {
                    if (DEBUG_MODE) console.log('✅ Alternative check: Contact info found, number likely has WhatsApp');
                    hasWhatsApp = true;
                }
            } catch (altError) {
                if (DEBUG_MODE) console.log('❌ Alternative check also failed:', altError.message);
            }
        }
        
        if (!hasWhatsApp) {
            if (DEBUG_MODE) {
                console.log('❌ Number reported as NOT existing on WhatsApp');
                console.log('  - numberExists:', result?.numberExists);
                console.log('  - exists:', result?.exists);
                console.log('  - canReceiveMessage:', result?.canReceiveMessage);
                console.log('  - status:', result?.status);
            }
            return {
                hasWhatsApp: false,
                number: cleanNumber,
                status: 'لا يوجد واتساب'
            };
        }
        
        if (DEBUG_MODE) console.log('✅ Number exists on WhatsApp, proceeding with additional checks...');
        
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
        
        // Try to get business profile with enhanced detection
        let isBusiness = false;
        let businessInfo = null;
        try {
            // Method 1: Try to get business profile products
            const businessProfile = await client.getBusinessProfilesProducts(formattedNumber);
            if (businessProfile && businessProfile.length > 0) {
                isBusiness = true;
                if (DEBUG_MODE) console.log('✅ Business account detected via products:', businessProfile.length, 'products');
            }
            
            // Method 2: Check contact details for business indicators
            if (!isBusiness && contactInfo) {
                // Check if contact has business-specific fields
                const hasBusinessProfile = contactInfo.businessProfile || 
                                         contactInfo.isBusiness || 
                                         contactInfo.verifiedName ||
                                         contactInfo.isEnterprise;
                
                if (hasBusinessProfile) {
                    isBusiness = true;
                    if (DEBUG_MODE) console.log('✅ Business account detected via contact info');
                }
            }
            
            // Method 3: Try alternative business detection
            if (!isBusiness) {
                try {
                    const fullContact = await client.getContact(formattedNumber);
                    if (fullContact?.isBusiness || fullContact?.businessProfile || fullContact?.verifiedName) {
                        isBusiness = true;
                        if (DEBUG_MODE) console.log('✅ Business account detected via full contact check');
                    }
                } catch (altError) {
                    if (DEBUG_MODE) console.log('⚠️ Alternative business check failed:', altError.message);
                }
            }
            
            // If business account detected, try to get detailed business info
            if (isBusiness) {
                try {
                    const businessDetails = await client.getContact(formattedNumber);
                    businessInfo = {
                        description: businessDetails?.businessProfile?.description || null,
                        category: businessDetails?.businessProfile?.category || null,
                        website: businessDetails?.businessProfile?.website || null,
                        email: businessDetails?.businessProfile?.email || null,
                        address: businessDetails?.businessProfile?.address || null,
                        verifiedName: businessDetails?.verifiedName || null,
                        products: businessProfile || []
                    };
                    
                    if (DEBUG_MODE) {
                        console.log('📋 Business info collected:', {
                            hasDescription: !!businessInfo.description,
                            hasCategory: !!businessInfo.category,
                            hasWebsite: !!businessInfo.website,
                            hasEmail: !!businessInfo.email,
                            hasAddress: !!businessInfo.address,
                            hasVerifiedName: !!businessInfo.verifiedName,
                            productCount: businessInfo.products.length
                        });
                    }
                } catch (businessError) {
                    console.warn('Cannot get business account details:', businessError.message);
                }
            }
            
        } catch (e) {
            if (DEBUG_MODE) console.log('⚠️ Business profile check failed:', e.message);
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
        console.error('❌ Error checking WhatsApp number:', error);
        throw new Error('Failed to check number: ' + error.message);
    }
}

// API Routes

// Get client status
app.get('/api/status', async (req, res) => {
    let accountInfo = null;
    
    // If connected, try to get account information
    if (clientStatus === 'connected') {
        accountInfo = await getConnectedAccountInfo();
    }
    
    res.json({
        status: clientStatus,
        qrCode: qrCode,
        connected: clientStatus === 'connected',
        accountInfo: accountInfo
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
                error: 'Phone number is required'
            });
        }
        
        if (clientStatus !== 'connected') {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client is not connected',
                status: clientStatus
            });
        }
        
        const result = await checkWhatsAppNumber(number);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('❌ Error checking WhatsApp:', error);
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
                error: 'WhatsApp client is not connected',
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
        console.error('❌ Error checking bulk numbers:', error);
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
            message: 'WhatsApp client restarted successfully'
        });
        
    } catch (error) {
        console.error('❌ Error during restart:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Disconnect WhatsApp client
app.post('/api/disconnect', async (req, res) => {
    try {
        if (client) {
            console.log('🔌 Disconnecting WhatsApp client...');
            await client.close();
            client = null;
        }
        
        clientStatus = 'disconnected';
        qrCode = null;
        
        console.log('✅ WhatsApp client disconnected successfully');
        
        res.json({
            success: true,
            message: 'WhatsApp client disconnected successfully',
            status: clientStatus
        });
    } catch (error) {
        console.error('❌ Error during disconnect:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Image proxy route to handle CORS issues with WhatsApp profile pictures
app.get('/api/image-proxy', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        
        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                error: 'Image URL is required'
            });
        }
        
        // Validate that it's a data URL (base64) which should be safe
        if (imageUrl.startsWith('data:image/')) {
            // For data URLs, just return them as-is since they don't have CORS issues
            return res.json({
                success: true,
                imageUrl: imageUrl
            });
        }
        
        // For external URLs, we could implement actual proxying, but for security reasons
        // we'll just return the original URL and let the frontend handle it
        // In a production environment, you might want to implement proper image proxying
        res.json({
            success: true,
            imageUrl: imageUrl
        });
        
    } catch (error) {
        console.error('❌ Error in image proxy:', error);
        res.status(500).json({
            success: false,
            error: 'Error loading image'
        });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Open browser at: http://localhost:${PORT}`);
    
    // Initialize WhatsApp client
    initializeClient();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down server...');
    
    if (client) {
        try {
            await client.close();
        } catch (error) {
            console.error('❌ Error closing WhatsApp client:', error);
        }
    }
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down server...');
    
    if (client) {
        try {
            await client.close();
        } catch (error) {
            console.error('❌ Error closing WhatsApp client:', error);
        }
    }
    
    process.exit(0);
});