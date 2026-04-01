#!/bin/bash
# =====================================================
#  Strategy& Workflow Builder - Quick Start (macOS)
# =====================================================

cd "$(dirname "$0")"

echo ""
echo "====================================================="
echo "  Strategy& Workflow Builder - Starting..."
echo "====================================================="
echo ""

# -- 1. Check Node.js --
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    echo ""
    echo "Install with Homebrew:  brew install node"
    echo "Or download from:       https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js $(node -v) detected."

# -- 2. Check npm --
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is not found. Please reinstall Node.js."
    exit 1
fi

echo "[OK] npm v$(npm -v) detected."

# -- 2.5. Restore config files (email packaging renames .mjs → .mjs.txt) --
for f in *.mjs.txt; do
    [ -e "$f" ] || continue
    target="${f%.txt}"
    mv "$f" "$target"
    echo "[OK] Restored: $target"
done

# -- 3. Install dependencies if needed --
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[INFO] Installing dependencies (first run)..."
    echo "       This may take a few minutes..."
    echo ""
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "[ERROR] npm install failed. Check your network connection."
        exit 1
    fi
    echo ""
    echo "[OK] Dependencies installed successfully."
else
    echo "[OK] Dependencies already installed."
fi

# -- 4. Check .env.local --
if [ ! -f ".env.local" ]; then
    echo ""
    echo "[WARNING] .env.local file not found."
    echo "          AI Chat feature requires an OpenAI API key."
    echo "          Create .env.local with:"
    echo "            OPENAI_API_KEY=sk-your-key-here"
    echo ""
fi

# -- 5. Start dev server --
echo ""
echo "====================================================="
echo "  Starting development server..."
echo "  URL: http://localhost:3000"
echo "====================================================="
echo ""
echo "  Press Ctrl+C to stop the server."
echo ""

# Auto-open browser after 2 seconds
(sleep 2 && open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null) &

npx next dev --turbopack -p 3000
