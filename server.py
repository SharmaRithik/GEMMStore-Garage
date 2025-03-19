import http.server
import socketserver
import webbrowser
import os
import sys
import subprocess
import time
import json
import requests

def get_chrome_path():
    """Get the path to Chrome executable based on the platform."""
    if sys.platform == "darwin":  # macOS
        chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        if not os.path.exists(chrome_path):
            print("Error: Chrome not found at", chrome_path)
            return None
    else:  # Linux
        chrome_path = "google-chrome"
        if not os.path.exists(chrome_path):
            print("Error: Chrome not found. Please install Google Chrome.")
            return None
    return chrome_path

def launch_chrome_with_flags():
    """Launch Chrome with WebGPU debug flags."""
    chrome_path = get_chrome_path()
    if not chrome_path:
        return False

    flags = [
        "--enable-unsafe-webgpu",
        "--enable-dawn-features=dump_shaders,disable_symbol_renaming",
        "--remote-debugging-port=9222",
        "--user-data-dir=/tmp/chrome-debug-profile"
    ]

    try:
        # Kill any existing Chrome instances with the same debugging port
        if sys.platform == "darwin":
            subprocess.run(["pkill", "-f", "Google Chrome.*remote-debugging-port=9222"], 
                         stderr=subprocess.DEVNULL)
        else:
            subprocess.run(["pkill", "-f", "google-chrome.*remote-debugging-port=9222"], 
                         stderr=subprocess.DEVNULL)

        # Launch Chrome with flags and URL
        subprocess.Popen([chrome_path] + flags + ["http://localhost:8063"])
        print("Chrome launched with WebGPU debug flags")
        return True
    except Exception as e:
        print(f"Error launching Chrome: {e}")
        return False

def main():
    PORT = 0023
    Handler = http.server.SimpleHTTPRequestHandler

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        
        # Launch Chrome with debug flags
        if not launch_chrome_with_flags():
            print("Failed to launch Chrome with debug flags. Opening in default browser...")
            webbrowser.open(f'http://localhost:{PORT}')
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()

if __name__ == "__main__":
    main() 
