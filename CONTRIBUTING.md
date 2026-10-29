# Contributing to VehicleVault

Thank you for your interest in improving VehicleVault! We welcome issues, feedback, and pull requests from the community.

---

## 🛠 Local Development Setup

### 1. Prerequisites
- **Node.js**: 24.x LTS or higher
- **npm**: 10.x or higher
- **Docker** (optional, for containerized testing)

### 2. Getting Started
```bash
# Clone the repository
git clone https://github.com/TeeCodeDev/VehicleVault.git
cd VehicleVault

# Install dependencies for both server and client workspaces
npm install

# Copy environment template
cp .env.example .env

# Run automated tests to verify environment
npm test
```

### 3. Running in Development Mode
You can start the full stack concurrently:
```bash
npm run dev:all
```
Or start server and client independently:
- **Backend API (with hot reload):** `npm run dev`
- **Frontend PWA (Vite HMR):** `npm run dev:client` (accessible at `http://localhost:5173`)

---

## 🧪 Testing Guidelines

VehicleVault includes a comprehensive automated test suite covering:
- Authentication & JWT token lifecycles
- RDW Open Data sidecode parsing and APK date evaluation
- Dual-trigger maintenance engine logic
- Fuel consumption calculations ($L/100\text{km}$ & $\text{km}/L$)
- AI Vision receipt parsing and station formatting
- Home Assistant REST sensor telemetry
- Belastingdienst fiscal trip exports (.csv, .xlsx, .pdf)
- Digital Sales Dossier static export generation

Before submitting a Pull Request, ensure that all tests pass and that full project builds succeed:

```bash
# Run tests
npm test

# Verify production build
npm run build
```

---

## 📋 Pull Request Process

1. **Fork the repository** and create your branch from `main`:
   ```bash
   git checkout -b feature/my-cool-feature
   ```
2. **Write clean, typed code**: VehicleVault is strictly typed in TypeScript with clean modular architecture.
3. **Preserve Privacy**: Never include personal license plates, real receipts, passwords, or personal email addresses in test cases or screenshots.
4. **Submit your PR** with a clear description of the feature or bug fix.
