PROJECT TITLE
-------------
Lehra – Tabla Practice Companion

PROJECT OVERVIEW
----------------
Build a modern cross-platform mobile application called "Lehra" for Tabla practice (Riyaaz). The app should generate and play loopable Lehra melodies for various Hindustani taals, provide tempo control, pitch control, tanpura drone support, practice tracking, recording, and detailed visual beat indicators.

The goal is to create a professional-quality practice tool that can eventually compete with existing Tabla/Lehra applications while maintaining a clean, modern, musician-focused user experience.

TARGET USERS
------------
- Tabla students
- Professional Tabla players
- Hindustani classical musicians
- Music teachers
- Music academies

TECH STACK
----------
Frontend:
- Flutter (latest stable version)
- Dart

State Management:
- Riverpod

Audio Playback:
- just_audio
- audioplayers (if needed)

Audio Recording:
- record package

Local Storage:
- Hive

Database:
- Hive for local storage
- SQLite (optional for future analytics)

Charts:
- fl_chart

Routing:
- go_router

UI:
- Material 3
- Responsive design
- Dark Mode support

Architecture:
-------------
Follow Clean Architecture:

lib/
 ├── core/
 ├── features/
 │    ├── lehra/
 │    ├── taals/
 │    ├── practice/
 │    ├── recording/
 │    ├── settings/
 │    └── analytics/
 ├── shared/
 └── main.dart

Use:
- Repository Pattern
- Dependency Injection
- SOLID Principles

APP FEATURES
============

1. LEHRA PLAYER
---------------

Support:
- Continuous looping
- High-quality audio playback
- Seamless loop transitions

Instruments:
- Harmonium
- Sarangi
- Sitar
- Flute
- Santoor

User can:
- Select instrument
- Change volume
- Switch lehra variations

2. TAAL SUPPORT
---------------

Version 1 should support:

Teentaal
- 16 Matras
- 4 Vibhaags

Jhaptaal
- 10 Matras

Ektaal
- 12 Matras

Rupak
- 7 Matras

Dadra
- 6 Matras

Keherwa
- 8 Matras

Store each taal with:

{
  name,
  matras,
  vibhaags,
  tali_positions,
  khali_positions,
  theka
}

3. TEMPO CONTROL
----------------

BPM Range:
30 BPM – 500 BPM

Features:
- BPM Slider
- + / - Buttons
- Direct BPM Input
- Tap Tempo

Tempo changes should happen smoothly while playback is running.

4. PITCH CONTROL
----------------

Support:

C
C#
D
D#
E
F
F#
G
G#
A
A#
B

Features:
- Pitch selector
- Male scale presets
- Female scale presets

5. VISUAL TAAL TRACKER
----------------------

Display:

- Current matra
- Current vibhaag
- Sam indicator
- Tali indicator
- Khali indicator

Example Teentaal:

X | 2 | 0 | 3

1 2 3 4
5 6 7 8
9 10 11 12
13 14 15 16

Current beat should be highlighted in real time.

6. SAM INDICATOR
----------------

Features:
- Animated pulse
- Color highlight
- Optional sound accent

Must clearly indicate arrival at Sam.

7. TANPURA DRONE
----------------

Options:
- Sa
- Sa Pa
- Sa Ma

Features:
- Independent volume control
- Can play with lehra
- Continuous loop

8. METRONOME
------------

Modes:
- Standard click
- Taal-aware click
- Sam accent mode

Controls:
- Enable/Disable
- Volume control

9. PRACTICE TIMER
-----------------

Modes:

- 5 minutes
- 10 minutes
- 15 minutes
- 30 minutes
- 60 minutes
- Unlimited

Display:
- Elapsed time
- Remaining time

10. PRACTICE LOGS
-----------------

Track:

Date
Duration
Taal
BPM
Instrument

Store locally.

11. RECORDING
-------------

Allow user to:

- Record practice session
- Save recording
- Rename recording
- Playback recording
- Delete recording

Formats:
- WAV
- M4A

12. ANALYTICS
-------------

Dashboard should display:

- Total practice hours
- Sessions completed
- Most practiced taal
- Average BPM
- Longest session

Charts:
- Weekly practice graph
- Monthly practice graph

13. SETTINGS
------------

Options:

- Dark Mode
- Light Mode
- Default BPM
- Default Taal
- Default Instrument

14. OFFLINE MODE
----------------

Entire application should function offline.

No login required.

No backend required for Version 1.

USER INTERFACE
==============

Design Style:
- Modern
- Minimal
- Professional musician-focused

Screens:
--------

1. Splash Screen

2. Home Screen
   - Play button
   - Current taal
   - BPM display
   - Instrument selection

3. Player Screen
   - Large BPM display
   - Beat tracker
   - Sam indicator
   - Playback controls

4. Practice Analytics Screen

5. Recordings Screen

6. Settings Screen

7. Taal Information Screen

NON-FUNCTIONAL REQUIREMENTS
===========================

- Smooth playback
- Low battery consumption
- Works on Android and iOS
- Clean Architecture
- Unit tests
- Widget tests
- Well-documented code
- Modular feature-based structure
- Production-ready codebase

FUTURE ROADMAP (DO NOT IMPLEMENT YET)
=====================================

Phase 2:
- AI tempo detection using microphone
- Sam accuracy analysis
- Lay consistency analysis
- Cloud sync
- User accounts

Phase 3:
- Custom lehra composer
- Community lehra sharing
- Teacher/student mode
- Online backup

DELIVERABLES
============

Generate:
1. Complete Flutter project structure
2. Clean Architecture implementation
3. All screens
4. Riverpod state management
5. Audio engine integration
6. Local storage integration
7. Practice analytics
8. Recording functionality
9. Responsive UI
10. Production-ready source code

The generated code should be modular, scalable, maintainable, and suitable for publishing on the Google Play Store and Apple App Store.