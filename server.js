const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (in production, use database)
const otpAttempts = new Map();
const otpStore = new Map();
const users = new Map(); // Will store all registered users

// Initialize with sample data
users.set("9876543210", {
  mobile: "9876543210",
  name: "राम शर्मा",
  email: "ram@example.com",
  address: "दिल्ली",
  registeredAt: new Date().toISOString(),
  children: [
    { id: 1, name: "अर्जुन शर्मा", class: "5वीं", rollNo: "101", age: 10 },
    { id: 2, name: "सीता शर्मा", class: "3री", rollNo: "205", age: 8 }
  ]
});

users.set("9123456789", {
  mobile: "9123456789",
  name: "सुनीता देवी",
  email: "sunita@example.com",
  address: "मुंबई",
  registeredAt: new Date().toISOString(),
  children: [
    { id: 3, name: "कृष्ण कुमार", class: "7वीं", rollNo: "301", age: 12 }
  ]
});

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
    totalUsers: users.size,
    endpoints: [
      "POST /api/signup",
      "POST /api/send-otp",
      "POST /api/verify-otp", 
      "GET /api/children/:mobile",
      "POST /api/add-child",
      "GET /api/user/:mobile"
    ]
  });
});

// Signup endpoint
app.post('/api/signup', (req, res) => {
  try {
    const { mobile, name, email, address } = req.body;

    // Validation
    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'कृपया 10 अंकों का मोबाइल नंबर दें'
      });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'कृपया अपना नाम दर्ज करें'
      });
    }

    // Check if user already exists
    if (users.has(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'यह मोबाइल नंबर पहले से registered है'
      });
    }

    // Create new user
    const newUser = {
      mobile,
      name: name.trim(),
      email: email?.trim() || '',
      address: address?.trim() || '',
      registeredAt: new Date().toISOString(),
      children: []
    };

    users.set(mobile, newUser);

    return res.status(201).json({
      success: true,
      message: 'सफलतापूर्वक registration हो गई',
      user: newUser
    });

  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration में समस्या हुई'
    });
  }
});

// Check if user exists
app.get('/api/user/:mobile', (req, res) => {
  const { mobile } = req.params;
  
  if (users.has(mobile)) {
    const user = users.get(mobile);
    return res.json({
      success: true,
      exists: true,
      user: user
    });
  } else {
    return res.json({
      success: true,
      exists: false,
      message: 'User not found'
    });
  }
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

    // Check if user is registered
    if (!users.has(mobile)) {
      return res.status(404).json({
        success: false,
        message: 'यह मोबाइल नंबर registered नहीं है। कृपया पहले signup करें।'
      });
    }

    // RATE LIMITING CHECK
    const now = Date.now();
    const attemptKey = mobile;
    const lastAttempt = otpAttempts.get(attemptKey);

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

    // Check if user exists
    if (!users.has(mobile)) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
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
    
    const user = users.get(mobile);

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
  
  if (!users.has(mobile)) {
    return res.status(404).json({
      success: false,
      message: 'उपयोगकर्ता नहीं मिला'
    });
  }

  const user = users.get(mobile);

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

  if (!users.has(mobile)) {
    return res.status(404).json({
      success: false,
      message: 'उपयोगकर्ता नहीं मिला'
    });
  }

  const user = users.get(mobile);
  
  // Add unique ID to child
  const newChild = {
    ...child,
    id: Date.now() // Simple ID generation
  };
  
  user.children.push(newChild);
  users.set(mobile, user); // Update user data

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
