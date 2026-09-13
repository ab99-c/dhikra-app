#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ذِكْرى (Dhikra AI) — Local Development Server
سيرفر محلي خفيف لتشغيل ومعاينة تطبيق ذكرى على الحاسوب أو الهاتف المحلي
"""

import http.server
import socketserver
import os
import sys
import webbrowser

PORT = 8080

class DhikraHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable cache during development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def run():
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    
    server_address = ('', PORT)
    try:
        with socketserver.TCPServer(server_address, DhikraHandler) as httpd:
            print("=" * 60)
            print("🚀 تطبيق «ذِكْرى» - مساعد الذاكرة الشخصي الذكي")
            print("=" * 60)
            print(f"📡 السيرفر خدام دابا على: http://localhost:{PORT}")
            print(f"📁 مجلد التطبيق: {web_dir}")
            print("=" * 60)
            print("اضغط Ctrl + C لإيقاف السيرفر")
            
            try:
                webbrowser.open(f"http://localhost:{PORT}")
            except Exception:
                pass
                
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 98 or e.errno == 10048:
            alt_port = 8081
            print(f"⚠️ البورت {PORT} مشغول، كنجربو البورت {alt_port}...")
            with socketserver.TCPServer(('', alt_port), DhikraHandler) as httpd:
                print(f"📡 السيرفر خدام دابا على: http://localhost:{alt_port}")
                httpd.serve_forever()
        else:
            raise e

if __name__ == '__main__':
    run()
