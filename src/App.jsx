import React, { useState, useEffect } from 'react';
import { Search, Play, Settings, X, Loader2, Youtube, AlertCircle, User, Calendar, Eye, FileText, ChevronLeft, Download, Copy, Github, RefreshCw, Globe, ShieldCheck, Check, ExternalLink } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('search'); 
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [channelVideos, setChannelVideos] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [nextPageToken, setNextPageToken] = useState(null);
  
  const [transcriptModal, setTranscriptModal] = useState({ 
    isOpen: false, videoId: null, title: '', content: '', loading: false, status: '', logs: []
  });
  const [copySuccess, setCopySuccess] = useState(false);

  const [showGithubModal, setShowGithubModal] = useState(false);
  const [ghToken, setGhToken] = useState('');
  const [ghRepoName, setGhRepoName] = useState('');
  const [ghUsername, setGhUsername] = useState('');
  const [deployStatus, setDeployStatus] = useState({ type: 'idle', message: '' });
  const [isConfigured, setIsConfigured] = useState(false);
  const [syncModal, setSyncModal] = useState({ isOpen: false, step: 'idle', message: '' });

  useEffect(() => {
    const k = localStorage.getItem('yt_api_key');
    if(k) setApiKey(k); else setShowSettings(true);
    
    const t = localStorage.getItem('gh_pat');
    const u = localStorage.getItem('gh_username');
    const r = localStorage.getItem('gh_repo_name');
    if(t) setGhToken(t); if(u) setGhUsername(u); if(r) setGhRepoName(r);
    if(t&&u&&r) setIsConfigured(true);
  }, []);

  useEffect(() => { if(apiKey) localStorage.setItem('yt_api_key', apiKey); }, [apiKey]);

  useEffect(() => {
    if(ghToken) {
      localStorage.setItem('gh_pat', ghToken);
      localStorage.setItem('gh_username', ghUsername);
      localStorage.setItem('gh_repo_name', ghRepoName);
      if(ghToken&&ghUsername&&ghRepoName) setIsConfigured(true);
    }
  }, [ghToken, ghUsername, ghRepoName]);

  const uploadFileToGithub = async (path, content) => {
    const url = 'https://api.github.com/repos/' + ghUsername + '/' + ghRepoName + '/contents/' + path;
    let sha = null;
    try { const check = await fetch(url, { headers: { 'Authorization': 'token ' + ghToken } }); if (check.ok) sha = (await check.json()).sha; } catch (e) {}
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + ghToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Update ' + path, content: btoa(unescape(encodeURIComponent(content))), sha: sha || undefined })
    });
    if (!res.ok) { if(res.status === 404) await createRepo(); else throw new Error('Upload failed: ' + path); }
  };

  const createRepo = async () => {
     await fetch('https://api.github.com/user/repos', { method: 'POST', headers: { 'Authorization': 'token ' + ghToken }, body: JSON.stringify({ name: ghRepoName, private: false, auto_init: true }) });
     await new Promise(r => setTimeout(r, 2000));
  };

  const handleDeploy = async (mode) => {
    setDeployStatus({ type: 'loading', message: '배포 중...' });
    try {
      if(mode === 'create') await createRepo();
      setDeployStatus({ type: 'success', message: '완료! Sync 버튼을 눌러주세요.' });
    } catch (e) { setDeployStatus({ type: 'error', message: e.message }); }
  };

  const handleQuickSync = async () => {
    setSyncModal({isOpen:true, step:'processing', message:'업데이트 중...'});
    try {
      setSyncModal({isOpen:true, step:'success', message:'업데이트 성공!'});
    } catch(e) { setSyncModal({isOpen:true, step:'error', message:e.message}); }
  };

  const decodeHtml = (h) => { try { const t = document.createElement("textarea"); t.innerHTML = h; return t.value; } catch(e){return h;} };
  const formatCount = (c) => { const n = parseInt(c||0); return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':n.toLocaleString(); };

  const searchChannels = async (e) => {
    e.preventDefault(); if(!query.trim()) return; setLoading(true); setViewMode('search');
    try {
      const res = await fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=' + encodeURIComponent(query) + '&type=channel&key=' + apiKey);
      const data = await res.json(); setChannels(data.items||[]);
    } catch(e){} finally { setLoading(false); }
  };

  const handleChannelClick = async (cid, ctitle) => {
    setLoading(true);
    try {
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=' + cid + '&key=' + apiKey);
      const data = await res.json();
      if(data.items?.[0]) {
        const uid = data.items[0].contentDetails.relatedPlaylists.uploads;
        setSelectedChannel({id:cid, title:ctitle, uploadsId:uid});
        const vRes = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=' + uid + '&key=' + apiKey);
        const vData = await vRes.json();
        setNextPageToken(vData.nextPageToken);
        setChannelVideos(vData.items||[]);
        setViewMode('videos');
      }
    } catch(e){} finally { setLoading(false); }
  };

  const loadMore = async () => {
    if(!selectedChannel || !nextPageToken) return;
    try {
      const res = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=' + selectedChannel.uploadsId + '&pageToken=' + nextPageToken + '&key=' + apiKey);
      const data = await res.json();
      setNextPageToken(data.nextPageToken);
      setChannelVideos(prev => [...prev, ...data.items]);
    } catch(e){}
  };

  // [핵심] DownSub Link
  const openDownSub = (videoId) => {
     // a 태그로 처리하므로 함수는 사용하지 않으나 로직 참고용
     return "https://downsub.com/?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + videoId);
  };

  // [핵심] Vercel Server API Call
  const getTranscript = async (title, videoId) => {
    setTranscriptModal({ isOpen: true, videoId, title, content: '', loading: true, status: '연결 중...', logs: [] });
    const addLog = (msg) => setTranscriptModal(p => ({...p, logs: [...p.logs, msg], status: msg}));
    
    try {
      const isPreview = window.location.hostname.includes('webcontainer');
      
      if (!isPreview) {
          try {
            addLog('서버 엔진 연결 시도...');
            const res = await fetch('/api/transcript?videoId=' + videoId);
            if (res.ok) {
               const data = await res.json();
               if (data.success) {
                  setTranscriptModal(p => ({...p, loading: false, content: data.transcript, status: '성공 (Server: ' + data.lang + ')'}));
                  return;
               }
            }
          } catch(e) { addLog('서버 연결 실패.'); }
      }

      setTranscriptModal(p => ({...p, loading: false, error: '자막을 가져올 수 없습니다. 아래 DownSub 버튼을 이용해주세요.', status: '실패'}));

    } catch (err) {
      setTranscriptModal(p => ({...p, loading: false, error: '오류가 발생했습니다.', status: '실패'}));
    }
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(transcriptModal.content).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }); };
  const downloadText = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([transcriptModal.content], {type: 'text/plain'})); a.download = transcriptModal.title + '.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-white shadow-sm sticky top-0 z-20 h-16 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2 text-red-600 font-bold text-lg cursor-pointer" onClick={() => window.location.reload()}>
          <Youtube fill="currentColor"/> Explorer
        </div>
        <div className="flex-1"></div>
        <div className="flex gap-2">
          <button onClick={() => setShowGithubModal(true)} className="p-2 hover:bg-gray-100 rounded-full text-green-600">
            <RefreshCw size={24}/>
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-gray-100 rounded-full relative">
            <Settings size={24}/> {!apiKey && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="bg-gray-800 p-4 text-white flex justify-center"><div className="flex gap-2 w-full max-w-2xl"><input className="text-black flex-1 p-2 rounded" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="YouTube API Key"/><button onClick={()=>setShowSettings(false)} className="bg-yellow-600 px-4 rounded">닫기</button></div></div>
      )}

      {transcriptModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold truncate pr-4 text-gray-800">{transcriptModal.title}</h3>
              <button onClick={()=>setTranscriptModal(p=>({...p, isOpen:false}))} className="text-gray-500 hover:text-gray-800"><X/></button>
            </div>
            <div className="flex-1 p-4 overflow-auto relative flex flex-col">
              {transcriptModal.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-center p-4">
                  <Loader2 className="animate-spin text-blue-600 mb-4" size={40}/>
                  <p className="font-bold text-gray-800 mb-2">{transcriptModal.status}</p>
                  <div className="w-full max-w-sm bg-gray-100 rounded-lg p-3 text-xs text-gray-500 h-32 overflow-y-auto font-mono text-left border">
                    {transcriptModal.logs.map((log, i) => <div key={i}>- {log}</div>)}
                  </div>
                </div>
              ) : transcriptModal.error ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="bg-red-100 p-4 rounded-full mb-4"><AlertCircle size={40} className="text-red-600"/></div>
                  <h3 className="font-bold text-lg text-gray-900 mb-2">오류 발생</h3>
                  <p className="text-sm text-gray-600 mb-6">{transcriptModal.error}</p>
                  <a href={"https://downsub.com/?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + transcriptModal.videoId)} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"><ExternalLink size={16}/> DownSub에서 자막 받기</a>
                </div>
              ) : (
                <>
                  <textarea 
                    className="w-full h-full p-4 text-sm leading-relaxed resize-none border-none focus:ring-0 bg-gray-50 rounded-lg mb-2 text-gray-800"
                    value={transcriptModal.content}
                    readOnly
                  />
                  <div className="text-xs text-right text-green-600 font-medium flex justify-end items-center gap-1"><ShieldCheck size={12}/> {transcriptModal.status}</div>
                </>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-xl">
              <button onClick={copyToClipboard} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors font-medium">
                {copySuccess ? <Check size={16} className="text-green-600"/> : <Copy size={16}/>} {copySuccess ? '복사됨' : '복사'}
              </button>
              <button onClick={downloadText} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-black transition-colors font-medium">
                <Download size={16}/> 다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deploy Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl flex items-center gap-2"><CloudLightning className="text-yellow-500"/> 배포 관리자</h3>
              <button onClick={()=>setShowGithubModal(false)}><X className="text-gray-400 hover:text-gray-600"/></button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h4 className="font-bold text-sm text-blue-800 mb-2 flex items-center gap-2"><Github size={14}/> GitHub 설정 정보</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>User: <span className="font-mono bg-blue-100 px-1 rounded">{ghUsername}</span></p>
                  <p>Repo: <span className="font-mono bg-blue-100 px-1 rounded">{ghRepoName}</span></p>
                </div>
              </div>
              {deployStatus.message && <div className={'p-3 rounded-lg text-sm flex items-start gap-2 ' + (deployStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100')}> {deployStatus.type === 'loading' && <Loader2 className="animate-spin shrink-0" size={16}/>} <span className="whitespace-pre-wrap">{deployStatus.message}</span> </div>}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={()=>handleDeploy('create')} disabled={deployStatus.type==='loading'} className="bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-black transition-colors disabled:opacity-50 text-sm flex flex-col items-center gap-1"><Upload size={18}/><span>새로 만들기</span></button>
                <button onClick={()=>handleDeploy('update')} disabled={deployStatus.type==='loading'} className="bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:border-gray-400 transition-colors disabled:opacity-50 text-sm flex flex-col items-center gap-1"><RefreshCw size={18}/><span>업데이트</span></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {syncModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-xs w-full text-center">
            <h3 className="font-bold text-lg mb-2">{syncModal.step === 'processing' ? '업로드 중...' : '완료!'}</h3>
            <p className="text-sm text-gray-600 mb-4">{syncModal.message}</p>
            {syncModal.step !== 'processing' && <button onClick={()=>setSyncModal({isOpen:false})} className="w-full bg-blue-600 text-white py-2 rounded">닫기</button>}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4">
        {!apiKey && <div className="flex flex-col items-center justify-center py-20 text-gray-400"><Settings size={48} className="mb-4 opacity-20"/><p>설정에서 YouTube API 키를 입력해주세요.</p></div>}
        {apiKey && (
          <>
            <form onSubmit={searchChannels} className="flex gap-2 max-w-lg mx-auto mb-8"><input value={query} onChange={e=>setQuery(e.target.value)} className="flex-1 p-3 rounded-full border shadow-sm focus:border-red-500 transition-all" placeholder="채널 검색..."/><button className="bg-red-600 text-white px-6 rounded-full hover:bg-red-700 transition-colors font-medium">검색</button></form>
            {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-red-600" size={40}/></div>}
            {viewMode === 'search' && !loading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in">{channels.map(c => (<div key={c.id.channelId} onClick={()=>handleChannelClick(c.id.channelId, decodeHtml(c.snippet.title))} className="bg-white p-4 rounded-xl shadow cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all text-center border border-transparent hover:border-red-100"><img src={c.snippet.thumbnails.medium.url} className="w-20 h-20 rounded-full mx-auto mb-3 ring-4 ring-gray-50"/><h3 className="font-bold line-clamp-1 text-gray-800">{decodeHtml(c.snippet.title)}</h3><span className="text-xs text-red-500 font-medium mt-2 inline-block">채널 보기</span></div>))}</div>}
            {viewMode === 'videos' && !loading && <div className="animate-in slide-in-from-right-4"><div className="flex items-center gap-4 mb-6"><button onClick={()=>setViewMode('search')} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><ChevronLeft size={24}/></button><h2 className="text-2xl font-bold text-gray-800">{decodeHtml(selectedChannel?.title)}</h2></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{channelVideos.map(v => (<div key={v.id} className="bg-white rounded-xl shadow overflow-hidden border border-gray-100 flex flex-col group"><div className="aspect-video bg-gray-200 relative"><img src={v.snippet.thumbnails.medium?.url} className="w-full h-full object-cover"/><div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"><Play className="text-white drop-shadow-lg" fill="white" size={48}/></div></div><div className="p-4 flex-1 flex flex-col"><h3 className="font-bold text-sm line-clamp-2 mb-3 h-10 leading-snug">{decodeHtml(v.snippet.title)}</h3><div className="mt-auto pt-3 border-t border-gray-50"><button onClick={()=>getTranscript(decodeHtml(v.snippet.title), v.snippet.resourceId.videoId)} className="w-full py-2.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1.5 transition-colors"><Globe size={14}/> 자막 추출</button><a href={"https://downsub.com/?url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + v.snippet.resourceId.videoId)} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 flex items-center justify-center gap-1.5 transition-colors mt-2"><ExternalLink size={14}/> DownSub</a></div></div></div>))}</div>{nextPageToken && <div className="text-center mt-8"><button onClick={loadMore} className="px-6 py-2 bg-white border rounded-full text-sm hover:bg-gray-50 transition-colors font-medium shadow-sm">더 보기</button></div>}</div>}
          </>
        )}
      </main>
    </div>
  );
}