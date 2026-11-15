# KELAB TENIS TAIPING — Tennis Court Booking & Rental Ledger

Real-time tennis court booking system for **Court A & Court B** with multi-slot reservations, clash prevention, rain cancellation waivers (`MYR 0.00`), monthly player rental billing, court maintenance scheduling, and admin rate management.

---

## How to Run This Repo in GitHub

This repository is pre-configured with a **GitHub Actions workflow** (`.github/workflows/deploy.yml`) and relative asset paths (`base: './'` in `vite.config.ts`) so it can run directly on **GitHub Pages**, **GitHub Codespaces**, or your local machine.

### Option 1: Host Live for Free on GitHub Pages (Recommended)
1. **Export / Push to GitHub**:
   - In Google AI Studio, click the **GitHub / Export** icon in the top bar to push this project to a new or existing GitHub repository (or push via Git CLI).
2. **Enable GitHub Pages**:
   - Open your repository on GitHub and go to **Settings** → **Pages** (in the left sidebar).
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. **Automatic Build & Deploy**:
   - Go to the **Actions** tab in your GitHub repository.
   - The **Deploy to GitHub Pages** workflow will automatically run `npm install` and `npm run build`, then publish your live app at:
     `https://<your-github-username>.github.io/<your-repo-name>/`
4. **Authorize Your GitHub Pages Domain in Firebase (Optional — Only if using Google Sign-In)**:
   - Firestore real-time database sync works immediately from GitHub Pages.

---

### Option 2: Run Instantly in GitHub Codespaces (Browser IDE)
1. Open your repository on GitHub.
2. Click the green **<> Code** button → **Codespaces** tab → **Create codespace on main**.
3. Once the terminal opens, run:
   ```bash
   npm install
   npm run dev
   ```
4. Click **Open in Browser** when Codespaces prompts you on port `3000`.

---

### Option 3: Clone & Run Locally on Your Computer
1. Clone your GitHub repository:
   ```bash
   git clone https://github.com/<your-github-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```
2. Install dependencies and start the development server (requires **Node.js 20+**):
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
