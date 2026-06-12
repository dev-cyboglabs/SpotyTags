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
