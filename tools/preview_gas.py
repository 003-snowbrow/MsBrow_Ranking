"""
本機預覽 gas/index.html（不連 Google）。

模擬 google.script.run.getData()：密碼 msbrow2026，資料來自 source/months.json。
    python3 tools/preview_gas.py          # http://localhost:5191
"""
import json, os, sys, http.server

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5191

SHIM = r"""<script>
/* dev shim: pretend to be Apps Script's google.script.run */
window.google = { script: { run: (function () {
  function runner(ok, fail) {
    return {
      withSuccessHandler: s => runner(s, fail),
      withFailureHandler: f => runner(ok, f),
      getData(pw) {
        fetch('/__months.json').then(r => r.json()).then(months => {
          const delay = Math.max(300, Math.min(2500, months.length * 150));
          setTimeout(() => {
            if (pw !== 'msbrow2026') return ok({ ok: false, error: 'bad_password' });
            if (pw === 'crash') return fail(new Error('模擬伺服器錯誤'));
            months.forEach(m => { if (m.month === '2026-03') m.warnings = ['Mandy 的達標率無法讀取（可能是 #DIV/0! 或空白），會排在最後。']; });
            ok({ ok: true, months, generatedAt: new Date().toISOString(), files: months.length + 1, parsed: 0,
                 skipped: [{ name: '薪資單_2.2_26/03', reason: '檔名是 2026-03，但內容的日期范围是 2026-02（2026-02-01 ~ 2026-02-28）' }] });
          }, delay);
        }).catch(e => (fail || console.error)(e));
      },
    };
  }
  return runner(() => {}, e => console.error(e));
})() } };
</script>
"""

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] in ('/', '/index.html'):
            html = open(os.path.join(ROOT, 'gas', 'index.html'), encoding='utf-8').read()
            html = html.replace('<script>', SHIM + '<script>', 1)
            self._send(html.encode('utf-8'), 'text/html; charset=utf-8')
        elif self.path.startswith('/__months.json'):
            data = open(os.path.join(ROOT, 'source', 'months.json'), 'rb').read()
            self._send(data, 'application/json')
        else:
            self.send_error(404)
    def _send(self, body, ctype):
        self.send_response(200); self.send_header('Content-Type', ctype); self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))

if __name__ == '__main__':
    print(f'preview of gas/index.html at http://localhost:{PORT}  (password msbrow2026)')
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
