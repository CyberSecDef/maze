// Game state
let socket;
let scene, camera, renderer;
let maze = null;
let mazeSize = 0;
let playerPosition = { x: 1, z: 1 };
let playerRotation = 0;
let colors = {};
let currentRound = 1;
let maxRounds = 10;
let score = 0;
let visited = new Set(['1,1']);
let mazeObjects = [];
let goalMarker = null;

// Movement
let moveSpeed = 0.1;
let keys = {};

// Initialize
function init() {
    // Connect to socket
    socket = io();
    
    // Setup Three.js
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.y = 0.5;
    
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Socket events
    socket.on('gameState', (data) => {
        currentRound = data.currentRound;
        maxRounds = data.maxRounds;
        if (data.maze) {
            maze = data.maze;
            mazeSize = data.maze.length;
            colors = data.colors;
            createMaze();
        }
        updateLeaderboard(data.leaderboard || []);
        updateUI();
    });
    
    socket.on('roundStart', (data) => {
        currentRound = data.round;
        maze = data.maze;
        mazeSize = data.size;
        colors = data.colors;
        playerPosition = { x: 1, z: 1 };
        playerRotation = 0;
        visited = new Set(['1,1']);
        createMaze();
        updateUI();
        showMessage(`Round ${currentRound} - GO!`, 2000);
    });
    
    socket.on('roundComplete', (data) => {
        score = data.totalScore;
        updateUI();
        showMessage(`Round Complete!<br>+${data.score} points`, 2000);
    });
    
    socket.on('roundEnd', (data) => {
        updateLeaderboard(data.leaderboard);
    });
    
    socket.on('gameEnd', (data) => {
        updateLeaderboard(data.leaderboard);
        showMessage('Game Over!<br>New game starting soon...', 8000);
    });
    
    socket.on('playerMove', (data) => {
        // Handle other players' movements if needed
    });
    
    socket.on('playerUpdate', (players) => {
        // Handle player list updates
    });
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        keys[e.key] = true;
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
        keys[e.key] = false;
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Start animation loop
    animate();
}

// Create 3D maze
function createMaze() {
    // Clear existing maze
    mazeObjects.forEach(obj => scene.remove(obj));
    mazeObjects = [];
    if (goalMarker) scene.remove(goalMarker);
    
    if (!maze || !colors) return;
    
    const wallHeight = 2;
    const cellSize = 1;
    
    // Create texture with random pattern
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Random brick-like pattern
    ctx.fillStyle = colors.wall;
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
        ctx.strokeRect(0, i * 8, 64, 8);
        ctx.strokeRect((i % 2) * 32, i * 8, 32, 8);
    }
    
    const wallTexture = new THREE.CanvasTexture(canvas);
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    
    // Wall material
    const wallMaterial = new THREE.MeshStandardMaterial({
        map: wallTexture,
        color: colors.wall
    });
    
    // Floor material
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: colors.floor
    });
    
    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(mazeSize * cellSize, mazeSize * cellSize);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mazeSize * cellSize / 2, 0, mazeSize * cellSize / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    mazeObjects.push(floor);
    
    // Create ceiling
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        color: colors.ceiling
    });
    const ceiling = new THREE.Mesh(floorGeometry.clone(), ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(mazeSize * cellSize / 2, wallHeight, mazeSize * cellSize / 2);
    scene.add(ceiling);
    mazeObjects.push(ceiling);
    
    // Create walls
    const wallGeometry = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
    
    for (let z = 0; z < mazeSize; z++) {
        for (let x = 0; x < mazeSize; x++) {
            if (maze[z][x] === 0) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(x * cellSize + cellSize / 2, wallHeight / 2, z * cellSize + cellSize / 2);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                mazeObjects.push(wall);
            }
        }
    }
    
    // Create goal marker
    const goalGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32);
    const goalMaterial = new THREE.MeshStandardMaterial({
        color: colors.secondary,
        emissive: colors.secondary,
        emissiveIntensity: 0.5
    });
    goalMarker = new THREE.Mesh(goalGeometry, goalMaterial);
    goalMarker.position.set((mazeSize - 2) * cellSize + cellSize / 2, 0.05, (mazeSize - 2) * cellSize + cellSize / 2);
    scene.add(goalMarker);
    
    // Update scene background
    scene.background = new THREE.Color(colors.floor);
    scene.fog = new THREE.Fog(colors.floor, 1, 20);
    
    // Update minimap
    drawMinimap();
}

