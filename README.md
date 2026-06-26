# Growdy Landing Page

Landing page for **Growdy** — a crypto play-to-earn game.

## Quick Start

Open `index.html` in your browser, or run a local server:

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

Then visit `http://localhost:8080`

## Structure

```
Growdy/
├── index.html          # Main landing page
├── css/style.css       # Styles (glassmorphism, dark theme)
├── js/main.js          # Wallet connect & stat animations
└── assets/
    ├── logo-icon.svg   # Logo icon
    └── mascot-character.svg  # Growdy mascot
```

## Features

- Dark glassmorphism UI matching the design mockup
- Green candlestick chart background
- Game stats panel (Growdy Length, MPS)
- Token stats panel (Market Cap, Token Price, sparkline)
- About, How to Play, and Tokenomics sections
- Responsive layout for mobile & tablet
- Animated mascot & live stat updates
