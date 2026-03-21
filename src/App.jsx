import { useState, useEffect, useRef, useMemo } from 'react';
import db from './db';
import './App.css';

// ── Constants ──────────────────────────────────────────────
const SUMMIT_DAY = new Date('2026-04-15');
const TRIP_END = new Date('2026-04-18');
const START_DATE = new Date('2026-03-21');

const ITINERARY = [
  { date: 'April 12', label: 'Travel day' },
  { date: 'April 13', label: 'Antigua exploration' },
  { date: 'April 14', label: 'Hike begins' },
  { date: 'April 15', label: 'Summit day 🌋' },
  { date: 'April 16', label: 'Descent' },
  { date: 'April 17', label: 'Recovery & explore' },
  { date: 'April 18', label: 'Departure' },
];

const TAPE_STYLES = ['tape-top-left', 'tape-top-right', 'tape-both', 'tape-center'];

// ── Helpers ────────────────────────────────────────────────
function toDateKey(d) {
  return d.toISOString().split('T')[0];
}

function getDaysBetween(a, b) {
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}

function getAllDates() {
  const dates = [];
  const cur = new Date(START_DATE);
  const end = new Date(TRIP_END);
  while (cur <= end) {
    dates.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getRotation(dateKey) {
  const seed = dateKey.split('-').reduce((a, b) => a + parseInt(b), 0);
  return (seededRandom(seed) * 6 - 3).toFixed(1);
}

function getTapeStyle(dateKey) {
  const seed = dateKey.split('-').reduce((a, b) => a * parseInt(b), 1);
  return TAPE_STYLES[Math.abs(seed) % TAPE_STYLES.length];
}

function formatDateLabel(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDayNumber(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  return getDaysBetween(START_DATE, d) + 1;
}

// ── Mountain Trail SVG ─────────────────────────────────────
function MountainTrail({ progress, filled, total }) {
  const trailPath = "M 30 280 Q 60 260 50 240 Q 35 220 65 200 Q 90 185 75 160 Q 55 140 80 120 Q 100 105 90 85 Q 75 65 100 50 Q 120 38 130 20";
  const pathLength = 420;
  const hikerOffset = progress * pathLength;

  return (
    <div className="trail-container">
      <svg viewBox="0 0 200 300" className="trail-svg" aria-label={`Progress: ${filled} of ${total} days logged`}>
        {/* Mountain silhouette */}
        <path d="M 0 300 L 60 100 L 80 140 L 130 20 L 170 120 L 200 300 Z" fill="var(--volcanic-black)" opacity="0.12" />
        {/* Snow cap */}
        <path d="M 110 40 L 130 20 L 148 55 L 135 50 L 125 58 Z" fill="var(--parchment)" opacity="0.5" />

        {/* Trail background (dashed) */}
        <path d={trailPath} fill="none" stroke="var(--terracotta)" strokeWidth="3" strokeDasharray="6 4" opacity="0.3" strokeLinecap="round" />
        {/* Trail progress (solid) */}
        <path d={trailPath} fill="none" stroke="var(--terracotta)" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={pathLength} strokeDashoffset={pathLength - hikerOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />

        {/* Start marker */}
        <circle cx="30" cy="280" r="4" fill="var(--jade)" />
        <text x="42" y="284" className="trail-label" fill="var(--jade)">Start</text>

        {/* Summit flag */}
        <g transform="translate(130, 12)">
          <line x1="0" y1="0" x2="0" y2="-14" stroke="var(--terracotta)" strokeWidth="1.5" />
          <polygon points="0,-14 12,-10 0,-6" fill="var(--terracotta)" />
        </g>

        {/* Hiker dot */}
        <circle r="6" fill="var(--terracotta)" stroke="var(--parchment)" strokeWidth="2"
          style={{ transition: 'all 0.8s ease' }}>
          <animateMotion dur="0.01s" fill="freeze" keyPoints={`${progress};${progress}`} keyTimes="0;1" calcMode="linear">
            <mpath href="#hikerPath" />
          </animateMotion>
        </circle>
        <path id="hikerPath" d={trailPath} fill="none" stroke="none" />

        {/* Decorative trees */}
        <g opacity="0.25" fill="var(--jade)">
          <polygon points="15,265 20,250 25,265" />
          <polygon points="160,250 165,238 170,250" />
          <polygon points="40,220 44,210 48,220" />
          <polygon points="145,180 149,170 153,180" />
        </g>
      </svg>
      <p className="trail-count">{filled} of {total} days logged</p>
    </div>
  );
}

// ── Photo Slot ─────────────────────────────────────────────
function PhotoSlot({ dateKey, photo, onUpload, onView }) {
  const today = toDateKey(new Date());
  const isFuture = dateKey > today;
  const dayNum = getDayNumber(dateKey);
  const rotation = getRotation(dateKey);
  const tapeClass = getTapeStyle(dateKey);
  const fileInputRef = useRef(null);
  const [captionInput, setCaptionInput] = useState('');
  const [showCaptionPrompt, setShowCaptionPrompt] = useState(false);
  const pendingFile = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFile.current = file;
    setShowCaptionPrompt(true);
  };

  const handleSave = () => {
    if (pendingFile.current) {
      onUpload(dateKey, pendingFile.current, captionInput.trim());
      pendingFile.current = null;
      setCaptionInput('');
      setShowCaptionPrompt(false);
    }
  };

  const handleSkipCaption = () => {
    if (pendingFile.current) {
      onUpload(dateKey, pendingFile.current, '');
      pendingFile.current = null;
      setCaptionInput('');
      setShowCaptionPrompt(false);
    }
  };

  // Filled slot
  if (photo) {
    return (
      <div className={`photo-slot filled ${tapeClass}`} style={{ '--rotation': `${rotation}deg` }}
        onClick={() => onView(photo)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onView(photo)}>
        <div className="polaroid">
          <img src={photo.url} alt={`Day ${dayNum}`} loading="lazy" />
          <div className="polaroid-footer">
            <span className="photo-date">{formatDateLabel(dateKey)}</span>
            {photo.caption && <p className="photo-caption">{photo.caption}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Caption prompt
  if (showCaptionPrompt) {
    return (
      <div className="photo-slot caption-prompt" style={{ '--rotation': '0deg' }}>
        <div className="caption-prompt-inner">
          <p className="caption-prompt-title">Add a caption? (optional)</p>
          <input type="text" maxLength={100} value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            placeholder="What's the story?" className="caption-input" autoFocus />
          <div className="caption-buttons">
            <button onClick={handleSkipCaption} className="btn-skip">Skip</button>
            <button onClick={handleSave} className="btn-save">Save</button>
          </div>
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <div className={`photo-slot empty ${isFuture ? 'future' : 'ready'}`}
      style={{ '--rotation': `${rotation}deg` }}
      onClick={() => !isFuture && fileInputRef.current?.click()}
      role={isFuture ? undefined : 'button'}
      tabIndex={isFuture ? undefined : 0}
      onKeyDown={(e) => !isFuture && e.key === 'Enter' && fileInputRef.current?.click()}>
      <div className="empty-inner">
        <svg className="mountain-icon" viewBox="0 0 40 40" width="40" height="40">
          <path d="M5 35 L20 10 L35 35 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M12 35 L22 20 L32 35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5"/>
          <circle cx="30" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <span className="empty-label">
          {isFuture ? `Day ${dayNum} — awaiting adventure` : `Day ${dayNum} — tap to add`}
        </span>
        <span className="empty-date">{formatDateLabel(dateKey)}</span>
      </div>
      {!isFuture && (
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileSelect} hidden />
      )}
    </div>
  );
}

// ── Fullscreen Viewer ──────────────────────────────────────
function FullscreenViewer({ photo, onClose }) {
  if (!photo) return null;
  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <button className="fullscreen-close" onClick={onClose} aria-label="Close">&times;</button>
      <img src={photo.url} alt="Full view" className="fullscreen-img" />
      {photo.caption && <p className="fullscreen-caption">{photo.caption}</p>}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const [photos, setPhotos] = useState({});
  const [viewerPhoto, setViewerPhoto] = useState(null);

  const allDates = useMemo(() => getAllDates(), []);
  const totalDays = allDates.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilSummit = Math.max(0, getDaysBetween(today, SUMMIT_DAY));

  // Load photos from IndexedDB
  useEffect(() => {
    async function load() {
      const all = await db.photos.toArray();
      const map = {};
      for (const entry of all) {
        const url = URL.createObjectURL(entry.blob);
        map[entry.date] = { url, caption: entry.caption, blob: entry.blob };
      }
      setPhotos(map);
    }
    load();
  }, []);

  const filledCount = Object.keys(photos).length;
  const progress = totalDays > 0 ? filledCount / totalDays : 0;

  const handleUpload = async (dateKey, file, caption) => {
    await db.photos.put({ date: dateKey, caption, blob: file });
    const url = URL.createObjectURL(file);
    setPhotos((prev) => ({ ...prev, [dateKey]: { url, caption, blob: file } }));
  };

  const sortedDates = [...allDates].reverse();

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Road to Acatenango <span className="title-emoji">🌋</span></h1>
        <p className="countdown">
          {daysUntilSummit > 0
            ? <><strong>{daysUntilSummit}</strong> days until summit day</>
            : 'Summit day has arrived!'}
        </p>
      </header>

      <MountainTrail progress={progress} filled={filledCount} total={totalDays} />

      <section className="photo-feed">
        {sortedDates.map((dateKey) => (
          <PhotoSlot key={dateKey} dateKey={dateKey} photo={photos[dateKey] || null}
            onUpload={handleUpload} onView={setViewerPhoto} />
        ))}
      </section>

      <section className="itinerary">
        <h2 className="itinerary-title">Trip Itinerary</h2>
        <ul className="itinerary-list">
          {ITINERARY.map((item) => (
            <li key={item.date} className="itinerary-item">
              <span className="itinerary-date">{item.date}</span>
              <span className="itinerary-label">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <FullscreenViewer photo={viewerPhoto} onClose={() => setViewerPhoto(null)} />
    </div>
  );
}
