# MAF Mobile App: APK Build & Manual Installation Guide

This guide details how to build and manually install the Android `.apk` for the MAF system. Since this app uses native modules (like GPS `expo-location` and camera permissions), it relies on **EAS Build** to compile the underlying Java/Kotlin code in the cloud.

## Step 1: Install EAS CLI
Ensure you have the Expo Application Services CLI installed and authenticated:
```bash
npm install -g eas-cli
eas login
```

## Step 2: Build the APK
Wait for all code to be pushed. Run the following command inside the `mobile-app` directory to trigger the cloud build:

```bash
cd mobile-app
npx eas build -p android --profile preview
```

*Note: The `preview` profile is correctly configured in `eas.json` to generate an installable `.apk` directly and automatically injects production backend API URLs and Supabase keys.*

## Step 3: Download & Transfer
Once the EAS dashboard reports "Build Finished", a direct download link (and QR Code) to the artifact will appear in your console.
1. Scan the QR code with your Android phone's camera, OR
2. Download the `.apk` file and transfer it to the Android device via Slack, Email, or USB.

## Step 4: Install on Device
1. Tap the `.apk` file on your Android device to open it.
2. If prompted, you must allow **"Install from unknown sources"** when Android warns you about untrusted developers. Give Chrome or the File Manager the permission to install it.
3. Click "Install".
4. Open the `mobile-app`! 

You will now be connected securely to the live Vercel API.

---

### Uninstalling or Rolling Back
If you ever want to clear the app or install an older version, simply long-press the `mobile-app` icon on your home screen and select "Uninstall". Then repeat the installation steps with your desired `.apk`.
