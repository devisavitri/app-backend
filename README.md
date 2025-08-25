# DS School Backend API

Complete backend API for DS Middle School with Twilio OTP integration and multi-child management system.

## Features

- Real Twilio SMS OTP - Live SMS verification
- Multi-Child Management - One parent, multiple children
- Secure Authentication - OTP-based login system
- Student Data Management - DSID, fees, attendance tracking
- Production Ready - Deployed on Vercel
- Error Handling - Comprehensive error management
- Auto-Fallback - Demo mode if Twilio fails

## API Endpoints

### Authentication
- `POST /api/send-otp` - Send OTP to mobile number
- `POST /api/verify-otp` - Verify OTP and login

### Student Management
- `GET /api/children/:mobile` - Get all children for a parent
- `POST /api/add-child` - Add new child to parent account

### Health Check
- `GET /` - API status and health check

## Environment Variables

Create a `.env` file with your Twilio credentials:

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
NODE_ENV=production


## Demo Data

Test with these mobile numbers:

- `9876543210` - राजेश कुमार (2 children: आर्यन, प्रिया)
- `9999999999` - सुरेश शर्मा (1 child: अनिल)

## Quick Deploy

### Option 1: Vercel (Recommended)
1. Push this code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Option 2: Railway
1. Connect GitHub repository
2. Add environment variables
3. Deploy with one click

## API Usage Examples

### Send OTP

POST /api/send-otp
Content-Type: application/json

{
"mobile": "9876543210"
}


### Verify OTP

POST /api/verify-otp
Content-Type: application/json

{
"mobile": "9876543210",
"otp": "123456"
}


### Get Children

GET /api/children/9876543210


## Tech Stack

- Backend: Node.js + Express.js
- SMS Service: Twilio API
- Deployment: Vercel Serverless Functions
- CORS: Enabled for frontend integration
- Error Handling: Comprehensive error management

## Security Features

- OTP expiry (5 minutes)
- Maximum 3 attempts per OTP
- Input validation
- CORS protection
- Error message sanitization

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with Twilio credentials
4. Run locally: `npm start`
5. Deploy to Vercel

## Support

For technical support or questions:
- Email: support@dsschool.edu.in
- Phone: +91 98765-43210

---

Made with love for DS Middle School

Status: Production Ready
Frontend: Compatible with Systeme.io
SMS: Live Twilio Integration
Database: Ready for MySQL/MongoDB integration
