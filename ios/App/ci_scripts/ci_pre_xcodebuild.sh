#!/bin/sh
set -e

echo "==> Installing Node.js via Homebrew..."
brew install node

echo "==> Moving to project root..."
cd "$CI_WORKSPACE"

echo "==> Installing npm dependencies..."
npm install

echo "==> Setting up Capacitor iOS files..."

# Create public directory (required by Xcode build)
mkdir -p ios/App/App/public

# Copy capacitor config to iOS platform
cp capacitor.config.json ios/App/App/capacitor.config.json

# Generate minimal config.xml
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
const xml = '<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<widget version=\"1.0.0\" xmlns=\"http://www.w3.org/ns/widgets\" xmlns:cdv=\"http://cordova.apache.org/ns/1.0\">\n    <name>' + config.appName + '</name>\n    <content src=\"index.html\" />\n    <access origin=\"*\" />\n</widget>';
fs.writeFileSync('ios/App/App/config.xml', xml);
console.log('config.xml created');
"

echo "==> Done."
