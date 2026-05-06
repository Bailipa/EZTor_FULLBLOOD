---
name: audio-beat-analyzer
description: Analyze audio files (MP3/WAV) for BPM, beat grid, energy sections, and onset detection. Use when the user needs to sync animations, video edits, or visual effects to music. Outputs a beats.json with timing data. Uses stdlib Python (wave + math) — no external dependencies.
allowed-tools: Bash(afconvert:*), Bash(python3:*)
---

# Audio Beat Analyzer Skill

Analyze audio for BPM, beat positions, and energy-based section detection. Pure Python stdlib — no librosa/ffmpeg required.

## Workflow

### 1. Convert MP3 to WAV
```bash
afconvert -f WAVE -d LEI16 input.mp3 output.wav
```

### 2. Run analysis
```bash
python3 promo/analyze_beat.py input.wav output.json
```

### 3. Output format (beats.json)
```json
{
  "duration": 159.1,
  "bpm": 100,
  "sections": [
    {"label": "intro",    "start": 0,    "end": 12},
    {"label": "buildup",  "start": 12,   "end": 50},
    {"label": "climax",   "start": 50,   "end": 120},
    {"label": "bridge",   "start": 120,  "end": 140},
    {"label": "quiet",    "start": 140,  "end": 159}
  ],
  "energy_per_second": [0.01, 0.03, 0.05, ...]
}
```

### 4. Use in CSS animation
```css
/* Map section.start to animation-delay */
.hero-intro    { animation-delay: 0s; }
.hero-buildup  { animation-delay: 12s; }
.hero-climax   { animation-delay: 50s; }
```

## Notes
- BPM detection works best with percussive music. For ambient/atmospheric music, the section-based energy analysis is more useful.
- The `energy_per_second` array can be used to dynamically adjust visual intensity (opacity, scale, blur).
- Onset detection threshold can be adjusted in the script if needed.
