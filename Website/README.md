# Here are your Instructions
# Run Backend
cd backend
python3 -m venv venv
source venv/bin/activate && uvicorn server:app --host 0.0.0.0 --port 8001
# Run Frontend
cd frontend
npm install
npm start
# Run Mobile App
cd Mobile-App
npm install
npm start

# cmd to generate keys 
python -c "import secrets; print('LICENSE_ENCRYPTION_KEY=' + secrets.token_hex(32))"
python -c "import secrets; print('LICENSE_HMAC_KEY=' + secrets.token_hex(32))"

# Run Build
cd Mobile-App
npx eas build -p android --profile preview



MONGO_URL=mongodb://localhost:27017
DB_NAME=spotytags
UPLOADS_DIR=./uploads
SEED_DEMO_DATA=false
CORS_ORIGINS=*
JWT_SECRET=spotytags-secret-key-change-in-production

# ── License security ──────────────────────────────────────────────────────────
# 32-byte keys encoded as base64.  Generate with:
#   python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
# If unset, keys are derived from JWT_SECRET (acceptable for dev; set in production).
LICENSE_ENCRYPTION_KEY=b6e686d672e439178bcb00b37dc95347cd04764dbf70dad02fa84f11d8803bd7
LICENSE_HMAC_KEY=3e0179eab49b5359033fe7a87fc01bc78b4e2da4fb19a0416f7ac700595c56bd

# Optional: override where .last_run timestamp file is written (default: backend dir).
# LAST_RUN_DIR=/var/lib/spotytags
ADMIN_API_KEY=3fQXPka9qGwdxuF-HKJUQYEvNk23zg0x_nc7-21JwXY
# ADMIN_SCRIPT_PASSWORD=admin  # For dev convenience (no password prompt)
ADMIN_PASSWORD_HASH=8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918


## Steps

1. **Generate hash: Replace your-password**
    
    ```bash
    python3 -c "import hashlib; print(hashlib.sha256(b'your-password').hexdigest())"
    ```
    
2. **Add to .env:**
    
    ```
    ADMIN_PASSWORD_HASH=<hash-from-step-1>
    ```
    
3. **Remove from .env: * remove or cmd this line**
    
    ```
    # ADMIN_SCRIPT_PASSWORD=your-password  # Remove or comment this line
    ```
    
4. **Run script: Choose property-id**
    
    ```bash
    python3 admin_extend_license.py --property-id PROP-001 --years 1 **or** venv/bin/python admin_extend_license.py --property-id PROP-001 --years 1
    ```
    
5. **Enter password when prompted:**
    
    ```
    Enter admin password: your-password
    ```
    
6. **It will work** - the script hashes "your-password" and compares with the stored hash.

## Security Note

Even if someone reads .env, they only see the hash, not the actual password. They cannot reverse the hash to get your password.