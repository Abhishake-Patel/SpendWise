# 🚀 SpendWise — Firebase Setup Guide

Follow these steps to get your expense tracker live and shareable.

---

## Step 1: Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it (e.g., `spendwise`) → Continue
4. Disable Google Analytics (optional) → **Create project**

---

## Step 2: Enable Authentication

1. In your Firebase project, click **Build → Authentication** in the left sidebar
2. Click **"Get started"**
3. Under **Sign-in method**, enable:
   - ✅ **Email/Password** → Toggle on → Save
   - ✅ **Google** → Toggle on → Enter your email as support email → Save

---

## Step 3: Create Firestore Database

1. Click **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → Next
4. Select a region close to you → **Enable**
5. Go to the **Rules** tab and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

6. Click **Publish**

---

## Step 4: Get Your Config Keys

1. Click the **gear icon ⚙️** → **Project settings**
2. Scroll down to **"Your apps"**
3. Click **"Add app"** → choose the **Web (</>)** icon
4. Enter an app nickname (e.g., `SpendWise Web`) → **Register app**
5. You'll see a `firebaseConfig` object like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...:web:abc..."
};
```

6. Open `js/firebase-config.js` and **replace the placeholder values** with yours.

---

## Step 5: Test Locally

Open `index.html` in your browser (double-click the file). You should be able to:
- Register a new account
- Add expenses and income
- See charts populate

> ⚠️ If you see CORS errors with Google Sign-In, you need to host the app (Step 6).

---

## Step 6: Deploy & Share (Firebase Hosting)

This gives you a public URL like `https://your-app.web.app` to share with anyone.

### Prerequisites
```bash
# Install Firebase CLI (one time)
npm install -g firebase-tools
```

### Deploy Steps
```bash
# 1. Navigate to your project folder
cd "/Users/patelabh/Documents/Expense Tracker"

# 2. Login to Firebase
firebase login

# 3. Initialize hosting (one time setup)
firebase init hosting
# → Select your project
# → Public directory: . (just press Enter)
# → Single-page app: Yes
# → Overwrite index.html: No

# 4. Deploy!
firebase deploy --only hosting
```

After deploying, you'll get a URL like:
```
✔  Hosting URL: https://your-project.web.app
```

📋 **Share this URL with others** — they each create their own account and their data is completely private from yours.

---

## Step 7: Add Your Domain to Google Sign-In (if using Google auth)

1. Firebase Console → Authentication → Settings → **Authorized domains**
2. Your `*.web.app` domain is already there by default ✅
3. If you use a custom domain, add it here

---

## Features Summary

| Feature | Details |
|---|---|
| 🔐 Auth | Email/Password + Google Sign-In |
| 💸 Expenses | Add, edit, delete with categories |
| 💵 Income | Track salary, freelance, investments |
| 🎯 Budgets | Monthly limits per category with progress bars |
| 📊 Charts | Spending by category + 6-month trend |
| 💱 Currencies | CAD, USD, INR |
| 📤 Export | CSV download for expenses & income |
| 🔒 Privacy | Each user's data is 100% private |

---

## Troubleshooting

**"Firebase: Error (auth/api-key-not-valid)"**
→ Double-check you copied the config keys correctly into `js/firebase-config.js`

**Google Sign-In doesn't work locally**
→ Deploy to Firebase Hosting first (Step 6), then test

**Charts not showing**
→ Add at least one expense to see the pie chart populate

**"Permission denied" Firestore error**
→ Make sure you published the Firestore security rules in Step 3
