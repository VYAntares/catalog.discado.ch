#!/bin/sh
set -e

echo "==> Installing Node.js via Homebrew..."
brew install node

echo "==> Moving to project root..."
cd "$CI_WORKSPACE"

echo "==> Installing npm dependencies..."
npm install

echo "==> Running Capacitor sync..."
npx cap sync ios

echo "==> Done."
