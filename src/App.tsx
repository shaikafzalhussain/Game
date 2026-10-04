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
  Smartphone,
  RotateCcw,
  Footprints,
  ChevronUp,
  Flame,
  Download,
  Heart,
  Skull
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
  state: 'patrol' | 'chase' | 'shoot' | 'dying';
  health: number;
  maxHealth: number;
  strideCycle: number;
  shootTimer: number;
  deathTimer: number;
  camo: string;
}

interface Bullet {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  isPlayer: boolean;
  distanceTraveled: number;
}

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'foggy'>('day');
  const [camoStyle, setCamoStyle] = useState('multicam');
  const [characterName, setCharacterName] = useState('OPERATOR ECHO');
  const [currentLandmark, setCurrentLandmark] = useState('Central Plaza & Town Hall');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [shotsFiredCount, setShotsFiredCount] = useState(0);
  const [enemiesEliminated, setEnemiesEliminated] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [isPortrait, setIsPortrait] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Touch joystick state
  const joystickRef = useRef<{
    active: boolean;
    identifier: number | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    vectorX: number;
    vectorY: number;
  }>({
    active: false,
    identifier: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    vectorX: 0,
    vectorY: 0
  });

  // Touch look / camera swipe state
  const lookTouchRef = useRef<{
    active: boolean;
    identifier: number | null;
    lastX: number;
    lastY: number;
  }>({
    active: false,
    identifier: null,
    lastX: 0,
    lastY: 0
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef({
    isDown: false,
    lastX: 0,
    lastY: 0
  });

  const recoilRef = useRef(0);
  const isFiringRef = useRef(false);
  const fireIntervalRef = useRef<number | null>(null);

  const playerRef = useRef({
    pos: { x: 0, z: 0 },
    rotation: 0,
    pitch: 0.1,
    speed: 4.5,
    isSprinting: false,
    isCrouching: false,
    isJumping: false,
    jumpVelocity: 0,
    isMoving: false,
    strideCycle: 0
  });

  const mapDataRef = useRef<{
    buildings: Building[];
    trees: Tree[];
    vehicles: Vehicle[];
    bots: BotEntity[];
    bullets: Bullet[];
  }>({
    buildings: [],
    trees: [],
    vehicles: [],
    bots: [],
    bullets: []
  });

  // PWA install prompt handler
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('To install FireStrike, tap your browser menu and select "Add to Home Screen" or "Install App".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  // Check orientation on resize/mount
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Initialize map layout & enemies
  useEffect(() => {
    const buildings: Building[] = [];
    const vehicles: Vehicle[] = [];
    const trees: Tree[] = [];
    const bots: BotEntity[] = [];

    const buildingTypes: Building['type'][] = ['house', 'modern', 'shop', 'warehouse', 'apartment'];
    const vehicleColors = ['#2d3748', '#e2e8f0', '#3182ce', '#e53e3e', '#d69e2e', '#4a5568'];
    const vehicleTypes: Vehicle['type'][] = ['sedan', 'suv', 'van', 'truck'];

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

    for (let i = 0; i < 400; i++) {
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

    for (let i = 0; i < 12; i++) {
      const bx = (Math.random() - 0.5) * 3200;
      const bz = (Math.random() - 0.5) * 3200;
      bots.push({
        id: `bot_${i}`,
        pos: { x: bx, z: bz },
        targetPos: { x: bx + (Math.random() * 1000 - 500), z: bz + (Math.random() * 1000 - 500) },
        rotation: Math.random() * Math.PI * 2,
        speed: 2.2 + Math.random() * 1.2,
        state: 'patrol',
        health: 100,
        maxHealth: 100,
        strideCycle: Math.random() * Math.PI,
        shootTimer: Math.floor(Math.random() * 50),
        deathTimer: 0,
        camo: ['woodland', 'desert', 'black'][Math.floor(Math.random() * 3)]
      });
    }

    mapDataRef.current = { buildings, trees, vehicles, bots, bullets: [] };
  }, []);

  // Web Audio gunshots & effects
  const playGunshotSound = (isPlayerGun = true) => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isPlayerGun ? 220 : 160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(isPlayerGun ? 0.25 : 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  const triggerShoot = () => {
    recoilRef.current = 1.0;
    setShotsFiredCount(prev => prev + 1);
    playGunshotSound(true);

    const p = playerRef.current;
    // Spawn player bullet forward
    const bulletSpeed = 45;
    const bulletVx = Math.sin(p.rotation) * bulletSpeed;
    const bulletVz = Math.cos(p.rotation) * bulletSpeed;

    mapDataRef.current.bullets.push({
      id: `bullet_${Date.now()}_${Math.random()}`,
      x: p.pos.x,
      z: p.pos.z,
      vx: bulletVx,
      vz: bulletVz,
      isPlayer: true,
      distanceTraveled: 0
    });
  };

  const startFiring = () => {
    if (isFiringRef.current) return;
    isFiringRef.current = true;
    triggerShoot();
    fireIntervalRef.current = window.setInterval(() => {
      triggerShoot();
    }, 130);
  };

  const stopFiring = () => {
    isFiringRef.current = false;
    if (fireIntervalRef.current) {
      clearInterval(fireIntervalRef.current);
      fireIntervalRef.current = null;
    }
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

  // Multi-touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.clientX < window.innerWidth / 2 && !joystickRef.current.active) {
        joystickRef.current = {
          active: true,
          identifier: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
          currentX: touch.clientX,
          currentY: touch.clientY,
          vectorX: 0,
          vectorY: 0
        };
      } else if (touch.clientX >= window.innerWidth / 2 && !lookTouchRef.current.active) {
        lookTouchRef.current = {
          active: true,
          identifier: touch.identifier,
          lastX: touch.clientX,
          lastY: touch.clientY
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (joystickRef.current.active && touch.identifier === joystickRef.current.identifier) {
        const dx = touch.clientX - joystickRef.current.startX;
        const dy = touch.clientY - joystickRef.current.startY;
        const maxRadius = 55;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        const clampedDist = Math.min(maxRadius, distance);
        joystickRef.current.currentX = joystickRef.current.startX + Math.cos(angle) * clampedDist;
        joystickRef.current.currentY = joystickRef.current.startY + Math.sin(angle) * clampedDist;

        joystickRef.current.vectorX = (Math.cos(angle) * clampedDist) / maxRadius;
        joystickRef.current.vectorY = (Math.sin(angle) * clampedDist) / maxRadius;
      }
      if (lookTouchRef.current.active && touch.identifier === lookTouchRef.current.identifier) {
        const deltaX = touch.clientX - lookTouchRef.current.lastX;
        const deltaY = touch.clientY - lookTouchRef.current.lastY;
        lookTouchRef.current.lastX = touch.clientX;
        lookTouchRef.current.lastY = touch.clientY;

        playerRef.current.rotation -= deltaX * 0.005;
        playerRef.current.pitch = Math.max(-0.4, Math.min(0.7, playerRef.current.pitch + deltaY * 0.003));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (joystickRef.current.active && touch.identifier === joystickRef.current.identifier) {
        joystickRef.current.active = false;
        joystickRef.current.identifier = null;
        joystickRef.current.vectorX = 0;
        joystickRef.current.vectorY = 0;
      }
      if (lookTouchRef.current.active && touch.identifier === lookTouchRef.current.identifier) {
        lookTouchRef.current.active = false;
        lookTouchRef.current.identifier = null;
      }
    }
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

  // Main Render Loop with Combat Simulation & Bullet Collisions
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

      const p = playerRef.current;
      const keys = keysPressed.current;
      const joy = joystickRef.current;

      const runningActive = p.isSprinting || keys['shift'] || keys['shiftleft'] || keys['shiftright'];
      const baseSpeed = runningActive ? p.speed * 2.2 : p.speed;
      const speed = p.isCrouching ? baseSpeed * 0.5 : baseSpeed;

      let moveX = 0;
      let moveZ = 0;

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

      if (joy.active) {
        moveX += (Math.sin(p.rotation) * -joy.vectorY + Math.sin(p.rotation + Math.PI / 2) * joy.vectorX) * speed;
        moveZ += (Math.cos(p.rotation) * -joy.vectorY + Math.cos(p.rotation + Math.PI / 2) * joy.vectorX) * speed;
      }

      p.pos.x += moveX;
      p.pos.z += moveZ;

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
      } else {
        p.isMoving = false;
        p.strideCycle = 0;
      }

      recoilRef.current *= 0.82;

      // Update Bullets & Collisions
      const bullets = mapDataRef.current.bullets;
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.z += b.vz;
        b.distanceTraveled += Math.hypot(b.vx, b.vz);

        // Despawn bullet if too far
        if (b.distanceTraveled > 2000) {
          bullets.splice(i, 1);
          continue;
        }

        // If player bullet, check hit against active bots
        if (b.isPlayer) {
          for (const bot of mapDataRef.current.bots) {
            if (bot.state === 'dying') continue;
            const hitDist = Math.hypot(b.x - bot.pos.x, b.z - bot.pos.z);
            if (hitDist < 45) {
              // Apply damage
              bot.health -= 35;
              bullets.splice(i, 1);
              if (bot.health <= 0) {
                bot.state = 'dying';
                bot.deathTimer = 0;
                setEnemiesEliminated(prev => prev + 1);
              }
              break;
            }
          }
        } else {
          // Enemy bullet checking hit against player
          const hitPlayer = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
          if (hitPlayer < 30) {
            setPlayerHealth(prev => Math.max(0, prev - 10));
            bullets.splice(i, 1);
          }
        }
      }

      // Update AI Bots & Combat
      mapDataRef.current.bots.forEach((bot) => {
        if (bot.state === 'dying') {
          bot.deathTimer++;
          return;
        }

        const distToPlayer = Math.hypot(bot.pos.x - p.pos.x, bot.pos.z - p.pos.z);

        if (distToPlayer < 800) {
          bot.state = 'shoot';
          bot.rotation = Math.atan2(p.pos.x - bot.pos.x, p.pos.z - bot.pos.z);
          bot.shootTimer++;

          // Enemy firing towards player
          if (bot.shootTimer % 60 === 0) {
            playGunshotSound(false);
            const eBulletSpeed = 35;
            bullets.push({
              id: `eb_${Date.now()}_${Math.random()}`,
              x: bot.pos.x,
              z: bot.pos.z,
              vx: Math.sin(bot.rotation) * eBulletSpeed,
              vz: Math.cos(bot.rotation) * eBulletSpeed,
              isPlayer: false,
              distanceTraveled: 0
            });
          }

          if (distToPlayer > 300) {
            bot.pos.x += Math.sin(bot.rotation) * (bot.speed * 0.7);
            bot.pos.z += Math.cos(bot.rotation) * (bot.speed * 0.7);
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
      });

      // Cleanup fully dead bots after death animation
      mapDataRef.current.bots = mapDataRef.current.bots.filter(
        bot => !(bot.state === 'dying' && bot.deathTimer > 40)
      );

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

      // Mountains
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

      // Roads
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

            ctx.fillStyle = b.color;
            ctx.fillRect(bx, by, bw, bh);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(bx - 6 * sc, by - 8 * sc, bw + 12 * sc, 12 * sc);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(center.x - 15 * sc, center.y - 35 * sc, 30 * sc, 35 * sc);
          }
        });
      });

      mapData.trees.forEach((t) => {
        const dist = Math.hypot(t.x - p.pos.x, t.z - p.pos.z);
        if (dist > (graphicsQuality === 'low' ? 1400 : 2200)) return;

        renderList.push({
          distance: dist,
          draw: () => {
            const base = project(t.x, 0, t.z);
            const top = project(t.x, -130 * t.scale, t.z);
            if (!base || !top) return;

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

      // Render Bullets in 3D
      mapData.bullets.forEach((b) => {
        const dist = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
        if (dist > renderDistance) return;

        renderList.push({
          distance: dist,
          draw: () => {
            const center = project(b.x, -40, b.z);
            if (!center) return;
            ctx.fillStyle = b.isPlayer ? '#f6e05e' : '#ef4444';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4 * center.scale, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });

      // Render AI Bots / Enemies with health & death animations
      mapData.bots.forEach((bot) => {
        const dist = Math.hypot(bot.pos.x - p.pos.x, bot.pos.z - p.pos.z);
        if (dist > renderDistance) return;

        renderList.push({
          distance: dist,
          draw: () => {
            const center = project(bot.pos.x, bot.state === 'dying' ? bot.deathTimer * 8 : 0, bot.pos.z);
            if (!center) return;
            const sc = center.scale;
            const px = center.x;
            const py = center.y;

            if (bot.state === 'dying') {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
              ctx.font = 'bold 12px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('💀 ELIMINATED', px, py - 60 * sc);
              return;
            }

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

            // Enemy Weapon
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(px - 16 * sc, py - 78 * sc, 30 * sc, 5 * sc);

            if (bot.state === 'shoot' && (bot.shootTimer % 60 < 15)) {
              ctx.fillStyle = '#f6e05e';
              ctx.beginPath();
              ctx.arc(px - 20 * sc, py - 76 * sc, 10 * sc, 0, Math.PI * 2);
              ctx.fill();
            }

            // Enemy Health Bar
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(px - 25 * sc, py - 135 * sc, 50 * sc, 6 * sc);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(px - 25 * sc, py - 135 * sc, (bot.health / bot.maxHealth) * 50 * sc, 6 * sc);
          }
        });
      });

      renderList.sort((a, b) => b.distance - a.distance);
      renderList.forEach(item => item.draw());

      // Render Player Character
      const playerCenter = project(p.pos.x, 0, p.pos.z);
      if (playerCenter) {
        const sc = playerCenter.scale;
        const px = playerCenter.x;
        const py = playerCenter.y;

        const isRunAnim = p.isMoving && runningActive;
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

        ctx.fillStyle = camoStyle === 'black' ? '#1a202c' : '#374151';
        ctx.fillRect(adjustedPx - 16 * sc, adjustedPy - (p.isCrouching ? 80 : 110) * sc, 32 * sc, (p.isCrouching ? 45 : 60) * sc);

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

        ctx.fillStyle = '#111827';
        ctx.fillRect(adjustedPx - 18 * sc - recoilKick, adjustedPy - (p.isCrouching ? 62 : 86) * sc - recoilUp, 36 * sc, 6 * sc);

        if (recoilRef.current > 0.08) {
          ctx.fillStyle = '#f6e05e';
          ctx.beginPath();
          ctx.arc(adjustedPx - 22 * sc - recoilKick, adjustedPy - (p.isCrouching ? 59 : 83) * sc - recoilUp, 12 * sc * recoilRef.current, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#f6ad55';
        ctx.beginPath();
        ctx.arc(adjustedPx, adjustedPy - (p.isCrouching ? 96 : 126) * sc, 13 * sc, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(adjustedPx, adjustedPy - (p.isCrouching ? 100 : 130) * sc, 15 * sc, Math.PI, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [gameStarted, timeOfDay, camoStyle, characterName, graphicsQuality, audioEnabled]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {!gameStarted ? (
        <div className="flex flex-col flex-1 items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black relative">
          <div className="max-w-xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-9 h-9 text-red-500" />
                <h1 className="text-2xl font-black tracking-wider bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                  FIRESTRIKE ROYALE
                </h1>
              </div>

              {/* Install PWA Button */}
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                {isInstalled ? 'Installed' : 'Install Game'}
              </button>
            </div>

            <p className="text-slate-400 text-xs">
              Installable PWA 3D mobile battle royale shooter. Engage combat enemies with realistic firearms, hold-to-fire auto weapons, immersive audio, and eliminate targets!
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Operator Callsign
                </label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 text-sm"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
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
                className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black tracking-widest uppercase rounded-2xl shadow-xl shadow-red-600/30 transition-all flex items-center justify-center gap-3 text-sm"
              >
                <Sparkles className="w-5 h-5" />
                DEPLOY INTO COMBAT
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="relative flex-1 w-full h-full overflow-hidden touch-none select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

          {/* Portrait Warning Overlay */}
          {isPortrait && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center">
              <RotateCcw className="w-16 h-16 text-red-500 animate-spin mb-4" />
              <h2 className="text-2xl font-black text-white mb-2">Rotate Your Phone Horizontally</h2>
              <p className="text-slate-400 text-sm max-w-sm mb-6">
                FireStrike is optimized for mobile landscape mode.
              </p>
              <button
                onClick={() => setIsPortrait(false)}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm shadow-lg"
              >
                Dismiss & Play
              </button>
            </div>
          )}

          {/* Top Landscape HUD */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-2 shadow-xl flex items-center gap-3 pointer-events-auto">
                <div className="p-2 bg-red-500/20 text-red-500 rounded-xl">
                  <Heart className="w-4 h-4 animate-pulse fill-red-500 text-red-500" />
                </div>
                <div>
                  <h3 className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">HP</h3>
                  <p className="text-xs font-black text-white">{playerHealth} / 100</p>
                </div>
              </div>

              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-2 shadow-xl flex items-center gap-3">
                <div className="p-2 bg-red-500/20 text-red-500 rounded-xl">
                  <Skull className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">Kills</h3>
                  <p className="text-xs font-black text-white">{enemiesEliminated}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold text-slate-300">Shots: <strong className="text-amber-400">{shotsFiredCount}</strong></span>
              </div>
              <button
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="p-2.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl text-slate-300 hover:text-white shadow-xl"
              >
                {audioEnabled ? <Volume2 className="w-4 h-4 text-red-500" /> : <VolumeX className="w-4 h-4 text-red-400" />}
              </button>
              <button
                onClick={() => setShowHelp(true)}
                className="p-2.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl text-slate-300 hover:text-white shadow-xl"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Left Side: Virtual Movement Joystick */}
          <div className="absolute bottom-8 left-8 w-36 h-36 rounded-full border-2 border-white/25 bg-white/5 backdrop-blur-xs pointer-events-none flex items-center justify-center z-20 shadow-2xl">
            <div className="text-white/40 text-[11px] uppercase font-bold tracking-widest">JOYSTICK</div>
            {joystickRef.current.active && (
              <div
                className="absolute w-14 h-14 rounded-full bg-red-500/60 border-2 border-red-300 pointer-events-none shadow-lg transition-transform"
                style={{
                  transform: `translate(${(joystickRef.current.currentX - joystickRef.current.startX)}px, ${(joystickRef.current.currentY - joystickRef.current.startY)}px)`
                }}
              />
            )}
          </div>

          {/* Right Side Action Controls */}
          <div className="absolute bottom-6 right-6 flex items-end gap-3 z-25">
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  playerRef.current.isSprinting = !playerRef.current.isSprinting;
                  setIsSprinting(playerRef.current.isSprinting);
                }}
                className={`w-16 h-16 backdrop-blur-md border rounded-2xl font-bold text-xs shadow-xl flex flex-col items-center justify-center active:scale-95 transition-all ${
                  isSprinting
                    ? 'bg-red-600/80 border-red-400 text-white'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300'
                }`}
              >
                <Footprints className="w-5 h-5 mb-0.5" />
                SPRINT
              </button>
              <button
                onClick={triggerJump}
                className="w-16 h-16 bg-slate-900/80 active:bg-red-600/50 backdrop-blur-md border border-slate-700 rounded-2xl text-white font-bold text-xs shadow-xl flex flex-col items-center justify-center active:scale-95 transition-all"
              >
                <ChevronUp className="w-5 h-5 mb-0.5" />
                JUMP
              </button>
              <button
                onClick={() => playerRef.current.isCrouching = !playerRef.current.isCrouching}
                className="w-16 h-16 bg-slate-900/80 active:bg-red-600/50 backdrop-blur-md border border-slate-700 rounded-2xl text-white font-bold text-xs shadow-xl flex flex-col items-center justify-center active:scale-95 transition-all"
              >
                CROUCH
              </button>
            </div>

            {/* Hold-to-Fire Auto Button */}
            <button
              onMouseDown={startFiring}
              onMouseUp={stopFiring}
              onMouseLeave={stopFiring}
              onTouchStart={startFiring}
              onTouchEnd={stopFiring}
              className="w-24 h-24 bg-gradient-to-tr from-red-600 to-amber-500 active:scale-95 border-3 border-amber-200 rounded-3xl text-white font-black text-sm shadow-2xl flex flex-col items-center justify-center shadow-red-600/50 transition-all select-none"
            >
              <Flame className="w-9 h-9 mb-1 animate-pulse" />
              FIRE
            </button>
          </div>

          {/* Help Modal */}
          {showHelp && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-red-500" />
                    FireStrike Combat Guide
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
                    <span>Virtual Joystick</span>
                    <strong className="text-red-400">Bottom-Left (Movement)</strong>
                  </li>
                  <li className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span>360° Camera Look</span>
                    <strong className="text-red-400">Swipe Right Side of Screen</strong>
                  </li>
                  <li className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span>Hold-to-Fire Auto Gun</span>
                    <strong className="text-amber-400">Big FIRE Button (Bottom-Right)</strong>
                  </li>
                  <li className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span>Enemy Combat & Elimination</span>
                    <strong className="text-red-400">Shoot enemy bots until health reaches 0</strong>
                  </li>
                </ul>
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all text-sm"
                >
                  Resume Combat
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
