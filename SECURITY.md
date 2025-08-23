# 🔐 Security Guidelines for Durmah Legal Buddy

## 🚨 Critical Security Reminders

### Immediate Actions Required

**⚠️ If any secrets have been committed to version control:**
1. **Rotate ALL API keys immediately**
2. **Generate new JWT/session secrets**
3. **Update environment variables in deployment platforms**
4. **Review git history for leaked credentials**

### Environment Variables

**❌ NEVER commit `.env` files to version control**
- All `.env` files are in `.gitignore`
- Use `.env.example` files with placeholder values only
- Set actual secrets only in deployment platform dashboards

**✅ Required Secure Environment Variables:**

#### Backend (Render.com)
```env
# API Keys - Never share or commit
OPENAI_API_KEY=sk-xxxx
SUPABASE_SERVICE_KEY=service_role_xxx
ELEVENLABS_API_KEY=xxx  # Optional

# Secrets - Generate random 32+ character strings
JWT_SECRET=xxx
SESSION_SECRET=xxx

# URLs - Update for your deployment
CLIENT_URL=https://<your-netlify-site>.netlify.app
SUPABASE_URL=https://xxx.supabase.co
```

#### Frontend (Netlify)
```env
# Safe for client-side (public keys only)
VITE_API_URL=https://<render-app>.onrender.com
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=anon_xxx
```

## 🔒 Deployment Security

### Render.com Backend
- **Environment Variables**: Set in Render dashboard, not in code
- **Service Role Keys**: Use Supabase service role key, not personal keys
- **CORS**: Restrict `CLIENT_URL` to your actual frontend domain
- **Health Checks**: Monitor `/health` endpoint for availability

### Netlify Frontend
- **Public Keys Only**: Only use `anon` keys from Supabase
- **HTTPS**: Automatically provided by Netlify
- **Domain**: Configure proper redirect URLs in Supabase

### Supabase Database
- **Row Level Security (RLS)**: Enable on all tables
- **OAuth Providers**: Configure redirect URLs precisely
- **API Keys**: Use `anon` key for frontend, `service_role` for backend only

## 🛡️ Security Best Practices

### Authentication
- **OAuth Only**: No password-based authentication
- **JWT Tokens**: Short expiration times
- **Session Management**: Proper logout functionality
- **Redirect URLs**: Whitelist exact domains only

### API Security
- **Rate Limiting**: Implemented for API endpoints
- **CORS**: Restrict to specific origins
- **Input Validation**: Sanitize all user inputs
- **Error Handling**: Don't expose internal details

### Data Protection
- **Minimal Data Collection**: Only store necessary user information
- **Encryption**: All data encrypted in transit (HTTPS/WSS)
- **Logging**: Don't log sensitive information
- **Retention**: Implement data cleanup policies

## 🔍 Security Monitoring

### What to Monitor
- **Failed Authentication Attempts**: Unusual login patterns
- **API Rate Limits**: Potential abuse or attacks
- **Error Rates**: Unexpected application failures
- **WebSocket Connections**: Unusual voice usage patterns

### Logging Guidelines
```javascript
// ✅ Good - No sensitive data
console.log('User authenticated:', { userId: user.id, timestamp: new Date() });

// ❌ Bad - Exposes sensitive data
console.log('User authenticated:', { user, token, apiKey });
```

## 🚨 Incident Response

### If Security Breach Suspected:
1. **Immediately rotate all API keys**
2. **Review access logs in Supabase dashboard**
3. **Check Render/Netlify deployment logs**
4. **Update all environment variables**
5. **Force logout all users if necessary**

### Key Rotation Checklist:
- [ ] OpenAI API key
- [ ] Supabase service role key
- [ ] JWT secret
- [ ] Session secret
- [ ] ElevenLabs API key (if used)
- [ ] Update in Render environment variables
- [ ] Test all functionality after rotation

## 🔐 Secrets Management

### Generate Strong Secrets
```bash
# Generate random 32-character strings for JWT/session secrets
openssl rand -hex 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment Variable Security
- **Development**: Use `.env` files (never commit)
- **Production**: Use platform environment variable features
- **Team Access**: Limit who can access production secrets
- **Backup**: Securely store backup copies of production secrets

## 🛠️ Security Validation

### Pre-Deployment Checklist
- [ ] All `.env` files in `.gitignore`
- [ ] No secrets in code or config files
- [ ] Strong JWT/session secrets generated
- [ ] CORS configured for specific domains
- [ ] RLS policies enabled in Supabase
- [ ] OAuth redirect URLs whitelist specific domains
- [ ] Error messages don't expose internals

### Post-Deployment Validation
- [ ] Health endpoints return expected responses
- [ ] Authentication flow works correctly
- [ ] API endpoints require proper authentication
- [ ] WebSocket connections are secured
- [ ] No sensitive data in browser dev tools
- [ ] HTTPS enforced for all connections

## 📞 Contact & Support

### Security Issues
- Report security vulnerabilities responsibly
- Do not post security issues in public repositories
- Contact maintainers directly for security concerns

### Emergency Contacts
- Supabase: [Dashboard](https://supabase.com/dashboard) for immediate key rotation
- Render: [Dashboard](https://dashboard.render.com) for environment variable updates
- Netlify: [Dashboard](https://app.netlify.com) for frontend environment updates

## 🔄 Regular Security Maintenance

### Monthly Tasks
- [ ] Review and rotate API keys
- [ ] Check access logs for unusual activity
- [ ] Update dependencies for security patches
- [ ] Review and update RLS policies
- [ ] Validate environment variable configurations

### Quarterly Tasks
- [ ] Security audit of authentication flow
- [ ] Review error handling and logging
- [ ] Update security documentation
- [ ] Test incident response procedures
- [ ] Review team access permissions

---

**Remember: Security is everyone's responsibility. When in doubt, err on the side of caution and restrict access rather than grant it.**