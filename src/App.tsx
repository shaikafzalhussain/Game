/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  MapPin,
  Volume2,
  VolumeX,
  HelpCircle,
  Sparkles,
  Mountain,
  Navigation,
  Shield,
  Crosshair,
  Zap,
  Users,
  Smartphone,
  RotateCcw,
  Sliders
} from 'lucide-react';

// --- Types ---
interface Building {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  type: 'house' | 'modern' | 'shop' | 'warehouse' | 'apartment';
  color: string;
}

interface Tree {
  id: string;
  x: number;
  z: number;
  scale: number;
  type: 'pine' | 'oak';
}

interface Vehicle {
  id: string;
  x: number;
  z: number;
  rotation: number;
  color: string;
  type: 'sedan' | 'suv' | 'van' | 'truck';
}

interface BotEntity {
  id: string;
  pos: { x: number; z: number };
  targetPos: { x: number; z: number };
  rotation: number;
  speed: number;
  state: 'patrol' | 'chase' | 'shoot';
  strideCycle: number;
  shootTimer: number;
  camo: string;
}

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'foggy'>('day');
  const [camoStyle, setCamoStyle] = useState('multicam');
  const [characterName, setCharacterName] = useState('OPERATOR ECHO');
  const [currentLandmark, setCurrentLandmark] = useState('Central Plaza & Town Hall');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [shotsFiredCount, setShotsFiredCount] = useState(0);
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [isPortrait, setIsPortrait] = useState(false);

  // Touch joystick state
  const joystickRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    vectorX: number;
    vectorY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    vectorX: 0,
    vectorY: 0
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientNodeRef = useRef<GainNode | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef({
    isDown: false,
    lastX: 0,
    lastY: 0
  });

  const recoilRef = useRef(0);

  const playerRef = useRef({
    pos: { x: 0, z: 0 },
    rotation: 0,
    pitch: 0.1,
    speed: 4.5,
    isRunning: false,
    isCrouching: false,
    isJumping: false,
    jumpVelocity: 0,
    isMoving: false,
    strideCycle: 0,
    distanceTraveled: 0
  });

  const mapDataRef = useRef<{
    buildings: Building[];
    trees: Tree[];
    vehicles: Vehicle[];
    bots: BotEntity[];
  }>({
    buildings: [],
    trees: [],
    vehicles: [],
    bots: []
  });

  // Check orientation on resize/mount
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Initialize procedural map layout with landscape optimization & LOD
  useEffect(() => {
    const buildings: Building[] = [];
    const vehicles: Vehicle[] = [];
    const trees: Tree[] = [];
    const bots: BotEntity[] = [];

    const buildingTypes: Building['type'][] = ['house', 'modern', 'shop', 'warehouse', 'apartment'];
    const vehicleColors = ['#2d3748', '#e2e8f0', '#3182ce', '#e53e3e', '#d69e2e', '#4a5568'];
    const vehicleTypes: Vehicle['type'][] = ['sedan', 'suv', 'van', 'truck'];

    // Grid layout for realistic town
    for (let x = -2200; x <= 2200; x += 400) {
      for (let z = -2200; z <= 2200; z += 400) {
        if (Math.abs(x) < 250 && Math.abs(z) < 250) continue;

        if (Math.random() > 0.35) {
          const bType = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
          let h = 90 + Math.random() * 110;
          if (bType === 'warehouse') h = 100;
          if (bType === 'apartment') h = 240;

          buildings.push({
            id: `b_${x}_${z}`,
            x: x + (Math.random() * 80 - 40),
            z: z + (Math.random() * 80 - 40),
            width: 120 + Math.random() * 70,
            depth: 120 + Math.random() * 70,
            height: h,
            type: bType,
            color: ['#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155'][Math.floor(Math.random() * 5)]
          });
        }

        if (Math.random() > 0.65) {
          vehicles.push({
            id: `v_${x}_${z}`,
            x: x + 160 + (Math.random() * 40 - 20),
            z: z + (Math.random() * 100 - 50),
            rotation: Math.random() * Math.PI * 2,
            color: vehicleColors[Math.floor(Math.random() * vehicleColors.length)],
            type: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)]
          });
        }
      }
    }

    // Vegetation
    for (let i = 0; i < 450; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 500 + Math.random() * 2400;
      trees.push({
        id: `tree_${i}`,
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        scale: 0.8 + Math.random() * 1.0,
        type: Math.random() > 0.4 ? 'pine' : 'oak'
      });
    }

    // AI Bots
    for (let i = 0; i < 10; i++) {
      const bx = (Math.random() - 0.5) * 3200;
      const bz = (Math.random() - 0.5) * 3200;
      bots.push({
        id: `bot_${i}`,
        pos: { x: bx, z: bz },
        targetPos: { x: bx + (Math.random() * 1000 - 500), z: bz + (Math.random() * 1000 - 500) },
        rotation: Math.random() * Math.PI * 2,
        speed: 2.0 + Math.random() * 1.5,
        state: 'patrol',
        strideCycle: Math.random() * Math.PI,
        shootTimer: 0,
        camo: ['woodland', 'desert', 'black'][Math.floor(Math.random() * 3)]
      });
    }

    mapDataRef.current = { buildings, trees, vehicles, bots };
  }, []);

  // Web Audio ambient sound
  useEffect(() => {
    if (!audioEnabled || !gameStarted) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 260;
      filter.Q.value = 1.0;

      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      ambientNodeRef.current = gain;

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start();

      return () => {
        try {
          whiteNoise.stop();
          ctx.close();
        } catch {}
      };
    } catch {}
  }, [audioEnabled, gameStarted]);

  const triggerShoot = () => {
    recoilRef.current = 1.0;
    setShotsFiredCount(prev => prev + 1);
  };

  const triggerJump = () => {
    const p = playerRef.current;
    if (!p.isJumping) {
      p.isJumping = true;
      p.jumpVelocity = 8;
    }
  };

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key) keysPressed.current[e.key.toLowerCase()] = true;
      if (e.code) keysPressed.current[e.code.toLowerCase()] = true;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        triggerShoot();
      }
      if (e.code === 'KeyC' || e.key === 'c') {
        playerRef.current.isCrouching = !playerRef.current.isCrouching;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key) keysPressed.current[e.key.toLowerCase()] = false;
      if (e.code) keysPressed.current[e.code.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Touch joystick handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    // If touch is on left half of screen, activate virtual joystick
    if (touch.clientX < window.innerWidth / 2) {
      joystickRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        vectorX: 0,
        vectorY: 0
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (joystickRef.current.active && touch.clientX < window.innerWidth / 2) {
      const dx = touch.clientX - joystickRef.current.startX;
      const dy = touch.clientY - joystickRef.current.startY;
      const maxRadius = 50;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      const clampedDist = Math.min(maxRadius, distance);
      joystickRef.current.currentX = joystickRef.current.startX + Math.cos(angle) * clampedDist;
      joystickRef.current.currentY = joystickRef.current.startY + Math.sin(angle) * clampedDist;

      joystickRef.current.vectorX = (Math.cos(angle) * clampedDist) / maxRadius;
      joystickRef.current.vectorY = (Math.sin(angle) * clampedDist) / maxRadius;
    } else {
      // Right side touch camera look
      if (touch.clientX >= window.innerWidth / 2 && mouseRef.current.isDown) {
        const deltaX = touch.clientX - mouseRef.current.lastX;
        const deltaY = touch.clientY - mouseRef.current.lastY;
        mouseRef.current.lastX = touch.clientX;
        mouseRef.current.lastY = touch.clientY;

        playerRef.current.rotation -= deltaX * 0.005;
        playerRef.current.pitch = Math.max(-0.4, Math.min(0.7, playerRef.current.pitch + deltaY * 0.003));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    joystickRef.current.active = false;
    joystickRef.current.vectorX = 0;
    joystickRef.current.vectorY = 0;
    mouseRef.current.isDown = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseRef.current.isDown = true;
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseRef.current.isDown) return;
    const deltaX = e.clientX - mouseRef.current.lastX;
    const deltaY = e.clientY - mouseRef.current.lastY;
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;

    playerRef.current.rotation -= deltaX * 0.005;
    playerRef.current.pitch = Math.max(-0.4, Math.min(0.7, playerRef.current.pitch + deltaY * 0.003));
  };

  const handleMouseUp = () => {
    mouseRef.current.isDown = false;
  };

  // Main 3D Render Loop optimized for mobile landscape
  useEffect(() => {
    if (!gameStarted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const width = canvas.width;
      const height = canvas.height;

      // Physics & Controls
      const p = playerRef.current;
      const keys = keysPressed.current;
      const joy = joystickRef.current;

      p.isRunning = keys['shift'] || keys['shiftleft'] || keys['shiftright'];
      const baseSpeed = p.isRunning ? p.speed * 2.2 : p.speed;
      const speed = p.isCrouching ? baseSpeed * 0.5 : baseSpeed;

      let moveX = 0;
      let moveZ = 0;

      // Keyboard input
      if (keys['w'] || keys['arrowup']) {
        moveX += Math.sin(p.rotation) * speed;
        moveZ += Math.cos(p.rotation) * speed;
      }
      if (keys['s'] || keys['arrowdown']) {
        moveX -= Math.sin(p.rotation) * (speed * 0.7);
        moveZ -= Math.cos(p.rotation) * (speed * 0.7);
      }
      if (keys['a'] || keys['arrowleft']) {
        moveX += Math.sin(p.rotation - Math.PI / 2) * (speed * 0.8);
        moveZ += Math.cos(p.rotation - Math.PI / 2) * (speed * 0.8);
      }
      if (keys['d'] || keys['arrowright']) {
        moveX += Math.sin(p.rotation + Math.PI / 2) * (speed * 0.8);
        moveZ += Math.cos(p.rotation + Math.PI / 2) * (speed * 0.8);
      }

      // Joystick touch input
      if (joy.active) {
        moveX += (Math.sin(p.rotation) * -joy.vectorY + Math.sin(p.rotation + Math.PI / 2) * joy.vectorX) * speed;
        moveZ += (Math.cos(p.rotation) * -joy.vectorY + Math.cos(p.rotation + Math.PI / 2) * joy.vectorX) * speed;
      }

      p.pos.x += moveX;
      p.pos.z += moveZ;

      // Jump physics
      if (p.isJumping) {
        p.jumpVelocity -= 0.5;
        if (p.jumpVelocity < -8) {
          p.isJumping = false;
          p.jumpVelocity = 0;
        }
      }

      const mapLimit = 3000;
      p.pos.x = Math.max(-mapLimit, Math.min(mapLimit, p.pos.x));
      p.pos.z = Math.max(-mapLimit, Math.min(mapLimit, p.pos.z));

      if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
        p.isMoving = true;
        p.strideCycle += speed * 0.15;
        p.distanceTraveled += Math.hypot(moveX, moveZ);
      } else {
        p.isMoving = false;
        p.strideCycle = 0;
      }

      recoilRef.current *= 0.82;

      // Landmark Tracking
      const distToPlaza = Math.hypot(p.pos.x, p.pos.z);
      if (distToPlaza < 350) {
        setCurrentLandmark('Central Plaza & Town Hall');
      } else if (p.pos.x > 500) {
        setCurrentLandmark('Eastern Residential District');
      } else if (p.pos.x < -500) {
        setCurrentLandmark('Western Commercial Sector');
      } else if (p.pos.z > 500) {
        setCurrentLandmark('Southern Industrial Park');
      } else {
        setCurrentLandmark('Northern Pine Hills');
      }

      // Sky & Horizon
      let skyTop = '#1a365d';
      let skyBottom = '#4299e1';
      let groundColor = '#2f855a';

      if (timeOfDay === 'sunset') {
        skyTop = '#742a2a';
        skyBottom = '#dd6b20';
        groundColor = '#744210';
      } else if (timeOfDay === 'foggy') {
        skyTop = '#4a5568';
        skyBottom = '#a0aec0';
        groundColor = '#2d3748';
      }

      const skyGrad = ctx.createLinearGradient(0, 0, 0, height / 2);
      skyGrad.addColorStop(0, skyTop);
      skyGrad.addColorStop(1, skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height / 2);

      // Distant Mountains
      ctx.fillStyle = '#2b4c7e';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      for (let i = 0; i <= width; i += 80) {
        const mHeight = (height / 2) - Math.abs(Math.sin(i * 0.003 + p.rotation * 0.2)) * 140 - 50;
        ctx.lineTo(i, mHeight);
      }
      ctx.lineTo(width, height / 2);
      ctx.fill();

      // Ground plane
      ctx.fillStyle = groundColor;
      ctx.fillRect(0, height / 2, width, height / 2);

      // Camera projection helper with graphics LOD render distance
      const renderDistance = graphicsQuality === 'low' ? 1800 : graphicsQuality === 'medium' ? 2400 : graphicsQuality === 'high' ? 3200 : 4000;

      const project = (wx: number, wy: number, wz: number) => {
        const dx = wx - p.pos.x;
        const dz = wz - p.pos.z;

        const cos = Math.cos(-p.rotation);
        const sin = Math.sin(-p.rotation);
        const rx = dx * cos - dz * sin;
        const rz = dx * sin + dz * cos;

        if (rz <= 10 || rz > renderDistance) return null;

        const fov = 500;
        const scale = fov / rz;
        const x2d = width / 2 + rx * scale;
        const y2d = height / 2 + (wy + p.pitch * 300 - (p.isJumping ? p.jumpVelocity * 15 : 0)) * scale;

        return { x: x2d, y: y2d, scale, rz };
      };

      // Draw Grid / Roads
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 3;
      for (let gx = -2200; gx <= 2200; gx += 400) {
        const p1 = project(gx, 0, -2200);
        const p2 = project(gx, 0, 2200);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
      for (let gz = -2200; gz <= 2200; gz += 400) {
        const p1 = project(-2200, 0, gz);
        const p2 = project(2200, 0, gz);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      const mapData = mapDataRef.current;
      const renderList: { distance: number; draw: () => void }[] = [];

      // Buildings (LOD filtered)
      mapData.buildings.forEach((b) => {
        const dist = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
        if (dist > renderDistance) return;

        renderList.push({
          distance: dist,
          draw: () => {
            const center = project(b.x, 0, b.z);
            if (!center || center.scale <= 0) return;
            const sc = center.scale;

            const bw = b.width * sc;
            const bh = b.height * sc;
            const bx = center.x - bw / 2;
            const by = center.y - bh;

            if (graphicsQuality !== 'low') {
              const shadowBase = project(b.x + 30, 0, b.z + 40);
              if (shadowBase) {
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath();
                ctx.ellipse(shadowBase.x, shadowBase.y, bw * 0.6, bh * 0.15, 0, 0, Math.PI * 2);
                ctx.fill();
              }
            }

            ctx.fillStyle = b.color;
            ctx.fillRect(bx, by, bw, bh);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(bx - 6 * sc, by - 8 * sc, bw + 12 * sc, 12 * sc);

            if (graphicsQuality !== 'low') {
              ctx.fillStyle = '#93c5fd';
              const winCols = 3;
              const winRows = Math.floor(b.height / 50);
              const wWidth = bw / (winCols + 1);
              const wHeight = 20 * sc;

              for (let r = 0; r < winRows; r++) {
                for (let c = 0; c < winCols; c++) {
                  ctx.fillRect(
                    bx + wWidth * (c + 0.5) - 10 * sc,
                    by + 25 * sc + r * 45 * sc,
                    20 * sc,
                    wHeight
                  );
                }
              }
            }

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(center.x - 15 * sc, center.y - 35 * sc, 30 * sc, 35 * sc);
          }
        });
      });

      // Vehicles
      if (graphicsQuality !== 'low') {
        mapData.vehicles.forEach((v) => {
          const dist = Math.hypot(v.x - p.pos.x, v.z - p.pos.z);
          if (dist > 1800) return;

          renderList.push({
            distance: dist,
            draw: () => {
              const center = project(v.x, 0, v.z);
              if (!center) return;
              const sc = center.scale;

              ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
              ctx.beginPath();
              ctx.ellipse(center.x + 10, center.y + 4, 30 * sc, 12 * sc, 0, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = v.color;
              ctx.fillRect(center.x - 24 * sc, center.y - 25 * sc, 48 * sc, 22 * sc);
              ctx.fillStyle = '#bee3f8';
              ctx.fillRect(center.x - 14 * sc, center.y - 32 * sc, 28 * sc, 10 * sc);
            }
          });
        });
      }

      // Trees
      mapData.trees.forEach((t) => {
        const dist = Math.hypot(t.x - p.pos.x, t.z - p.pos.z);
        if (dist > (graphicsQuality === 'low' ? 1400 : 2200)) return;

        renderList.push({
          distance: dist,
          draw: () => {
            const base = project(t.x, 0, t.z);
            const top = project(t.x, -130 * t.scale, t.z);
            if (!base || !top) return;

            if (graphicsQuality === 'high' || graphicsQuality === 'ultra') {
              const shadowCenter = project(t.x + 20, 0, t.z + 30);
              if (shadowCenter) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.ellipse(shadowCenter.x, shadowCenter.y, 25 * t.scale * base.scale, 12 * t.scale * base.scale, 0, 0, Math.PI * 2);
                ctx.fill();
              }
            }

            const radius = Math.max(2, 32 * t.scale * base.scale);
            ctx.fillStyle = '#718096';
            ctx.fillRect(base.x - 4 * base.scale, top.y, 8 * base.scale, base.y - top.y);

            ctx.fillStyle = t.type === 'pine' ? '#276749' : '#2f855a';
            ctx.beginPath();
            ctx.arc(top.x, top.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });

      // AI Bots
      mapData.bots.forEach((bot) => {
        const distToPlayer = Math.hypot(bot.pos.x - p.pos.x, bot.pos.z - p.pos.z);

        if (distToPlayer < 750) {
          bot.state = 'shoot';
          bot.rotation = Math.atan2(p.pos.x - bot.pos.x, p.pos.z - bot.pos.z);
          bot.shootTimer++;
          if (distToPlayer > 280) {
            bot.pos.x += Math.sin(bot.rotation) * (bot.speed * 0.6);
            bot.pos.z += Math.cos(bot.rotation) * (bot.speed * 0.6);
            bot.strideCycle += bot.speed * 0.15;
          }
        } else {
          bot.state = 'patrol';
          const dx = bot.targetPos.x - bot.pos.x;
          const dz = bot.targetPos.z - bot.pos.z;
          const dTarget = Math.hypot(dx, dz);

          if (dTarget < 60) {
            bot.targetPos.x = bot.pos.x + (Math.random() * 1000 - 500);
            bot.targetPos.z = bot.pos.z + (Math.random() * 1000 - 500);
          } else {
            bot.rotation = Math.atan2(dx, dz);
            bot.pos.x += Math.sin(bot.rotation) * bot.speed;
            bot.pos.z += Math.cos(bot.rotation) * bot.speed;
            bot.strideCycle += bot.speed * 0.15;
          }
        }

        const dist = Math.hypot(bot.pos.x - p.pos.x, bot.pos.z - p.pos.z);
        if (dist > renderDistance) return;

        renderList.push({
          distance: dist,
          draw: () => {
            const center = project(bot.pos.x, 0, bot.pos.z);
            if (!center) return;
            const sc = center.scale;
            const px = center.x;
            const py = center.y;

            const stride = Math.sin(bot.strideCycle) * 10;
            const kneeLift = Math.abs(Math.cos(bot.strideCycle)) * 5;

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = Math.max(3, 8 * sc);
            ctx.beginPath();
            ctx.moveTo(px - 5 * sc, py - 48 * sc);
            ctx.lineTo(px - 8 * sc + stride * sc, py - kneeLift * sc);
            ctx.lineTo(px - 10 * sc + stride * sc, py);
            ctx.moveTo(px + 5 * sc, py - 48 * sc);
            ctx.lineTo(px + 8 * sc - stride * sc, py - (10 - kneeLift) * sc);
            ctx.lineTo(px + 10 * sc - stride * sc, py);
            ctx.stroke();

            ctx.fillStyle = bot.state === 'shoot' ? '#7f1d1d' : '#334155';
            ctx.fillRect(px - 14 * sc, py - 100 * sc, 28 * sc, 52 * sc);

            ctx.fillStyle = '#f6ad55';
            ctx.beginPath();
            ctx.arc(px, py - 116 * sc, 11 * sc, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(px - 16 * sc, py - 78 * sc, 30 * sc, 5 * sc);

            if (bot.state === 'shoot' && (bot.shootTimer % 50 < 15)) {
              ctx.fillStyle = '#f6e05e';
              ctx.beginPath();
              ctx.arc(px - 20 * sc, py - 76 * sc, 10 * sc, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.fillStyle = 'rgba(127, 29, 29, 0.85)';
            ctx.fillRect(px - 40 * sc, py - 145 * sc, 80 * sc, 16 * sc);
            ctx.fillStyle = '#fca5a5';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(bot.state === 'shoot' ? '⚠️ HOSTILE [ENGAGING]' : 'patrolling AI', px, py - 134 * sc);
          }
        });
      });

      renderList.sort((a, b) => b.distance - a.distance);
      renderList.forEach(item => item.draw());

      // 4. Render Player Character with Landscape / Crouch / Jump Animations
      const playerCenter = project(p.pos.x, 0, p.pos.z);
      if (playerCenter) {
        const sc = playerCenter.scale;
        const px = playerCenter.x;
        const py = playerCenter.y;

        const isRunAnim = p.isMoving && p.isRunning;
        const strideMultiplier = isRunAnim ? 22 : 12;
        const stride = Math.sin(p.strideCycle) * strideMultiplier;
        const kneeLift = Math.abs(Math.cos(p.strideCycle)) * (isRunAnim ? 12 : 6);

        const timeNow = performance.now() * 0.003;
        const breathSway = !p.isMoving ? Math.sin(timeNow) * 2 * sc : 0;
        const bodyBob = p.isMoving ? Math.abs(Math.sin(p.strideCycle * 2)) * (isRunAnim ? 10 : 5) * sc : breathSway;
        const bodySway = p.isMoving ? Math.sin(p.strideCycle) * 3 * sc : 0;

        const crouchOffset = p.isCrouching ? 25 * sc : 0;
        const adjustedPy = py - bodyBob + crouchOffset;
        const adjustedPx = px + bodySway;

        // Character Shadow
        const charShadowCenter = project(p.pos.x + 15, 0, p.pos.z + 25);
        if (charShadowCenter) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.ellipse(charShadowCenter.x, charShadowCenter.y, (24 - bodyBob * 0.5) * sc, 11 * sc, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Legs
        ctx.strokeStyle = camoStyle === 'woodland' ? '#276749' : camoStyle === 'desert' ? '#975a16' : '#2d3748';
        ctx.lineWidth = Math.max(4, 9 * sc);
        ctx.beginPath();
        ctx.moveTo(adjustedPx - 6 * sc, adjustedPy - (p.isCrouching ? 35 : 52) * sc);
        ctx.lineTo(adjustedPx - 10 * sc + stride * sc, adjustedPy - (p.isCrouching ? 15 : kneeLift) * sc);
        ctx.lineTo(adjustedPx - 12 * sc + stride * sc, adjustedPy);
        ctx.moveTo(adjustedPx + 6 * sc, adjustedPy - (p.isCrouching ? 35 : 52) * sc);
        ctx.lineTo(adjustedPx + 10 * sc - stride * sc, adjustedPy - (p.isCrouching ? 15 : (12 - kneeLift)) * sc);
        ctx.lineTo(adjustedPx + 12 * sc - stride * sc, adjustedPy);
        ctx.stroke();

        // Torso
        ctx.fillStyle = camoStyle === 'black' ? '#1a202c' : '#374151';
        ctx.fillRect(adjustedPx - 16 * sc, adjustedPy - (p.isCrouching ? 80 : 110) * sc, 32 * sc, (p.isCrouching ? 45 : 60) * sc);

        // Recoil
        const recoilKick = recoilRef.current * 14 * sc;
        const recoilUp = recoilRef.current * 8 * sc;

        const armSway = p.isMoving ? Math.sin(p.strideCycle) * 4 * sc : Math.sin(timeNow * 1.5) * 1.2 * sc;
        ctx.strokeStyle = camoStyle === 'black' ? '#1a202c' : '#374151';
        ctx.lineWidth = Math.max(3, 7 * sc);
        ctx.beginPath();
        ctx.moveTo(adjustedPx - 14 * sc, adjustedPy - (p.isCrouching ? 65 : 95) * sc);
        ctx.lineTo(adjustedPx - 6 * sc + armSway - recoilKick, adjustedPy - (p.isCrouching ? 55 : 78) * sc - recoilUp);
        ctx.moveTo(adjustedPx + 14 * sc, adjustedPy - (p.isCrouching ? 65 : 95) * sc);
        ctx.lineTo(adjustedPx + 4 * sc - armSway - recoilKick, adjustedPy - (p.isCrouching ? 58 : 80) * sc - recoilUp);
        ctx.stroke();

        // Assault Rifle
        ctx.fillStyle = '#111827';
        ctx.fillRect(adjustedPx - 18 * sc - recoilKick, adjustedPy - (p.isCrouching ? 62 : 86) * sc - recoilUp, 36 * sc, 6 * sc);

        if (recoilRef.current > 0.08) {
          ctx.fillStyle = '#f6e05e';
          ctx.beginPath();
          ctx.arc(adjustedPx - 22 * sc - recoilKick, adjustedPy - (p.isCrouching ? 59 : 83) * sc - recoilUp, 12 * sc * recoilRef.current, 0, Math.PI * 2);
          ctx.fill();
        }

        // Head & Helmet
        ctx.fillStyle = '#f6ad55';
        ctx.beginPath();
        ctx.arc(adjustedPx, adjustedPy - (p.isCrouching ? 96 : 126) * sc, 13 * sc, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(adjustedPx, adjustedPy - (p.isCrouching ? 100 : 130) * sc, 15 * sc, Math.PI, Math.PI * 2);
        ctx.fill();

        // Operator Tag
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(adjustedPx - 50 * sc, adjustedPy - (p.isCrouching ? 130 : 165) * sc, 100 * sc, 20 * sc);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${characterName} [MOBILE]`, adjustedPx, adjustedPy - (p.isCrouching ? 116 : 151) * sc);
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [gameStarted, timeOfDay, camoStyle, characterName, graphicsQuality]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {!gameStarted ? (
        <div className="flex flex-col flex-1 items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black relative">
          <div className="max-w-xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Smartphone className="w-10 h-10 text-cyan-400" />
              <h1 className="text-3xl font-black tracking-wider bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                TERRA: MOBILE LANDSCAPE
              </h1>
            </div>
            <p className="text-center text-slate-400 text-sm mb-6">
              Optimized for mobile landscape mode with virtual touch joystick, 360° camera swipe, jump/crouch action buttons, AI bots, and LOD performance settings.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Operator Callsign
                </label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Camo Gear
                  </label>
                  <select
                    value={camoStyle}
                    onChange={(e) => setCamoStyle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="multicam">MultiCam Tactical</option>
                    <option value="woodland">Forest Woodland</option>
                    <option value="desert">Desert Tan</option>
                    <option value="black">Shadow Black</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Graphics Quality (LOD)
                  </label>
                  <select
                    value={graphicsQuality}
                    onChange={(e) => setGraphicsQuality(e.target.value as 'low' | 'medium' | 'high' | 'ultra')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="low">⚡ Low (Performance)</option>
                    <option value="medium">⚖️ Medium</option>
                    <option value="high">✨ High</option>
                    <option value="ultra">🌟 Ultra HD</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => setGameStarted(true)}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black tracking-widest uppercase rounded-2xl shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-3 text-sm"
              >
                <Sparkles className="w-5 h-5" />
                START MOBILE LANDSCAPE GAME
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

          {/* Portrait Warning Overlay if rotated vertically */}
          {isPortrait && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center">
              <RotateCcw className="w-16 h-16 text-cyan-400 animate-spin mb-4" />
              <h2 className="text-2xl font-black text-white mb-2">Rotate Your Phone Horizontally</h2>
              <p className="text-slate-400 text-sm max-w-sm mb-6">
                This game is designed specifically for mobile landscape mode to deliver the best 3D experience with dual-stick touch controls.
              </p>
              <button
                onClick={() => setIsPortrait(false)}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-sm shadow-lg"
              >
                Dismiss & Play Anyway
              </button>
            </div>
          )}

          {/* Top Landscape HUD */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-2 shadow-xl flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl">
                <Navigation className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">{currentLandmark}</h3>
                <p className="text-xs font-black text-white">
                  X: {Math.round(playerRef.current.pos.x)} | Z: {Math.round(playerRef.current.pos.z)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold text-slate-300">Shots: <strong className="text-amber-400">{shotsFiredCount}</strong></span>
              </div>
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="p-2.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl text-slate-300 hover:text-white shadow-xl"
              >
                {audioEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
              </button>
              <button
                onClick={() => setShowHelp(true)}
                className="p-2.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl text-slate-300 hover:text-white shadow-xl"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Virtual Joystick (Bottom Left) */}
          <div className="absolute bottom-6 left-6 w-32 h-32 rounded-full border border-white/20 bg-white/5 backdrop-blur-xs pointer-events-none flex items-center justify-center z-20">
            <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Joystick</div>
            {joystickRef.current.active && (
              <div
                className="absolute w-12 h-12 rounded-full bg-cyan-500/50 border border-cyan-400 pointer-events-none transition-transform"
                style={{
                  transform: `translate(${(joystickRef.current.currentX - joystickRef.current.startX)}px, ${(joystickRef.current.currentY - joystickRef.current.startY)}px)`
                }}
              />
            )}
          </div>

          {/* Mobile Touch Action Buttons (Bottom Right) */}
          <div className="absolute bottom-6 right-6 flex items-end gap-3 z-20">
            <div className="flex flex-col gap-2">
              <button
                onClick={triggerJump}
                className="w-14 h-14 bg-slate-900/80 active:bg-cyan-600/50 backdrop-blur-md border border-slate-700 rounded-2xl text-white font-bold text-xs shadow-xl flex items-center justify-center active:scale-95 transition-all"
              >
                JUMP
              </button>
              <button
                onClick={() => playerRef.current.isCrouching = !playerRef.current.isCrouching}
                className="w-14 h-14 bg-slate-900/80 active:bg-cyan-600/50 backdrop-blur-md border border-slate-700 rounded-2xl text-white font-bold text-xs shadow-xl flex items-center justify-center active:scale-95 transition-all"
              >
                CROUCH
              </button>
            </div>

            <button
              onClick={triggerShoot}
              className="w-20 h-20 bg-gradient-to-tr from-amber-600 to-amber-400 active:scale-95 border-2 border-amber-300 rounded-3xl text-white font-black text-sm shadow-2xl flex items-center justify-center shadow-amber-500/40 transition-all"
            >
              <Zap className="w-8 h-8" />
            </button>
          </div>

          {/* Help Modal */}
          {showHelp && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-cyan-400" />
                    Mobile Landscape Controls
                  </h3>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="text-slate-400 hover:text-white text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span>Movement Joystick</span>
                    <strong className="text-cyan-400">Touch & Drag Bottom-Left</strong>
                  </li>
                  <li className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span>Camera Look</span>
                    <strong className="text-cyan-400">Swipe Right Side of Screen</strong>
                  </li>
                  <li className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span>Fire & Recoil</span>
                    <strong className="text-amber-400">BIG Fire Button / Spacebar</strong>
                  </li>
                  <li className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span>Jump & Crouch</span>
                    <strong className="text-cyan-400">Bottom-Right Action Buttons</strong>
                  </li>
                </ul>
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all text-sm"
                >
                  Resume Game
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
