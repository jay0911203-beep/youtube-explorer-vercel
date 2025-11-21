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
  
  // GitHub State
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

  useEffect(() => {
    if(apiKey) localStorage.setItem('yt_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    if(ghToken) {
      localStorage.setItem('gh_pat', ghToken);
      localStorage.setItem('gh_username', ghUsername);
      localStorage.setItem('gh_repo_name', ghRepoName);
      if(ghToken&&ghUsername&&ghRepoName) setIsConfigured(true);
    }
  }, [ghToken, ghUsername, ghRepoName]);

  // GitHub Upload Logic
  const uploadFileToGithub = async (path, content) => {
    const url = `https://api.github.com/repos/${ghUsername}/${ghRepoName}/contents/${path}`;
    let sha = null;
    try { const check = await fetch(url, { headers: { 'Authorization': `token ${ghToken}` } }); if (check.ok) sha = (await check.json()).sha; } catch (e) {}
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Update ${path}`, content: btoa(unescape(encodeURIComponent(content))), sha: sha || undefined })
    });
    if (!res.ok) { if(res.status === 404) await createRepo(); else throw new Error(`Upload failed: ${path}`); }
  };

  const createRepo = async () => {
     await fetch('https://api.github.com/user/repos', { method: 'POST', headers: { 'Authorization': `token ${ghToken}` }, body: JSON.stringify({ name: ghRepoName, private: false, auto_init: true }) });
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
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`);
      const data = await res.json(); setChannels(data.items||[]);
    } catch(e){} finally { setLoading(false); }
  };

  const handleChannelClick = async (cid, ctitle) => {
    setLoading(true);
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${cid}&key=${apiKey}`);
      const data = await res.json();
      if(data.items?.[0]) {
        const uid = data.items[0].contentDetails.relatedPlaylists.uploads;
        setSelectedChannel({id:cid, title:ctitle, uploadsId:uid});
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${uid}&key=${apiKey}`);
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
      const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${selectedChannel.uploadsId}&pageToken=${nextPageToken}&key=${apiKey}`);
      const data = await res.json();
      setNextPageToken(data.nextPageToken);
      setChannelVideos(prev => [...prev, ...data.items]);
    } catch(e){}
  };

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
              {deployStatus.message && <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${deployStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}> {deployStatus.type === 'loading' && <Loader2 className="animate-spin shrink-0" size={16}/>} <span className="whitespace-pre-wrap">{deployStatus.message}</span> </div>}
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
            
            {viewMode === 'videos' && !loading && <div className="animate-in slide-in-from-right-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={()=>setViewMode('search')} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><ChevronLeft size={24}/></button><h2 className="text-2xl font-bold text-gray-800">{decodeHtml(selectedChannel?.title)}</h2></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {channelVideos.map(v => (
                  <div key={v.id} className="bg-white rounded-xl shadow overflow-hidden border border-gray-100 flex flex-col group">
                    <div className="aspect-video bg-gray-200 relative"><img src={v.snippet.thumbnails.medium?.url} className="w-full h-full object-cover"/><div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"><Play className="text-white drop-shadow-lg" fill="white" size={48}/></div></div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-sm line-clamp-2 mb-3 h-10 leading-snug">{decodeHtml(v.snippet.title)}</h3>
                      <div className="mt-auto pt-3 border-t border-gray-50">
                        {/* [FIX] button -> a 태그로 변경 (새 탭에서 열기 보장) */}
                        <a 
                          href={`https://downsub.com/?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.snippet.resourceId.videoId}`)}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full py-2.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={14}/> DownSub에서 자막받기
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {nextPageToken && <div className="text-center mt-8"><button onClick={loadMore} className="px-6 py-2 bg-white border rounded-full text-sm hover:bg-gray-50 transition-colors font-medium shadow-sm">더 보기</button></div>}
            </div>}
          </>
        )}
      </main>
    </div>
  );
}