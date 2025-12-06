# 3D Maze Labyrinth Game

A real-time multiplayer 3D maze game built with Node.js, Socket.IO, and Three.js.

## Features

- **3D Visualization**: First-person perspective maze navigation with Three.js
- **Multiplayer**: Real-time synchronization using WebSockets (Socket.IO)
- **10 Progressive Rounds**: Each round features a larger, more challenging maze
- **Random Aesthetics**: Each round generates complementary colors and textures
- **Minimap**: 2D overview showing the maze layout and visited areas
- **Leaderboard**: Live scoreboard tracking all players
- **Responsive Controls**: WASD or Arrow keys for navigation

## Installation

```bash
npm install
```

## Running the Game

```bash
npm start
```

Then open your browser to `http://localhost:3000`

## How to Play

1. Use **W/↑** to move forward
2. Use **S/↓** to move backward
3. Use **A/←** to turn left
4. Use **D/→** to turn right
5. Navigate through the maze to reach the glowing goal marker
6. Complete all 10 rounds to finish the game
7. Compete with other players for the highest score!

## Game Mechanics

- **Rounds**: 10 rounds total, with increasing difficulty
- **Maze Size**: Starts at 11x11 and grows to 51x51 by round 10
- **Scoring**: Faster completion times earn higher scores
- **Synchronization**: All players navigate the same maze each round
- **Colors**: Each round features randomly generated complementary colors

## Technical Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript, Three.js
- **Real-time Communication**: WebSockets
- **3D Graphics**: Three.js (WebGL)

## Project Structure

```
maze/
├── server.js           # Node.js server with game logic
├── public/
│   ├── index.html      # Main HTML file
│   └── game.js         # Client-side game logic
├── package.json
└── README.md
```

## Game Flow

1. Players connect to the server via WebSocket
2. Server generates a random maze for the current round
3. All players see the same maze with unique random colors/textures
4. Players navigate to the goal independently
5. Scores are calculated based on completion time
6. After all players finish (or timeout), the next round begins
7. After 10 rounds, the game ends and displays final leaderboard
8. A new game automatically starts

## Browser Compatibility

Modern browsers with WebGL support:
- Chrome/Edge (recommended)
- Firefox
- Safari

## License

ISC
