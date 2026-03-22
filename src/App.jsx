import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

const TAPE_COLORS = [
  'rgba(224, 160, 48, 0.35)',   // gold
  'rgba(45, 106, 79, 0.3)',     // jade green
  'rgba(204, 85, 68, 0.3)',     // rose
  'rgba(184, 200, 216, 0.4)',   // sky blue
  'rgba(196, 101, 42, 0.3)',    // terracotta
  'rgba(221, 184, 138, 0.4)',   // tan
  'rgba(122, 26, 32, 0.25)',    // deep red
  'rgba(240, 224, 106, 0.35)',  // yellow
];

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

function getTapeColor(dateKey) {
  const seed = dateKey.split('-').reduce((a, b) => a + parseInt(b), 0);
  return TAPE_COLORS[Math.abs(seed * 7) % TAPE_COLORS.length];
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
  const tapeColor = getTapeColor(dateKey);
  const fileInputRef = useRef(null);
  const [captionInput, setCaptionInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [promptStep, setPromptStep] = useState(null); // null | 'caption' | 'notes'
  const pendingFile = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFile.current = file;
    setPromptStep('caption');
  };

  const handleCaptionNext = () => {
    setPromptStep('notes');
  };

  const handleSkipCaption = () => {
    setCaptionInput('');
    setPromptStep('notes');
  };

  const handleSave = () => {
    if (pendingFile.current) {
      onUpload(dateKey, pendingFile.current, captionInput.trim(), notesInput.trim());
      pendingFile.current = null;
      setCaptionInput('');
      setNotesInput('');
      setPromptStep(null);
    }
  };

  const handleSkipNotes = () => {
    if (pendingFile.current) {
      onUpload(dateKey, pendingFile.current, captionInput.trim(), '');
      pendingFile.current = null;
      setCaptionInput('');
      setNotesInput('');
      setPromptStep(null);
    }
  };

  // Filled slot
  if (photo && !promptStep) {
    const handleReplace = (e) => {
      e.stopPropagation();
      fileInputRef.current?.click();
    };
    return (
      <div className={`photo-slot filled ${tapeClass}`} style={{ '--rotation': `${rotation}deg`, '--tape-color': tapeColor }}
        onClick={() => onView({ ...photo, dateKey })} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onView({ ...photo, dateKey })}>
        <div className="polaroid">
          <img src={photo.url} alt={`Day ${dayNum}`} loading="lazy" />
          <div className="polaroid-footer">
            <span className="photo-date">{formatDateLabel(dateKey)}</span>
            {photo.caption && <p className="photo-caption">{photo.caption}</p>}
          </div>
          <button className="replace-btn" onClick={handleReplace} aria-label="Replace photo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileSelect} hidden />
      </div>
    );
  }

  // Caption prompt (step 1)
  if (promptStep === 'caption') {
    return (
      <div className="photo-slot caption-prompt" style={{ '--rotation': '0deg' }}>
        <div className="caption-prompt-inner">
          <p className="caption-prompt-title">Add a caption? (optional)</p>
          <input type="text" maxLength={100} value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            placeholder="What's the story?" className="caption-input" autoFocus />
          <div className="caption-buttons">
            <button onClick={handleSkipCaption} className="btn-skip">Skip</button>
            <button onClick={handleCaptionNext} className="btn-save">Next</button>
          </div>
        </div>
      </div>
    );
  }

  // Notes prompt (step 2)
  if (promptStep === 'notes') {
    return (
      <div className="photo-slot caption-prompt" style={{ '--rotation': '0deg' }}>
        <div className="caption-prompt-inner">
          <p className="caption-prompt-title">Any notes? (optional)</p>
          <textarea maxLength={150} value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="Thoughts, feelings, details..."
            className="caption-input notes-textarea" autoFocus rows={3} />
          <div className="caption-buttons">
            <button onClick={handleSkipNotes} className="btn-skip">Skip</button>
            <button onClick={handleSave} className="btn-save">Save</button>
          </div>
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <div className={`photo-slot empty ${isFuture ? 'future' : 'ready'} ${tapeClass}`}
      style={{ '--rotation': `${rotation}deg`, '--tape-color': tapeColor }}
      onClick={() => !isFuture && fileInputRef.current?.click()}
      role={isFuture ? undefined : 'button'}
      tabIndex={isFuture ? undefined : 0}
      onKeyDown={(e) => !isFuture && e.key === 'Enter' && fileInputRef.current?.click()}>
      <div className="polaroid">
        <div className="polaroid-image-area empty-image-area">
          <div className="empty-inner">
            <svg className="mountain-icon" viewBox="0 0 40 40" width="40" height="40">
              <path d="M5 35 L20 10 L35 35 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 35 L22 20 L32 35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5"/>
              <circle cx="30" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className="empty-label">
              {isFuture ? `Day ${dayNum} — awaiting adventure` : `Day ${dayNum} — tap to add`}
            </span>
          </div>
        </div>
        <div className="polaroid-footer">
          <span className="photo-date">{formatDateLabel(dateKey)}</span>
        </div>
      </div>
      {!isFuture && (
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileSelect} hidden />
      )}
    </div>
  );
}

