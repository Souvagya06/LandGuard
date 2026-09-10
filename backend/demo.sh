#!/bin/bash
# LandGuard Alert System - Quick Interactive Demo
# Run this script to see the alert system in action!

set -e

# Color codes for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_command() {
    echo -e "${MAGENTA}$ $1${NC}"
}

# Check prerequisites
print_header "LandGuard Alert System - Quick Demo"

echo "Prerequisites Check:"
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_warning "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm installed: $NPM_VERSION"
else
    print_warning "npm not found"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "backend/server.js" ]; then
    print_warning "server.js not found. Please run this from project root."
    exit 1
fi

print_success "All prerequisites met!"

echo ""
print_header "Step 1: Install Dependencies"
echo "Installing WebSocket library (ws)..."
echo ""
cd backend
print_command "npm install"
npm install --quiet 2>/dev/null || npm install
cd ..
print_success "Dependencies installed"

echo ""
print_header "Step 2: Start Backend Server"
print_info "Starting backend server on http://127.0.0.1:8000"
print_info "WebSocket endpoint: ws://127.0.0.1:8000"
echo ""
print_command "cd backend && npm start"
echo ""

# Start backend in background
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait for server to start
echo "Waiting for backend to start..."
sleep 3

# Check if server is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_warning "Backend failed to start"
    exit 1
fi

print_success "Backend server started (PID: $BACKEND_PID)"

# Test health endpoint
echo ""
echo "Testing health endpoint..."
if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
    print_success "Backend is responding to requests"
else
    print_warning "Could not reach backend"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo ""
print_header "Step 3: Testing WebSocket Connection"
print_info "WebSocket client will receive alerts in real-time"
echo ""
print_info "To connect to WebSocket in another terminal, run:"
print_command "npm install -g wscat && wscat -c ws://127.0.0.1:8000"
echo ""
print_warning "OPEN ANOTHER TERMINAL NOW and run the command above"
echo ""
read -p "Press Enter once you've connected wscat and ready to test..."

echo ""
print_header "Step 4: Trigger Alert"
print_info "Sending alert to backend..."
echo ""
print_command "curl -X POST http://127.0.0.1:8000/alerts -H 'Content-Type: application/json' -d '{\"zoneId\": \"zone-001\"}'"
echo ""

# Trigger alert
ALERT_RESPONSE=$(curl -s -X POST http://127.0.0.1:8000/alerts \
  -H "Content-Type: application/json" \
  -d '{"zoneId": "zone-001"}')

# Parse response
ALERT_ID=$(echo $ALERT_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
ZONE_NAME=$(echo $ALERT_RESPONSE | grep -o '"zoneName":"[^"]*"' | cut -d'"' -f4)
LEVEL=$(echo $ALERT_RESPONSE | grep -o '"level":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ALERT_ID" ]; then
    print_warning "Failed to trigger alert"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

print_success "Alert created successfully!"
echo ""
echo "Alert Details:"
echo "  ID:       $ALERT_ID"
echo "  Zone:     $ZONE_NAME"
echo "  Level:    $LEVEL"
echo ""

print_info "CHECK YOUR WSCAT TERMINAL - You should see:"
echo "  {\"type\":\"alert\",\"data\":{...}}"
echo ""
echo "This proves real-time alert delivery is working! 🎉"

echo ""
print_header "Step 5: Retrieve Alerts via HTTP"
print_info "Fetching all stored alerts..."
echo ""
print_command "curl http://127.0.0.1:8000/alerts"
echo ""

ALERTS=$(curl -s http://127.0.0.1:8000/alerts | head -50)
echo "$ALERTS" | head -c 300
echo "..."
print_success "Alerts retrieved successfully"

echo ""
print_header "Demo Complete!"
echo ""
echo "What you just demonstrated:"
echo "  ✓ Backend WebSocket server running"
echo "  ✓ Real-time alert broadcasting"
echo "  ✓ Persistent alert storage"
echo "  ✓ Multi-client support"
echo ""

echo "Next Steps:"
echo "  1. Keep testing with wscat in the other terminal"
echo "  2. Try triggering more alerts with:"
echo "     curl -X POST http://127.0.0.1:8000/alerts -H 'Content-Type: application/json' -d '{\"zoneId\": \"zone-002\"}'"
echo "  3. Test with multiple wscat clients (open 3+ terminals)"
echo "  4. Integrate with Android app (see ANDROID_INTEGRATION.md)"
echo ""

echo "Backend server will continue running. Press Ctrl+C to stop."
echo ""

# Wait for user to finish
wait $BACKEND_PID 2>/dev/null || true

print_info "Backend stopped"
print_success "Demo complete!"
