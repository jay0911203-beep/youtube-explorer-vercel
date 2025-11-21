
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
import sys
import os

# Vercel 환경 의존성 로드
try:
    from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
except ImportError:
    YouTubeTranscriptApi = None

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        path = urlparse(self.path)
        params = parse_qs(path.query)
        video_id = params.get('videoId', [None])[0]

        if not video_id:
            self.wfile.write(json.dumps({'error': 'Video ID required'}).encode('utf-8'))
            return

        if not YouTubeTranscriptApi:
            self.wfile.write(json.dumps({'error': 'Server config error'}).encode('utf-8'))
            return

        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            
            try:
                transcript = transcript_list.find_transcript(['ko'])
            except:
                try:
                    transcript = transcript_list.find_transcript(['en'])
                except:
                    transcript = transcript_list.find_generated_transcript(['ko', 'en'])

            data = transcript.fetch()
            full_text = " ".join([item['text'] for item in data])
            clean_text = full_text.replace('\n', ' ').replace('  ', ' ')

            response_data = {
                'success': True, 
                'transcript': clean_text, 
                'lang': transcript.language_code
            }
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        except Exception as e:
            self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