// ── Peek Card (miniature polaroid on the sides) ──
function PeekCard({ dateKey, photo }) {
  const dayNum = getDayNumber(dateKey);
  const rotation = getRotation(dateKey);
  const tapeClass = getTapeStyle(dateKey);
  const tapeColor = getTapeColor(dateKey);

  return (
    <div className={`peek-card ${tapeClass}`} style={{ '--rotation': `${rotation}deg`, '--tape-color': tapeColor }}>
      <div className="polaroid">
        {photo ? (
          <img src={photo.url} alt={`Day ${dayNum}`} />
        ) : (
          <div className="polaroid-image-area empty-image-area">
            <div className="empty-inner">
              <svg className="mountain-icon" viewBox="0 0 40 40" width="40" height="40">
                <path d="M5 35 L20 10 L35 35 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M12 35 L22 20 L32 35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5"/>
                <circle cx="30" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span className="empty-label">Day {dayNum}</span>
            </div>
          </div>
        )}
        <div className="polaroid-footer">
          <span className="photo-date">{formatDateLabel(dateKey)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Day Carousel ───────────────────────────────────────────
function DayCarousel({ dates, photos, onUpload, onView }) {
  // Chronological order — left is past, right is future
  const today = toDateKey(new Date());
  const initialIndex = useMemo(() => {
    const todayIdx = dates.findIndex((d) => d >= today);
    return todayIdx >= 0 ? todayIdx : dates.length - 1;
  }, [dates, today]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStart = useRef({ x: 0, y: 0 });
  const touchDelta = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef(null);

  const goTo = useCallback((idx) => {
    setCurrentIndex(Math.max(0, Math.min(idx, dates.length - 1)));
  }, [dates.length]);

  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchDelta.current = 0;
    setDragging(true);
  };

  const handleTouchMove = (e) => {
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      touchDelta.current = dx;
      setDragOffset(dx);
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    setDragOffset(0);
    const threshold = 50;
    if (touchDelta.current < -threshold) {
      goTo(currentIndex + 1); // swipe left → forward in time
    } else if (touchDelta.current > threshold) {
      goTo(currentIndex - 1); // swipe right → back in time
    }
    touchDelta.current = 0;
  };

  const mouseStart = useRef(null);
  const handleMouseDown = (e) => {
    mouseStart.current = e.clientX;
    touchDelta.current = 0;
    setDragging(true);
  };

  const handleMouseMove = (e) => {
    if (mouseStart.current === null) return;
    const dx = e.clientX - mouseStart.current;
    touchDelta.current = dx;
    setDragOffset(dx);
  };

  const handleMouseUp = () => {
    if (mouseStart.current === null) return;
    setDragging(false);
    setDragOffset(0);
    const threshold = 50;
    if (touchDelta.current < -threshold) {
      goTo(currentIndex + 1);
    } else if (touchDelta.current > threshold) {
      goTo(currentIndex - 1);
    }
    mouseStart.current = null;
    touchDelta.current = 0;
  };

  const currentDate = dates[currentIndex];
  const prevDate = currentIndex > 0 ? dates[currentIndex - 1] : null;
  const nextDate = currentIndex < dates.length - 1 ? dates[currentIndex + 1] : null;

  return (
    <section className="carousel-section">
      <div
        className="carousel-track-wrapper"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={dragging ? handleMouseMove : undefined}
        onMouseUp={handleMouseUp}
        onMouseLeave={dragging ? handleMouseUp : undefined}
      >
        <div className="carousel-track" style={{
          transform: `translateX(${dragOffset}px)`,
          transition: dragging ? 'none' : 'transform 0.3s ease',
        }}>
          {/* Left peek */}
          <div className="carousel-peek">
            {prevDate && <PeekCard dateKey={prevDate} photo={photos[prevDate] || null} />}
          </div>

          {/* Active card */}
          <div className="carousel-slide-active">
            <PhotoSlot dateKey={currentDate}
              photo={photos[currentDate] || null}
              onUpload={onUpload} onView={onView} />
          </div>

          {/* Right peek */}
          <div className="carousel-peek">
            {nextDate && <PeekCard dateKey={nextDate} photo={photos[nextDate] || null} />}
          </div>
        </div>
      </div>

      {/* Navigation — left = back, right = forward */}
      <div className="carousel-nav">
        <button
          className="carousel-arrow"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          aria-label="Previous day"
        >
          <svg width="12" height="15" viewBox="0 0 14 18"><polygon points="14,0 0,9 14,18" fill="currentColor"/></svg>
        </button>
        <span className="carousel-indicator">
          {getDayNumber(currentDate)} / {dates.length}
        </span>
        <button
          className="carousel-arrow"
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === dates.length - 1}
          aria-label="Next day"
        >
          <svg width="12" height="15" viewBox="0 0 14 18"><polygon points="0,0 14,9 0,18" fill="currentColor"/></svg>
        </button>
      </div>
    </section>
  );
}

// ── Fullscreen Viewer ──────────────────────────────────────
function formatStickyDate(dateKey) {
  if (!dateKey) return '';
  const d = new Date(dateKey + 'T12:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

function FullscreenViewer({ photo, onClose }) {
  if (!photo) return null;
  return (
    <div className="fullscreen-overlay" onClick={onClose}>
      <button className="fullscreen-close" onClick={onClose} aria-label="Close">&times;</button>
      <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
        <div className="fullscreen-polaroid">
          <img src={photo.url} alt="Full view" className="fullscreen-img" />
          {photo.caption && <p className="fullscreen-caption">{photo.caption}</p>}
        </div>
        <div className="sticky-note">
          <div className="sticky-tape" />
          <span className="sticky-date">{formatStickyDate(photo.dateKey)}</span>
          <p className="sticky-text">{photo.notes || '\u00A0'}</p>
          <div className="sticky-fold" />
        </div>
      </div>
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
        map[entry.date] = { url, caption: entry.caption, notes: entry.notes || '', blob: entry.blob, dateKey: entry.date };
      }
      setPhotos(map);
    }
    load();
  }, []);

  const filledCount = Object.keys(photos).length;
  const progress = totalDays > 0 ? filledCount / totalDays : 0;

  const handleUpload = async (dateKey, file, caption, notes = '') => {
    await db.photos.put({ date: dateKey, caption, notes, blob: file });
    const url = URL.createObjectURL(file);
    setPhotos((prev) => ({ ...prev, [dateKey]: { url, caption, notes, blob: file, dateKey } }));
  };

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

      <DayCarousel dates={allDates} photos={photos} onUpload={handleUpload} onView={setViewerPhoto} />

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
