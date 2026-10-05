"""Serve the local video player with byte ranges for reliable video seeking."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import os
import re


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.byte_range = None
        path = self.translate_path(self.path)
        requested = self.headers.get('Range')
        if not requested or not os.path.isfile(path):
            return super().send_head()
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
        if not match or not any(match.groups()):
            self.send_error(400, 'Invalid byte range')
            return None
        stream = open(path, 'rb')
        size = os.fstat(stream.fileno()).st_size
        first, last = match.groups()
        start = int(first) if first else max(0, size - int(last))
        end = min(size - 1, int(last)) if first and last else size - 1
        if start >= size or end < start:
            stream.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        self.byte_range = (start, end)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        return stream

    def end_headers(self):
        if self.byte_range is None:
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def copyfile(self, source, outputfile):
        if self.byte_range is None:
            return super().copyfile(source, outputfile)
        start, end = self.byte_range
        source.seek(start)
        remaining = end - start + 1
        while remaining:
            chunk = source.read(min(65536, remaining))
            if not chunk: break
            outputfile.write(chunk)
            remaining -= len(chunk)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--bind', default='127.0.0.1')
    args = parser.parse_args()
    handler = partial(RangeHandler, directory=str(Path(__file__).resolve().parent))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f'Preview at http://{args.bind}:{args.port}', flush=True)
    server.serve_forever()