// Handle player movement
function handleMovement() {
    if (!maze) return;
    
    const rotationSpeed = 0.05;
    
    // Rotation
    if (keys['a'] || keys['ArrowLeft']) {
        playerRotation += rotationSpeed;
    }
    if (keys['d'] || keys['ArrowRight']) {
        playerRotation -= rotationSpeed;
    }
    
    // Movement
    let newX = playerPosition.x;
    let newZ = playerPosition.z;
    
    if (keys['w'] || keys['ArrowUp']) {
        newX += Math.sin(playerRotation) * moveSpeed;
        newZ += Math.cos(playerRotation) * moveSpeed;
    }
    if (keys['s'] || keys['ArrowDown']) {
        newX -= Math.sin(playerRotation) * moveSpeed;
        newZ -= Math.cos(playerRotation) * moveSpeed;
    }
    
    // Check collision
    const gridX = Math.floor(newX);
    const gridZ = Math.floor(newZ);
    
    if (gridX >= 0 && gridX < mazeSize && gridZ >= 0 && gridZ < mazeSize) {
        if (maze[gridZ][gridX] === 1) {
            playerPosition.x = newX;
            playerPosition.z = newZ;
            
            // Mark as visited
            const key = `${gridX},${gridZ}`;
            if (!visited.has(key)) {
                visited.add(key);
                drawMinimap();
            }
            
            // Check if reached goal
            if (gridX === mazeSize - 2 && gridZ === mazeSize - 2) {
                socket.emit('move', { x: gridX, z: gridZ });
            }
        }
    }
    
    // Update camera
    camera.position.x = playerPosition.x;
    camera.position.z = playerPosition.z;
    camera.rotation.y = playerRotation;
}

// Draw minimap
function drawMinimap() {
    const canvas = document.getElementById('minimapCanvas');
    const ctx = canvas.getContext('2d');
    const size = 200;
    
    if (!maze) return;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    
    const cellSize = size / mazeSize;
    
    // Draw maze
    for (let z = 0; z < mazeSize; z++) {
        for (let x = 0; x < mazeSize; x++) {
            if (maze[z][x] === 1) {
                ctx.fillStyle = visited.has(`${x},${z}`) ? '#666' : '#333';
                ctx.fillRect(x * cellSize, z * cellSize, cellSize, cellSize);
            } else {
                ctx.fillStyle = '#000';
                ctx.fillRect(x * cellSize, z * cellSize, cellSize, cellSize);
            }
        }
    }
    
    // Draw goal
    ctx.fillStyle = colors.secondary || '#0f0';
    ctx.fillRect((mazeSize - 2) * cellSize, (mazeSize - 2) * cellSize, cellSize, cellSize);
    
    // Draw player
    const px = Math.floor(playerPosition.x);
    const pz = Math.floor(playerPosition.z);
    ctx.fillStyle = colors.primary || '#f00';
    ctx.beginPath();
    ctx.arc(px * cellSize + cellSize / 2, pz * cellSize + cellSize / 2, cellSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw direction indicator
    ctx.strokeStyle = colors.primary || '#f00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px * cellSize + cellSize / 2, pz * cellSize + cellSize / 2);
    ctx.lineTo(
        px * cellSize + cellSize / 2 + Math.sin(playerRotation) * cellSize,
        pz * cellSize + cellSize / 2 + Math.cos(playerRotation) * cellSize
    );
    ctx.stroke();
}

// Update UI
function updateUI() {
    document.getElementById('currentRound').textContent = currentRound;
    document.getElementById('maxRounds').textContent = maxRounds;
    document.getElementById('score').textContent = score;
}

// Update leaderboard
function updateLeaderboard(leaderboard) {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';
    
    leaderboard.forEach((entry, index) => {
        const li = document.createElement('li');
        li.textContent = `${entry.name}: ${entry.score}`;
        list.appendChild(li);
    });
}

// Show message
function showMessage(text, duration) {
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = text;
    messageDiv.classList.add('show');
    
    if (duration) {
        setTimeout(() => {
            messageDiv.classList.remove('show');
        }, duration);
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    handleMovement();
    
    // Animate goal marker
    if (goalMarker) {
        goalMarker.rotation.y += 0.02;
        goalMarker.position.y = 0.05 + Math.sin(Date.now() * 0.003) * 0.1;
    }
    
    renderer.render(scene, camera);
    drawMinimap();
}

// Start game when page loads
window.addEventListener('load', init);
