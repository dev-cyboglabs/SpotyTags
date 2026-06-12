Now build the `.exe` on your Windows PC. Follow these steps:

---

## **Step 1: Install Python on Windows**

If not already installed:
1. Go to [python.org](https://python.org)
2. Download Python 3.11 or 3.12
3. **IMPORTANT:** Check **"Add Python to PATH"** during installation
4. Click "Install Now"

---

## **Step 2: Open Command Prompt**

Press `Win + R`, type `cmd`, press Enter.

Navigate to the project:
```cmd
cd C:\Users\%USERNAME%\spotytags\Website
```

---

## **Step 3: Install dependencies**

```cmd
python -m pip install --upgrade pip
python -m pip install pyinstaller uvicorn fastapi pydantic starlette
```

---

## **Step 4: Build the .exe**

```cmd
python -m pyinstaller launcher.spec --clean
```

Wait 2-5 minutes. This creates:
```
dist/
├── SpotyTags-Server.exe     ← Your single-click launcher
└── _internal/               ← Bundled backend + frontend files
```

---

## **Step 5: Test it**

```cmd
cd dist
SpotyTags-Server.exe
```

You should see:
- Backend starts on port 8001
- Frontend starts on port 3001
- Browser opens automatically to `http://localhost:3001`

---

## **Step 6: Create the installer (optional but professional)**

1. Download and install **Inno Setup** from [jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php)
2. Open [SpotyTags-Installer.iss](cci:7://file:///Users/KABILAN/Desktop/Spoty-01/Website/SpotyTags-Installer.iss:0:0-0:0) from the `Website` folder
3. Click **Build** → **Compile**
4. Output: `installer-output/SpotyTags-Setup.exe`

Give `SpotyTags-Setup.exe` to your customer — they double-click it, and it's installed.

---

**Try Step 4 first and let me know if the build succeeds or if you get any errors.**