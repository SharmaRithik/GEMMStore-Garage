import http.server
import socketserver
import webbrowser
import sys
import os
import subprocess
import time
import platform

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

def launch_chrome_with_flags(port):
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
        subprocess.Popen([chrome_path] + flags + [f"http://localhost:{port}"])
        print("Chrome launched with WebGPU debug flags")
        return True
    except Exception as e:
        print(f"Error launching Chrome: {e}")
        return False

def main():
    # Default port if not specified
    DEFAULT_PORT = 8000
    
    # Get port from command line argument if provided
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
            if port < 1024 or port > 65535:
                print("Error: Port number must be between 1024 and 65535")
                return
        except ValueError:
            print("Error: Port must be a number")
            return
    else:
        port = DEFAULT_PORT

    Handler = http.server.SimpleHTTPRequestHandler

    try:
        with socketserver.TCPServer(("", port), Handler) as httpd:
            print(f"Serving at http://localhost:{port}")
            
            # Launch Chrome with debug flags
            if not launch_chrome_with_flags(port):
                print("Failed to launch Chrome with debug flags. Opening in default browser...")
                webbrowser.open(f'http://localhost:{port}')
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nShutting down server...")
                httpd.shutdown()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Error: Port {port} is already in use. Please try a different port.")
        else:
            print(f"Error: {e}")

if __name__ == "__main__":
    main() 
