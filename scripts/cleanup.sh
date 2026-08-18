#!/bin/bash
# ============================================
# RecordingBot - Disk Cleanup Script
# Removes temp recordings older than 24 hours
# ============================================

RECORDINGS_DIR="/var/www/RecordingBot/recordings"

if [ -d "$RECORDINGS_DIR" ]; then
    echo "[$(date)] Running cleanup on $RECORDINGS_DIR..."
    find "$RECORDINGS_DIR" -type f -mtime +1 -delete
    echo "[$(date)] Cleanup completed."
fi
