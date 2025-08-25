const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const otpStorage = new Map();
const userStorage = new Map();

const twilio = require('twilio');
let client;

try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio initialized successfully');
  } else {
    console.log('Twilio credentials not found - running in demo mode');
  }
} catch (error) {
  console.log('Twilio initialization failed:', error.message);
}

const demoUsers = {
  '9876543210': {
    name: 'राजेश कुमार',
    mobile: '9876543210',
    children: [
      {
        dsid: 'DSID240156',
        name: 'आर्यन कुमार',
        class: '7',
        rollNumber: '156',
        admissionId: 'ADM2024156',
        dob: '2010-05-15',
        gender: 'male',
        bloodGroup: 'B+',
        address: 'गांधी नगर, इंदौर',
        fatherName: 'राजेश कुमार',
        motherName: 'सुनीता कुमार',
        status: 'active',
        lastAttendance: '2024-01-15',
        feeStatus: 'paid'
      },
      {
        dsid: 'DSID240157',
        name: 'प्रिया कुमार',
        class: '6',
        rollNumber: '157',
        admissionId: 'ADM2024157',
        dob: '2011-08-22',
        gender: 'female',
        bloodGroup: 'A+',
        address: 'गांधी नगर, इंदौर',
        fatherName: 'राजेश कुमार',
        motherName: 'सुनीता कुमार',
        status: 'active',
        lastAttendance: '2024-01-15',
        feeStatus: 'pending'
      }
    ]
  },
  '9999999999': {
    name: 'सुरेश शर्मा',
    mobile: '9999999999',
    children: [
      {
        dsid: 'DSID240158',
        name: 'अनिल शर्मा',
        class: '8',
        rollNumber: '158',
        admissionId: 'ADM2024158',
        dob: '2009-12-10',
        gender: 'male',
        bloodGroup: 'O+',
        address: 'विजय नगर, इंदौर',
        fatherName: 'सुरेश शर्मा',
        motherName: 'गीता शर्मा',
        status: 'active',
        lastAttendance: '2024-01-15',
        feeStatus: 'paid'
      }
    ]
  }
};

app.get('/', (req, res) => {
  res.json({ 
    message: 'DS School Backend API is running!',
    status: 'active',
    timestamp: new Date().toISOString(),
    twilioConfigured: !!client,
    endpoints: [
      'POST /api/send-otp',
      'POST /api/verify-otp',
      'GET /api/children/:mobile',
      'POST /api/add-child'
    ]
  });
});

app.post('/api/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    
    console.log('OTP request for mobile:', mobile);
    
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'कृपया 10 अंकों का सही मोबाइल नंबर दर्ज करें'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    otpStorage.set(mobile, {
      otp: otp,
      expires: Date.now() + 5 * 60 * 1000,
      attempts: 0
    });

    if (!client || !process.env.TWILIO_PHONE_NUMBER) {
      console.log('Demo Mode - OTP:', otp);
      return res.json({
        success: true,
        message: 'OTP भेजा गया (Demo Mode)',
        demo: true,
        otp: otp
      });
    }

    try {
      const message = await client.messages.create({
        body: `आपका DS School OTP है: ${otp}\n\nयह 5 मिनट में समाप्त हो जाएगा।\n\n- DS Middle School`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${mobile}`
      });

      console.log(`OTP sent to ${mobile}, MessageSID: ${message.sid}`);

      res.json({
        success: true,
        message: 'OTP सफलतापूर्वक भेजा गया',
        messageSid: message.sid
      });

    } catch (twilioError) {
      console.error('Twilio error:', twilioError.message);
      
      res.json({
        success: true,
        message: 'OTP भेजा गया (Demo Mode - Twilio Error)',
        demo: true,
        otp: otp,
        error: twilioError.message
      });
    }

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'OTP भेजने में त्रुटि',
      error: error.message
    });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    
    console.log('OTP verification for mobile:', mobile);
    
    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: 'मोबाइल नंबर और OTP दोनों आवश्यक हैं'
      });
    }

    const storedOTP = otpStorage.get(mobile);
    
    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: 'OTP नहीं मिला या समय समाप्त'
      });
    }

    if (Date.now() > storedOTP.expires) {
      otpStorage.delete(mobile);
      return res.status(400).json({
        success: false,
        message: 'OTP का समय समाप्त हो गया'
      });
    }

    if (storedOTP.attempts >= 3) {
      otpStorage.delete(mobile);
      return res.status(400).json({
        success: false,
        message: 'बहुत अधिक प्रयास'
      });
    }

    if (storedOTP.otp !== otp) {
      storedOTP.attempts++;
      return res.status(400).json({
        success: false,
        message: 'गलत OTP'
      });
    }

    otpStorage.delete(mobile);

    const user = demoUsers[mobile];
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'यह मोबाइल नंबर रजिस्टर नहीं है'
      });
    }

    const sessionToken = `token_${mobile}_${Date.now()}`;
    userStorage.set(sessionToken, user);

    console.log('Login successful for:', user.name);

    res.json({
      success: true,
      message: 'सफल लॉगिन',
      user: user,
      token: sessionToken
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'OTP सत्यापन में त्रुटि',
      error: error.message
    });
  }
});

app.get('/api/children/:mobile', (req, res) => {
  try {
    const { mobile } = req.params;
    
    console.log('Fetching children for mobile:', mobile);
    
    const user = demoUsers[mobile];
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'उपयोगकर्ता नहीं मिला'
      });
    }

    res.json({
      success: true,
      children: user.children,
      parent: {
        name: user.name,
        mobile: user.mobile
      }
    });

  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({
      success: false,
      message: 'बच्चों की जानकारी लाने में त्रुटि',
      error: error.message
    });
  }
});

app.post('/api/add-child', (req, res) => {
  try {
    const { parentMobile, childData } = req.body;
    
    console.log('Adding child for parent:', parentMobile);
    
    if (!demoUsers[parentMobile]) {
      return res.status(404).json({
        success: false,
        message: 'अभिभावक नहीं मिला'
      });
    }

    const newDSID = `DSID${Date.now()}`;
    const newChild = {
      ...childData,
      dsid: newDSID,
      status: 'active',
      lastAttendance: new Date().toISOString().split('T')[0],
      feeStatus: 'pending'
    };

    demoUsers[parentMobile].children.push(newChild);

    console.log('Child added successfully:', newChild.name);

    res.json({
      success: true,
      message: 'नया बच्चा सफलतापूर्वक जोड़ा गया',
      child: newChild
    });

  } catch (error) {
    console.error('Error adding child:', error);
    res.status(500).json({
      success: false,
      message: 'बच्चा जोड़ने में त्रुटि',
      error: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'सर्वर त्रुटि',
    error: err.message
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint नहीं मिला',
    requestedPath: req.originalUrl,
    availableEndpoints: [
      'GET /',
      'POST /api/send-otp',
      'POST /api/verify-otp',
      'GET /api/children/:mobile',
      'POST /api/add-child'
    ]
  });
});

const server = app.listen(PORT, () => {
  console.log(`DS School Backend Server running on port ${PORT}`);
  console.log(`Twilio configured: ${!!client}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Demo users: ${Object.keys(demoUsers).length}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;
