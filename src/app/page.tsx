'use client';

import { useState, useEffect, useRef } from 'react';
import { Player, Room } from '@/lib/store';
import { LONG_PARAGRAPHS } from '@/lib/paragraphs';

export default function Home() {
  const [view, setView] = useState<'landing' | 'admin-setup' | 'waiting' | 'contest'>('landing');
  const [roomId, setRoomId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomData, setRoomData] = useState<any>(null);
  const [error, setError] = useState('');
  
  // Contest state
  const [typedChars, setTypedChars] = useState('');
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [timeLeft, setTimeLeft] = useState(60);
  const [countdown, setCountdown] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [paragraph, setParagraph] = useState('');
  const [duration, setDuration] = useState('60');
  const [capacity, setCapacity] = useState('40'); // Added capacity state
  const contestStartTime = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null); // For auto-scrolling

  // Timer synchronization is handled in the polling loop (lines 180+)
  
  // Stats calculation
  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isFinished || timeLeft <= 0 || !roomData) return;
    
    const input = e.target.value;
    const now = Date.now();
    // Use server-synced startTime or fall back to current time
    const sTime = contestStartTime.current || now;
    
    setTypedChars(input);

    // Calculate accuracy
    const target = roomData.paragraph;
    let correct = 0;
    for (let i = 0; i < input.length; i++) {
        if (input[i] === target[i]) correct++;
    }
    const acc = input.length > 0 ? Math.round((correct / input.length) * 100) : 100;
    setAccuracy(acc);

    // Calculate WPM based on server clock start time
    const timeElapsed = (now - sTime) / 1000 / 60; // in minutes
    const currentWpm = timeElapsed > 0.05 ? Math.round((input.length / 5) / timeElapsed) : 0;
    setWpm(currentWpm);
    
    // Calculate Progress
    const progress = Math.min(Math.round((input.length / target.length) * 100), 100);

    // Auto scroll typing area
    if (scrollRef.current) {
        const currentChar = scrollRef.current.querySelector('.char.current') as HTMLElement;
        if (currentChar) {
            const container = scrollRef.current;
            const charBottom = currentChar.offsetTop + currentChar.offsetHeight;
            if (charBottom > container.scrollTop + container.offsetHeight - 50) {
               container.scrollTop += 40;
            }
        }
    }

    // Check if finished
    if (input.length >= target.length) {
        setIsFinished(true);
        updateStats(currentWpm, acc, progress, 'finished');
    } else {
        updateStats(currentWpm, acc, progress, 'typing');
    }
  };

  const updateStats = async (wdm: number, acc: number, prog: number, status: string) => {
    try {
        await fetch(`/api/room/${roomId}/update`, {
            method: 'POST',
            body: JSON.stringify({ playerId, wpm: wdm, accuracy: acc, progress: prog, status }),
        });
    } catch (e) {}
  };

  // API Callers
  const createRoom = async () => {
    try {
        const res = await fetch('/api/room/create', {
            method: 'POST',
            body: JSON.stringify({ paragraph, duration, capacity }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        setRoomId(data.roomId);
        setAdminId(data.adminId);
        setPlayerName('Admin');
        
        // Auto-join as admin
        const joinRes = await fetch(`/api/room/${data.roomId}/join`, {
            method: 'POST',
            body: JSON.stringify({ name: 'Admin' }),
        });
        const joinData = await joinRes.json();
        setPlayerId(joinData.playerId);
        setRoomData(joinData.room);
        setView('waiting');
    } catch (e: any) {
        setError(e.message);
    }
  };

  const joinRoom = async () => {
    try {
        const res = await fetch(`/api/room/${roomId}/join`, {
            method: 'POST',
            body: JSON.stringify({ name: playerName }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        setPlayerId(data.playerId);
        setRoomData(data.room);
        setView('waiting');
    } catch (e: any) {
        setError(e.message);
    }
  };

  const startContest = async () => {
    try {
        await fetch(`/api/room/${roomId}/start`, {
            method: 'POST',
            body: JSON.stringify({ adminId }),
        });
    } catch (e: any) {
        setError(e.message);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
        if (view === 'contest' && !isFinished) textareaRef.current?.focus();
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [view, isFinished]);

  // Polling for room updates
  useEffect(() => {
    if (!roomId) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/${roomId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setRoomData(data);
        
        // Handle transitioning views based on room status
        if (data.status === 'starting' && view === 'waiting') {
          const now = Date.now();
          const diff = Math.ceil((data.startTime - now) / 1000);
          setCountdown(diff > 0 ? diff : 0);
          
          if (diff <= 0) {
            setView('contest');
            contestStartTime.current = data.startTime; // Sync to server time
            // Autofocus
            setTimeout(() => textareaRef.current?.focus(), 100);
          }
        }
        
        if (data.status === 'active' && view === 'waiting') {
           setView('contest');
           contestStartTime.current = data.startTime;
        }

        // If time is up based on server clock, finish it
        if (view === 'contest' && !isFinished && data.startTime) {
           const now = Date.now();
           const elapsed = (now - data.startTime) / 1000;
           const remaining = Math.max(0, data.duration - Math.floor(elapsed));
           setTimeLeft(remaining);
           
           if (remaining <= 0) {
              setIsFinished(true);
              updateStats(wpm, accuracy, 100, 'finished');
           }
        }
      } catch (e: any) {
        setError(e.message);
      }
    }, 1000); // Poll more frequently for better sync

    return () => clearInterval(interval);
  }, [roomId, view, isFinished, wpm, accuracy]);

  // Main UI Components
  if (view === 'landing') {
    return (
      <main className="main-container">
        <h1 className="title">SpeedTypers Contest</h1>
        <div className="glass-card" style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div className="input-group">
            <label className="label">Your Name</label>
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Type your nickname..." />
          </div>
          <div className="input-group">
            <label className="label">Room ID (to join)</label>
            <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} placeholder="XXXXXX" />
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <button className="btn btn-primary" onClick={joinRoom} disabled={!playerName || !roomId}>Join Contest</button>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0.5rem 0' }}>or</div>
            <button className="btn btn-secondary" onClick={() => {
              setParagraph(LONG_PARAGRAPHS[Math.floor(Math.random() * LONG_PARAGRAPHS.length)]);
              setView('admin-setup');
            }}>Create New Room (Admin)</button>
          </div>
          {error && <p style={{ color: 'var(--error-color)', marginTop: '1rem', textAlign: 'center' }}>{error}</p>}
        </div>
      </main>
    );
  }

  if (view === 'admin-setup') {
    return (
      <main className="main-container">
        <h1 className="title">Setup Contest</h1>
        <div className="glass-card">
          <div className="input-group">
            <label className="label">Selected Contest Paragraph</label>
            <div className="mono" style={{ 
              background: 'hsla(0, 0%, 0%, 0.2)', 
              padding: '1.5rem', 
              borderRadius: '8px', 
              fontSize: '0.9rem',
              border: '1px solid var(--border-color)',
              marginBottom: '1rem',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {paragraph}
            </div>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }} onClick={() => setParagraph(LONG_PARAGRAPHS[Math.floor(Math.random() * LONG_PARAGRAPHS.length)])}>
              🔄 Re-pick Random Paragraph
            </button>
          </div>
          <div className="grid-2">
            <div className="input-group">
              <label className="label">Duration (seconds)</label>
              <input type="number" min="10" max="600" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="label">Max Capacity</label>
              <input type="number" min="2" max="100" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={createRoom} style={{ flex: 1 }}>Launch Room</button>
            <button className="btn btn-secondary" onClick={() => setView('landing')}>Back</button>
          </div>
          {error && <p style={{ color: 'var(--error-color)', marginTop: '1rem' }}>{error}</p>}
        </div>
      </main>
    );
  }

  if (view === 'waiting') {
    return (
      <main className="main-container">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}>Welcome to Contest</h2>
          <h1 className="title" style={{ fontSize: '3.5rem', margin: '0.5rem 0' }}>{roomId}</h1>
          <p style={{ color: 'var(--text-muted)' }}>Share this ID with participants</p>
        </div>
        
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3>Participants ({roomData?.players?.length || 0} / {roomData?.capacity || 40})</h3>
            {adminId && (
              <button className="btn btn-primary" onClick={startContest} disabled={countdown > 0}>
                {countdown > 0 ? `Starting in ${countdown}...` : 'Start Contest'}
              </button>
            )}
          </div>
          
          <div className="leaderboard">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="leaderboard-cell rank">#</th>
                  <th className="leaderboard-cell">Name</th>
                  <th className="leaderboard-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {roomData?.players?.map((p: any, i: number) => (
                  <tr key={p.id} className="leaderboard-row">
                    <td className="leaderboard-cell rank">{i + 1}</td>
                    <td className="leaderboard-cell player-name">
                      {p.name} {p.id === playerId ? <span className="badge">You</span> : ''}
                      {p.id === roomData.adminId ? <span className="badge" style={{ background: 'hsla(50, 100%, 50%, 0.1)', color: 'hsl(50, 100%, 50%)' }}>Admin</span> : ''}
                    </td>
                    <td className="leaderboard-cell" style={{ color: 'var(--text-muted)' }}>Ready</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    );
  }

  if (view === 'contest') {
    return (
      <main className="main-container">
        <div className="stats-row">
            <div className="stat-card">
                <div className="stat-label">WPM</div>
                <div className="stat-value">{wpm}</div>
            </div>
            <div className="stat-card">
                <div className="stat-label">Accuracy</div>
                <div className="stat-value">{accuracy}%</div>
            </div>
            <div className="stat-card">
                <div className="stat-label">Time</div>
                <div className="stat-value">{timeLeft}s</div>
            </div>
        </div>

        <div className="glass-card">
            <div className="typing-area mono" ref={scrollRef}>
                {roomData.paragraph.split('').map((char: string, i: number) => {
                  let className = 'char';
                  if (i < typedChars.length) {
                    className += typedChars[i] === char ? ' correct' : ' incorrect';
                  } else if (i === typedChars.length) {
                    className += ' current';
                  }
                  return <span key={i} className={className}>{char}</span>;
                })}
            </div>
            
            <textarea
              ref={textareaRef}
              className="mono"
              style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }}
              value={typedChars}
              onChange={handleTyping}
              disabled={isFinished || timeLeft <= 0}
              autoFocus
            />
            {isFinished && <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--correct-color)', fontWeight: '700' }}>Finished! Waiting for others...</div>}
        </div>

        <div className="leaderboard">
            <h3 style={{ marginBottom: '1rem' }}>Live Standings</h3>
            <table className="leaderboard-table">
              <thead>
                <tr>
                    <th className="leaderboard-cell rank">#</th>
                    <th className="leaderboard-cell">Player</th>
                    <th className="leaderboard-cell">Progress</th>
                    <th className="leaderboard-cell">WPM</th>
                    <th className="leaderboard-cell">Acc</th>
                </tr>
              </thead>
              <tbody>
                {roomData?.players?.map((p: any, i: number) => (
                  <tr key={p.id} className="leaderboard-row" style={p.id === playerId ? { background: 'var(--accent-soft)' } : {}}>
                    <td className="leaderboard-cell rank">{i + 1}</td>
                    <td className="leaderboard-cell player-name">{p.name} {p.id === playerId ? '(You)' : ''}</td>
                    <td className="leaderboard-cell">
                        <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px' }}>
                            <div style={{ width: `${p.progress}%`, height: '100%', background: 'var(--accent-color)', borderRadius: '2px', transition: 'width 0.3s' }}></div>
                        </div>
                    </td>
                    <td className="leaderboard-cell wpm">{p.wpm}</td>
                    <td className="leaderboard-cell accuracy">{p.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </main>
    );
  }
}
