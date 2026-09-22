#!/bin/bash
# ============================================================
# FAFLOW — Server APK Cleanup Script
# Run this on the Azure VM (20.235.169.222) to remove all
# uploaded APK files and free disk space.
# ============================================================

echo "🔍 Scanning for APK files on the server..."

APK_FILES=$(find / -name "*.apk" 2>/dev/null \
  -not -path "/proc/*" \
  -not -path "/sys/*" \
  -not -path "/dev/*")

if [ -z "$APK_FILES" ]; then
  echo "✅ No APK files found on this server."
  exit 0
fi

echo ""
echo "📦 Found the following APK files:"
echo "--------------------------------------------"
TOTAL_SIZE=0
while IFS= read -r f; do
  SIZE=$(du -sh "$f" 2>/dev/null | cut -f1)
  echo "  [$SIZE]  $f"
done <<< "$APK_FILES"
echo "--------------------------------------------"
echo ""

read -p "❓ Delete ALL of the above APK files? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Aborted. No files deleted."
  exit 1
fi

echo ""
echo "🗑️  Deleting APK files..."
DELETED=0
FAILED=0
while IFS= read -r f; do
  if rm -f "$f" 2>/dev/null; then
    echo "  ✅ Deleted: $f"
    DELETED=$((DELETED + 1))
  else
    echo "  ❌ Failed:  $f (permission denied?)"
    FAILED=$((FAILED + 1))
  fi
done <<< "$APK_FILES"

echo ""
echo "============================================"
echo "  Done. $DELETED deleted | $FAILED failed"
echo "============================================"
df -h /  # Show remaining disk space
