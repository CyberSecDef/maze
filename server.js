const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use(express.static('public'));

// Game state
let gameState = {
    currentRound: 1,
    maxRounds: 10,
    maze: null,
    players: {},
    leaderboard: [],
    roundActive: false,
    roundStartTime: null
};

// Maze generation using recursive backtracking
function generateMaze(size) {
    const maze = Array(size).fill().map(() => Array(size).fill(0));
    const visited = Array(size).fill().map(() => Array(size).fill(false));
    
    function isValid(x, y) {
        return x >= 0 && x < size && y >= 0 && y < size;
    }
    
    function carve(x, y) {
        visited[y][x] = true;
        maze[y][x] = 1; // 1 means walkable
        
        const directions = [
            [0, -2], [2, 0], [0, 2], [-2, 0]
        ].sort(() => Math.random() - 0.5);
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (isValid(nx, ny) && !visited[ny][nx]) {
                maze[y + dy/2][x + dx/2] = 1;
                carve(nx, ny);
            }
        }
    }
    
    carve(1, 1);
    maze[1][1] = 1; // Start
    maze[size-2][size-2] = 1; // End
    
    return maze;
}

// Calculate maze size based on round
function getMazeSize(round) {
    return Math.min(11 + (round - 1) * 4, 51); // Odd numbers from 11 to 51
}

// Generate complementary colors
function generateComplementaryColors() {
    const hue = Math.random() * 360;
    const complementHue = (hue + 180) % 360;
    
    return {
        primary: `hsl(${hue}, 70%, 50%)`,
        secondary: `hsl(${complementHue}, 70%, 50%)`,
        wall: `hsl(${hue}, 50%, 30%)`,
        floor: `hsl(${hue}, 20%, 80%)`,
        ceiling: `hsl(${hue}, 30%, 60%)`
    };
}

// Start a new round
function startNewRound() {
    const size = getMazeSize(gameState.currentRound);
    gameState.maze = generateMaze(size);
    gameState.roundActive = true;
    gameState.roundStartTime = Date.now();
    gameState.colors = generateComplementaryColors();
    
    // Reset player positions
    Object.keys(gameState.players).forEach(id => {
        gameState.players[id].position = { x: 1, z: 1 };
        gameState.players[id].visited = new Set();
        gameState.players[id].finished = false;
        gameState.players[id].visited.add('1,1');
    });
    
    io.emit('roundStart', {
        round: gameState.currentRound,
        maze: gameState.maze,
        colors: gameState.colors,
        size: size
    });
}

// Handle socket connections
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    // Add new player
    gameState.players[socket.id] = {
        id: socket.id,
        name: `Player${Object.keys(gameState.players).length + 1}`,
        position: { x: 1, z: 1 },
        score: 0,
        visited: new Set(['1,1']),
        finished: false
    };
    
    // Send current game state to new player
    socket.emit('gameState', {
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        maze: gameState.maze,
        colors: gameState.colors,
        players: Object.values(gameState.players),
        leaderboard: gameState.leaderboard
    });
    
    // Handle player movement
    socket.on('move', (data) => {
        const player = gameState.players[socket.id];
        if (!player || !gameState.roundActive || player.finished) return;
        
        const { x, z } = data;
        const size = gameState.maze.length;
        
        // Validate movement
        if (x >= 0 && x < size && z >= 0 && z < size && gameState.maze[z][x] === 1) {
            player.position = { x, z };
            player.visited.add(`${x},${z}`);
            
            // Check if player reached the end
            if (x === size - 2 && z === size - 2) {
                player.finished = true;
                const timeTaken = Date.now() - gameState.roundStartTime;
                const roundScore = Math.max(1000 - Math.floor(timeTaken / 100), 100);
                player.score += roundScore;
                
                socket.emit('roundComplete', {
                    score: roundScore,
                    totalScore: player.score
                });
                
                // Check if all players finished
                const allFinished = Object.values(gameState.players).every(p => p.finished);
                if (allFinished) {
                    endRound();
                }
            }
            
            // Broadcast player position
            io.emit('playerMove', {
                playerId: socket.id,
                position: player.position
            });
        }
    });
    
    // Handle player name change
    socket.on('setName', (name) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].name = name;
            io.emit('playerUpdate', Object.values(gameState.players));
        }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete gameState.players[socket.id];
        io.emit('playerUpdate', Object.values(gameState.players));
    });
});

// End current round
function endRound() {
    gameState.roundActive = false;
    
    // Update leaderboard
    gameState.leaderboard = Object.values(gameState.players)
        .map(p => ({ name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    
    io.emit('roundEnd', {
        leaderboard: gameState.leaderboard
    });
    
    // Move to next round or end game
    if (gameState.currentRound < gameState.maxRounds) {
        setTimeout(() => {
            gameState.currentRound++;
            startNewRound();
        }, 3000);
    } else {
        io.emit('gameEnd', {
            leaderboard: gameState.leaderboard
        });
        
        // Reset game after delay
        setTimeout(() => {
            gameState.currentRound = 1;
            Object.keys(gameState.players).forEach(id => {
                gameState.players[id].score = 0;
            });
            startNewRound();
        }, 10000);
    }
}

// Start first round when first player connects
io.on('connection', (socket) => {
    if (Object.keys(gameState.players).length === 1 && !gameState.maze) {
        setTimeout(() => startNewRound(), 2000);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Maze game server running on port ${PORT}`);
});
