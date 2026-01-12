#!/bin/bash
# Responsive Design Validation Script
# This script validates the responsive design implementation

set -e

echo "🎨 Responsive Design Validation"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if styles.css exists
echo "📁 Checking CSS files..."
if [ -f "core/public/css/styles.css" ]; then
    echo -e "${GREEN}✓${NC} styles.css found"
else
    echo -e "${RED}✗${NC} styles.css not found"
    exit 1
fi

# Check for viewport meta tags in all EJS files
echo ""
echo "📱 Checking viewport meta tags..."
MISSING_VIEWPORT=0
for file in core/views/*.ejs; do
    if ! grep -q "viewport" "$file"; then
        echo -e "${RED}✗${NC} Missing viewport in $(basename $file)"
        MISSING_VIEWPORT=1
    else
        echo -e "${GREEN}✓${NC} Viewport present in $(basename $file)"
    fi
done

if [ $MISSING_VIEWPORT -eq 1 ]; then
    exit 1
fi

# Check for responsive breakpoints in CSS
echo ""
echo "📐 Checking responsive breakpoints..."

REQUIRED_BREAKPOINTS=(
    "@media (max-width: 480px)"
    "@media (max-width: 768px)"
    "@media (min-width: 768px) and (max-width: 1024px)"
    "@media (min-width: 1025px)"
)

for breakpoint in "${REQUIRED_BREAKPOINTS[@]}"; do
    if grep -q "$breakpoint" core/public/css/styles.css; then
        echo -e "${GREEN}✓${NC} Found: $breakpoint"
    else
        echo -e "${RED}✗${NC} Missing: $breakpoint"
        exit 1
    fi
done

# Check for touch-friendly tap targets
echo ""
echo "👆 Checking touch-friendly tap targets..."
if grep -q "min-height: 44px" core/public/css/styles.css && \
   grep -q "min-width: 44px" core/public/css/styles.css; then
    echo -e "${GREEN}✓${NC} Tap targets defined (44x44px minimum)"
else
    echo -e "${RED}✗${NC} Missing tap target definitions"
    exit 1
fi

# Check for iOS zoom prevention
echo ""
echo "🍎 Checking iOS zoom prevention..."
if grep -q "font-size: 16px" core/public/css/styles.css; then
    echo -e "${GREEN}✓${NC} Input font-size set to 16px (prevents iOS zoom)"
else
    echo -e "${YELLOW}⚠${NC} Warning: Input font-size might not prevent iOS zoom"
fi

# Check for accessibility features
echo ""
echo "♿ Checking accessibility features..."

if grep -q "prefers-reduced-motion" core/public/css/styles.css; then
    echo -e "${GREEN}✓${NC} Reduced motion support present"
else
    echo -e "${RED}✗${NC} Missing reduced motion support"
    exit 1
fi

if grep -q "prefers-contrast: high" core/public/css/styles.css; then
    echo -e "${GREEN}✓${NC} High contrast mode support present"
else
    echo -e "${RED}✗${NC} Missing high contrast mode support"
    exit 1
fi

# Check for flexible layouts
echo ""
echo "📦 Checking flexible layouts..."

if grep -q "display: flex" core/public/css/styles.css; then
    echo -e "${GREEN}✓${NC} Flexbox layout used"
else
    echo -e "${YELLOW}⚠${NC} Warning: Flexbox not detected"
fi

if grep -q "display: grid" core/public/css/styles.css; then
    echo -e "${GREEN}✓${NC} Grid layout used"
else
    echo -e "${YELLOW}⚠${NC} Warning: Grid not detected"
fi

# Check for responsive typography
echo ""
echo "🔤 Checking responsive typography..."
if grep -q "font-size: 16px" core/public/css/styles.css || \
   grep -q "font-size: 1rem" core/public/css/styles.css; then
    echo -e "${GREEN}✓${NC} Responsive typography present"
else
    echo -e "${YELLOW}⚠${NC} Warning: Base font size might not be optimal"
fi

# Run responsive design tests
echo ""
echo "🧪 Running responsive design tests..."
if npm test -- tests/unit/responsive-design.test.js --silent 2>&1 | grep -q "PASS"; then
    echo -e "${GREEN}✓${NC} Responsive design tests passed"
else
    echo -e "${RED}✗${NC} Responsive design tests failed"
    exit 1
fi

# Summary
echo ""
echo "================================"
echo -e "${GREEN}✅ Responsive Design Validation Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test on real devices (iPhone, iPad, Android)"
echo "2. Use Chrome DevTools device emulation"
echo "3. Run Lighthouse mobile audit"
echo "4. Check Google Mobile-Friendly Test"
echo ""
