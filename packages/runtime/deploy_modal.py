#!/usr/bin/env python3
"""
Deploy Modal runtime with proper encoding handling for Windows.
"""

import os
import sys
import subprocess
import io

# Set UTF-8 encoding before anything else
os.environ['PYTHONIOENCODING'] = 'utf-8'
os.environ['PYTHONUTF8'] = '1'

# Reconfigure stdout/stderr to handle encoding errors
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def main():
    # Run modal deploy with subprocess, capturing output
    result = subprocess.run(
        [sys.executable, '-m', 'modal', 'deploy', '-m', 'claw_runtime.main'],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        capture_output=True,
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1'},
    )

    # Decode output with replacement for problematic characters
    stdout = result.stdout.decode('utf-8', errors='replace')
    stderr = result.stderr.decode('utf-8', errors='replace')

    # Print output (now safe with reconfigured stdout/stderr)
    if stdout:
        print(stdout)
    if stderr:
        print(stderr, file=sys.stderr)

    return result.returncode

if __name__ == '__main__':
    sys.exit(main())
