const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for rate limiting and OTP
const otpAttempts = new Map();
const otpStore = new Map();

// Sample data
const users = [
  {
    mobile: "9876543210",
    name: "राम शर्मा",
    children: [
      { name: "अर्जुन शर्मा", class: "5वीं", rollNo: "101", age: 10 },
      { name: "सीता शर्मा", class: "3री", rollNo: "205", age: 8 }
    ]
  },
  {
    mobile: "9123456789",
    name: "सुनीता देवी",
    children: [
      { name: "कृष्ण कुमार", class: "7वीं", rollNo: "301", age: 12 }
    ]
  }
];

// Root endpoint
app.get('/', (req, res) => {
  const twilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && 
                             process.env.TWILIO_AUTH_TOKEN && 
                             process.env.TWILIO_PHONE_NUMBER);
  
  res.json({
    message: "DS School Backend API is running!",
    status: "active",
    timestamp: new Date().toISOString(),
    twilioConfigured: twilioConfigured,
    endpoints: [
      "POST /api/send-otp",
      "POST /api/verify-otp", 
      "GET /api/children/:mobile",
      "POST /api/add-child"
    ]
  });
});

// Send OTP endpoint with rate limiting
app.post('/api/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'कृपया 10 अंकों का मोबाइल नंबर दें'
      });
    }

    // RATE LIMITING CHECK
    const now = Date.now();
    const attemptKey = mobile;
    const lastAttempt = otpAttempts.get(attemptKey);

    // Check if last OTP was sent within 2 minutes (120 seconds)
    if (lastAttempt && (now - lastAttempt) < 120000) {
      const waitTime = Math.ceil((120000 - (now - lastAttempt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `कृपया ${waitTime} सेकंड बाद दोबारा कोशिश करें`,
        waitTime: waitTime
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if Twilio is configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      // Demo mode
      return res.status(200).json({
        success: true,
        message: 'OTP भेजा गया (Demo Mode)',
        demo: true,
        otp: otp
      });
    }

    // Send real SMS via Twilio
    const client = twilio(accountSid, authToken);
    
    const message = await client.messages.create({
      body: `DS School का OTP: ${otp}\nयह OTP 5 मिनट में expire हो जाएगा।`,
      from: twilioPhone,
      to: `+91${mobile}`
    });

    // Store attempt timestamp for rate limiting
    otpAttempts.set(attemptKey, now);

    // Store OTP for verification
    otpStore.set(mobile, {
      otp: otp,
      timestamp: now,
      expires: now + 300000 // 5 minutes
    });

    // Clean up old attempts (keep only last 100)
    if (otpAttempts.size > 100) {
      const oldestKey = otpAttempts.keys().next().value;
      otpAttempts.delete(oldestKey);
    }

    return res.status(200).json({
      success: true,
      message: 'OTP सफलतापूर्वक भेजा गया',
      messageSid: message.sid
    });

  } catch (error) {
    console.error('OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'OTP भेजने में समस्या हुई',
      error: error.message
    });
  }
});

// Verify OTP endpoint
app.post('/api/verify-otp', (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: 'मोबाइल नंबर और OTP दोनों आवश्यक हैं'
      });
    }

    // Check stored OTP
    const storedData = otpStore.get(mobile);
    
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'OTP नहीं मिला। कृपया नया OTP भेजें।'
      });
    }

    // Check if OTP expired
    if (Date.now() > storedData.expires) {
      otpStore.delete(mobile);
      return res.status(400).json({
        success: false,
        message: 'OTP expire हो गया। कृपया नया OTP भेजें।'
      });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'गलत OTP। कृपया सही OTP डालें।'
      });
    }

    // OTP verified successfully
    otpStore.delete(mobile);
    
    // Find user data
    const user = users.find(u => u.mobile === mobile);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'उपयोगकर्ता नहीं मिला'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP सफलतापूर्वक verify हुआ',
      user: user
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'OTP verify करने में समस्या हुई'
    });
  }
});

// Get children by mobile
app.get('/api/children/:mobile', (req, res) => {
  const { mobile } = req.params;
  const user = users.find(u => u.mobile === mobile);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'उपयोगकर्ता नहीं मिला'
    });
  }

  res.json({
    success: true,
    parent: user.name,
    children: user.children
  });
});

// Add child endpoint
app.post('/api/add-child', (req, res) => {
  const { mobile, child } = req.body;
  
  if (!mobile || !child) {
    return res.status(400).json({
      success: false,
      message: 'मोबाइल नंबर और बच्चे की जानकारी आवश्यक है'
    });
  }

  const user = users.find(u => u.mobile === mobile);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'उपयोगकर्ता नहीं मिला'
    });
  }

  user.children.push(child);
  
  res.json({
    success: true,
    message: 'बच्चा सफलतापूर्वक जोड़ा गया',
    children: user.children
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`DS School API running on port ${PORT}`);
});

module.exports = app;
