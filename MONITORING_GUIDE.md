# 📊 Durmah Monitoring & Uptime Guide

*Comprehensive monitoring setup for production Durmah deployment*

## 🎯 Health Check Endpoint

### Primary Health Check
```bash
# Main health endpoint
GET https://your-render-service.onrender.com/api/healthz

# Response format:
{
  "status": "ok",
  "timestamp": "2025-08-23T22:26:30Z",
  "uptime": 3600,
  "memory": {
    "used": 125829120,
    "total": 2147483648,
    "percentage": 5.8
  },
  "connections": {
    "active": 2,
    "total": 47
  },
  "version": "2.0.0"
}
```

## 🔍 Basic Uptime Checks

### System Status Checks
```bash
# 1. Basic availability
curl -f https://your-render-service.onrender.com/api/healthz

# 2. WebRTC session capability
curl -X POST https://your-render-service.onrender.com/api/realtime/session \
  -H "Content-Type: application/json" \
  -d '{}'

# 3. CORS functionality
curl -I -H "Origin: https://your-netlify-site.netlify.app" \
  https://your-render-service.onrender.com/api/healthz

# 4. Frontend availability
curl -I https://your-netlify-site.netlify.app
```

### Performance Monitoring
```bash
# Response time monitoring
time curl -s https://your-render-service.onrender.com/api/healthz > /dev/null

# Expected: <200ms for health check
# Alert if: >500ms consistently
```

## 📈 Monitoring Tools Setup

### 1. Render Native Monitoring

#### Render Dashboard
```bash
# Available metrics:
- CPU usage
- Memory usage  
- Response times
- Error rates
- Build status
- Deployment logs
```

### 2. External Monitoring (Free Options)

#### UptimeRobot (Free Tier)
```bash
# Setup instructions:
1. Go to uptimerobot.com
2. Add new monitor:
   - Type: HTTP(s)
   - URL: https://your-render-service.onrender.com/api/healthz
   - Interval: 5 minutes
   - Alert when down for: 2 minutes
```

## 🔧 Simple Monitoring Script

### Health Check Script
```bash
#!/bin/bash
# health-check.sh - Run every 5 minutes via cron

BACKEND_URL="https://your-render-service.onrender.com"
FRONTEND_URL="https://your-netlify-site.netlify.app"
ALERT_EMAIL="admin@yourschool.edu"

# Check backend health
if ! curl -f "$BACKEND_URL/api/healthz" > /dev/null 2>&1; then
    echo "Backend health check failed" | mail -s "Durmah Backend Alert" $ALERT_EMAIL
fi

# Check frontend
if ! curl -f "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "Frontend health check failed" | mail -s "Durmah Frontend Alert" $ALERT_EMAIL
fi
```

---

**Monitoring Setup Complete! 📊**

*Comprehensive monitoring ensures Durmah provides reliable support for Durham Law students 24/7.*