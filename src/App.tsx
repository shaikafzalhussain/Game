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
  Skull,
  Trophy,
  AlertTriangle,
  Play,
  Package,
  Target,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight
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
  counted: boolean;
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

interface LootItem {
  id: string;
  x: number;
  z: number;
  type: 'armor1' | 'armor2' | 'armor3' | 'helmet1' | 'helmet2' | 'helmet3' | 'backpack1' | 'backpack2' | 'backpack3' | 'weapon' | 'health';
  name: string;
  rarity: 'Common' | 'Uncommon' | 'Rare';
  collected: boolean;
}

export default function App() {
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'victory' | 'defeat'>('lobby');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'foggy'>('day');
  const [camoStyle, setCamoStyle] = useState('multicam');
  const [characterName, setCharacterName] = useState('OPERATOR ECHO');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [shotsFiredCount, setShotsFiredCount] = useState(0);
  const [enemiesEliminated, setEnemiesEliminated] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [armorLevel, setArmorLevel] = useState(0); // 0 to 3
  const [helmetLevel, setHelmetLevel] = useState(0); // 0 to 3
  const [backpackLevel, setBackpackLevel] = useState(0); // 0 to 3
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [isPortrait, setIsPortrait] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [safeZoneRadius, setSafeZoneRadius] = useState(3200);
  const [matchTimer, setMatchTimer] = useState(360);
  const [interactMessage, setInteractMessage] = useState<string | null>(null);
  const [killNotification, setKillNotification] = useState<string | null>(null);
  const [hitMarkerActive, setHitMarkerActive] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Directional Arrow Movement state refs
  const moveDirectionRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false
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
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const targetedBotIdRef = useRef<string | null>(null);

  const playerRef = useRef({
    pos: { x: 0, z: 0 },
    rotation: 0,
    pitch: 0.1,
    speed: 4.8,
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
    loot: LootItem[];
  }>({
    buildings: [],
    trees: [],
    vehicles: [],
    bots: [],
    bullets: [],
    loot: []
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
      alert('To install FireStrike Royale, tap your browser menu and select "Add to Home Screen" or "Install App".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  // Check orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Initialize match map
  const startNewMatch = () => {
    setPlayerHealth(100);
    setArmorLevel(0);
    setHelmetLevel(0);
    setBackpackLevel(0);
    setEnemiesEliminated(0);
    setShotsFiredCount(0);
    setSafeZoneRadius(3200);
    setMatchTimer(360);
    setIsSprinting(false);
    playerRef.current.isSprinting = false;
    playerRef.current.pos = { x: (Math.random() - 0.5) * 800, z: (Math.random() - 0.5) * 800 };

    const buildings: Building[] = [];
    const vehicles: Vehicle[] = [];
    const trees: Tree[] = [];
    const bots: BotEntity[] = [];
    const loot: LootItem[] = [];

    const buildingTypes: Building['type'][] = ['house', 'modern', 'shop', 'warehouse', 'apartment'];
    const vehicleColors = ['#2d3748', '#e2e8f0', '#3182ce', '#e53e3e', '#d69e2e', '#4a5568'];
    const vehicleTypes: Vehicle['type'][] = ['sedan', 'suv', 'van', 'truck'];

    let botIndex = 0;
    for (let x = -2800; x <= 2800; x += 700) {
      for (let z = -2800; z <= 2800; z += 700) {
        if (Math.abs(x) < 250 && Math.abs(z) < 250) continue;

        const bType = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
        let h = 90 + Math.random() * 110;
        if (bType === 'warehouse') h = 100;
        if (bType === 'apartment') h = 240;

        const bx = x + (Math.random() * 100 - 50);
        const bz = z + (Math.random() * 100 - 50);

        buildings.push({
          id: `b_${x}_${z}`,
          x: bx,
          z: bz,
          width: 120 + Math.random() * 70,
          depth: 120 + Math.random() * 70,
          height: h,
          type: bType,
          color: ['#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155'][Math.floor(Math.random() * 5)]
        });

        if (botIndex < 15) {
          bots.push({
            id: `bot_${botIndex}`,
            pos: { x: bx + 180, z: bz + 180 },
            targetPos: { x: bx + 400, z: bz + 400 },
            rotation: Math.random() * Math.PI * 2,
            speed: 2.2 + Math.random() * 1.2,
            state: 'patrol',
            health: 3,
            maxHealth: 3,
            counted: false,
            strideCycle: Math.random() * Math.PI,
            shootTimer: Math.floor(Math.random() * 50),
            deathTimer: 0,
            camo: ['woodland', 'desert', 'black'][Math.floor(Math.random() * 3)]
          });
          botIndex++;
        }

        const randLoot = Math.random();
        let lType: LootItem['type'] = 'health';
        let lName = 'Health Pack';
        let lRarity: LootItem['rarity'] = 'Common';

        if (randLoot < 0.12) {
          lType = 'armor3';
          lName = 'Level 3 Armor';
          lRarity = 'Rare';
        } else if (randLoot < 0.24) {
          lType = 'helmet3';
          lName = 'Level 3 Helmet';
          lRarity = 'Rare';
        } else if (randLoot < 0.36) {
          lType = 'backpack3';
          lName = 'Level 3 Backpack';
          lRarity = 'Rare';
        } else if (randLoot < 0.5) {
          lType = 'armor2';
          lName = 'Level 2 Armor';
          lRarity = 'Uncommon';
        } else if (randLoot < 0.62) {
          lType = 'helmet2';
          lName = 'Level 2 Helmet';
          lRarity = 'Uncommon';
        } else if (randLoot < 0.75) {
          lType = 'backpack1';
          lName = 'Level 1 Backpack';
          lRarity = 'Common';
        } else {
          lType = 'health';
          lName = 'Health Pack';
          lRarity = 'Common';
        }

        loot.push({
          id: `loot_${x}_${z}`,
          x: bx + 60,
          z: bz + 60,
          type: lType,
          name: lName,
          rarity: lRarity,
          collected: false
        });

        if (Math.random() > 0.5) {
          vehicles.push({
            id: `v_${x}_${z}`,
            x: bx + 200,
            z: bz - 100,
            rotation: Math.random() * Math.PI * 2,
            color: vehicleColors[Math.floor(Math.random() * vehicleColors.length)],
            type: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)]
          });
        }
      }
    }

    for (let i = 0; i < 350; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 600 + Math.random() * 3000;
      trees.push({
        id: `tree_${i}`,
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        scale: 0.8 + Math.random() * 1.0,
        type: Math.random() > 0.4 ? 'pine' : 'oak'
      });
    }

    mapDataRef.current = { buildings, trees, vehicles, bots, bullets: [], loot };
    setGameState('playing');
  };

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
    if (gameState !== 'playing') return;
    recoilRef.current = 1.0;
    setShotsFiredCount(prev => prev + 1);
    playGunshotSound(true);

    const p = playerRef.current;
    const muzzleX = p.pos.x + Math.sin(p.rotation) * 20;
    const muzzleZ = p.pos.z + Math.cos(p.rotation) * 20;

    let targetX = p.pos.x + Math.sin(p.rotation) * 1500;
    let targetZ = p.pos.z + Math.cos(p.rotation) * 1500;

    if (targetedBotIdRef.current) {
      const targetBot = mapDataRef.current.bots.find(b => b.id === targetedBotIdRef.current && b.state !== 'dying');
      if (targetBot) {
        targetX = targetBot.pos.x;
        targetZ = targetBot.pos.z;
      }
    }

    const dx = targetX - muzzleX;
    const dz = targetZ - muzzleZ;
    const distance = Math.hypot(dx, dz);
    const bulletSpeed = 90;

    const bulletVx = distance > 0 ? (dx / distance) * bulletSpeed : Math.sin(p.rotation) * bulletSpeed;
    const bulletVz = distance > 0 ? (dz / distance) * bulletSpeed : Math.cos(p.rotation) * bulletSpeed;

    mapDataRef.current.bullets.push({
      id: `bullet_${Date.now()}_${Math.random()}`,
      x: muzzleX,
      z: muzzleZ,
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
    }, 120);
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

  const handleInteract = () => {
    if (gameState !== 'playing') return;
    const p = playerRef.current;
    const lootList = mapDataRef.current.loot;

    for (const item of lootList) {
      if (item.collected) continue;
      const dist = Math.hypot(p.pos.x - item.x, p.pos.z - item.z);
      if (dist < 220) {
        item.collected = true;
        if (item.type === 'health') {
          setPlayerHealth(prev => Math.min(100, prev + 35));
          setInteractMessage('❤️ Health Pack Collected (+35 HP)!');
        } else if (item.type.startsWith('armor')) {
          const lvl = parseInt(item.type.replace('armor', ''));
          setArmorLevel(lvl);
          setInteractMessage(`🛡️ Equipped Level ${lvl} Armor on Body!`);
        } else if (item.type.startsWith('helmet')) {
          const lvl = parseInt(item.type.replace('helmet', ''));
          setHelmetLevel(lvl);
          setInteractMessage(`🪖 Equipped Level ${lvl} Helmet on Head!`);
        } else if (item.type.startsWith('backpack')) {
          const lvl = parseInt(item.type.replace('backpack', ''));
          setBackpackLevel(lvl);
          setInteractMessage(`🎒 Equipped Level ${lvl} Backpack on Back!`);
        } else {
          setInteractMessage(`⚡ ${item.name} Picked Up!`);
        }
        setTimeout(() => setInteractMessage(null), 2500);
        break;
      }
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
      if (e.code === 'KeyE' || e.key === 'e') {
        handleInteract();
      }

      if (e.key === 'ArrowUp' || e.key === 'w') moveDirectionRef.current.up = true;
      if (e.key === 'ArrowDown' || e.key === 's') moveDirectionRef.current.down = true;
      if (e.key === 'ArrowLeft' || e.key === 'a') moveDirectionRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') moveDirectionRef.current.right = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key) keysPressed.current[e.key.toLowerCase()] = false;
      if (e.code) keysPressed.current[e.code.toLowerCase()] = false;

      if (e.key === 'ArrowUp' || e.key === 'w') moveDirectionRef.current.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') moveDirectionRef.current.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a') moveDirectionRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') moveDirectionRef.current.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Camera look touch drag on right side
  const handleTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.clientX >= window.innerWidth / 2 && !lookTouchRef.current.active) {
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

  // Main Render Loop with Proper 3D Human Character & Attached Gear
  useEffect(() => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const minimapCanvas = minimapCanvasRef.current;
    let minimapCtx: CanvasRenderingContext2D | null = null;
    if (minimapCanvas) {
      minimapCtx = minimapCanvas.getContext('2d');
    }

    let animationId: number;
    let lastTime = performance.now();

    const render = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      setMatchTimer(prev => {
        if (prev <= 0) {
          setGameState('defeat');
          return 0;
        }
        return prev - delta;
      });

      setSafeZoneRadius(prev => Math.max(400, prev - delta * 8));

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const width = canvas.width;
      const height = canvas.height;

      const p = playerRef.current;
      const keys = keysPressed.current;
      const dir = moveDirectionRef.current;

      const runningActive = p.isSprinting || keys['shift'] || keys['shiftleft'] || keys['shiftright'];
      const baseSpeed = runningActive ? p.speed * 2.4 : p.speed;
      const speed = p.isCrouching ? baseSpeed * 0.5 : baseSpeed;

      let moveX = 0;
      let moveZ = 0;

      // FIXED DIRECTIONAL MAPPING (↑=forward, ↓=backward, ←=left, →=right, camera relative)
      if (dir.up || keys['w'] || keys['arrowup']) {
        moveX += Math.sin(p.rotation) * speed;
        moveZ += Math.cos(p.rotation) * speed;
      }
      if (dir.down || keys['s'] || keys['arrowdown']) {
        moveX -= Math.sin(p.rotation) * speed;
        moveZ -= Math.cos(p.rotation) * speed;
      }
      if (dir.left || keys['a'] || keys['arrowleft']) {
        moveX -= Math.sin(p.rotation - Math.PI / 2) * speed;
        moveZ -= Math.cos(p.rotation - Math.PI / 2) * speed;
      }
      if (dir.right || keys['d'] || keys['arrowright']) {
        moveX += Math.sin(p.rotation - Math.PI / 2) * speed;
        moveZ += Math.cos(p.rotation - Math.PI / 2) * speed;
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

      const distFromCenter = Math.hypot(p.pos.x, p.pos.z);
      if (distFromCenter > safeZoneRadius) {
        setPlayerHealth(prev => {
          const mitigation = 1.0 - armorLevel * 0.12;
          const nextHP = prev - delta * 5 * mitigation;
          if (nextHP <= 0) {
            setGameState('defeat');
            return 0;
          }
          return nextHP;
        });
      }

      if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
        p.isMoving = true;
        p.strideCycle += speed * 0.15;
      } else {
        p.isMoving = false;
        p.strideCycle = 0;
      }

      recoilRef.current *= 0.82;

      // Update Bullets & Enemy Damage with Armor & Helmet Protection Mitigation
      const bullets = mapDataRef.current.bullets;
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.z += b.vz;
        b.distanceTraveled += Math.hypot(b.vx, b.vz);

        if (b.distanceTraveled > 2500) {
          bullets.splice(i, 1);
          continue;
        }

        if (b.isPlayer) {
          for (const bot of mapDataRef.current.bots) {
            if (bot.state === 'dying') continue;
            const hitDist = Math.hypot(b.x - bot.pos.x, b.z - bot.pos.z);
            if (hitDist < 70) {
              setHitMarkerActive(true);
              setTimeout(() => setHitMarkerActive(false), 2500);

              bot.health -= 1;
              bullets.splice(i, 1);

              if (bot.health <= 0) {
                bot.state = 'dying';
                bot.deathTimer = 0;

                if (!bot.counted) {
                  bot.counted = true;
                  setEnemiesEliminated(prev => {
                    const newKills = prev + 1;
                    setKillNotification('+1 Kill');
                    setTimeout(() => setKillNotification(null), 1500);
                    if (newKills >= 15) {
                      setGameState('victory');
                    }
                    return newKills;
                  });
                }
              }
              break;
            }
          }
        } else {
          const hitPlayer = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
          if (hitPlayer < 30) {
            setPlayerHealth(prev => {
              const armorMitigation = armorLevel === 3 ? 0.35 : armorLevel === 2 ? 0.25 : armorLevel === 1 ? 0.15 : 0;
              const helmetMitigation = helmetLevel === 3 ? 0.35 : helmetLevel === 2 ? 0.25 : helmetLevel === 1 ? 0.15 : 0;
              const totalMitigation = 1.0 - (armorMitigation + helmetMitigation);
              const nextHP = Math.max(0, prev - 14 * totalMitigation);
              if (nextHP <= 0) {
                setGameState('defeat');
              }
              return nextHP;
            });
            bullets.splice(i, 1);
          }
        }
      }

      // Update AI Bots
      mapDataRef.current.bots.forEach((bot) => {
        if (bot.state === 'dying') {
          bot.deathTimer++;
          return;
        }

        const distToPlayer = Math.hypot(bot.pos.x - p.pos.x, bot.pos.z - p.pos.z);

        if (distToPlayer < 900) {
          bot.state = 'shoot';
          bot.rotation = Math.atan2(p.pos.x - bot.pos.x, p.pos.z - bot.pos.z);
          bot.shootTimer++;

          if (bot.shootTimer % 65 === 0) {
            playGunshotSound(false);
            const eBulletSpeed = 38;
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
            bot.targetPos.x = bot.pos.x + (Math.random() * 1400 - 700);
            bot.targetPos.z = bot.pos.z + (Math.random() * 1400 - 700);
          } else {
            bot.rotation = Math.atan2(dx, dz);
            bot.pos.x += Math.sin(bot.rotation) * bot.speed;
            bot.pos.z += Math.cos(bot.rotation) * bot.speed;
            bot.strideCycle += bot.speed * 0.15;
          }
        }
      });

      mapDataRef.current.bots = mapDataRef.current.bots.filter(
        bot => !(bot.state === 'dying' && bot.deathTimer > 25)
      );

      // Render Graphics
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
      for (let gx = -2800; gx <= 2800; gx += 700) {
        const p1 = project(gx, 0, -2800);
        const p2 = project(gx, 0, 2800);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
      for (let gz = -2800; gz <= 2800; gz += 700) {
        const p1 = project(-2800, 0, gz);
        const p2 = project(2800, 0, gz);
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

      mapData.loot.forEach((item) => {
        if (item.collected) return;
        const dist = Math.hypot(item.x - p.pos.x, item.z - p.pos.z);
        if (dist > renderDistance) return;

        renderList.push({
          distance: dist,
          draw: () => {
            const center = project(item.x, -20, item.z);
            if (!center) return;
            ctx.fillStyle = item.rarity === 'Rare' ? '#eab308' : item.rarity === 'Uncommon' ? '#38bdf8' : '#22c55e';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 12 * center.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.type.includes('armor') ? '🛡️' : item.type.includes('helmet') ? '🪖' : item.type.includes('backpack') ? '🎒' : '❤️', center.x, center.y + 4 * center.scale);
          }
        });
      });

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

      let closestBotId: string | null = null;
      let minScreenDist = 140;

      mapData.bots.forEach((bot) => {
        const dist = Math.hypot(bot.pos.x - p.pos.x, bot.pos.z - p.pos.z);
        if (dist > renderDistance) return;

        renderList.push({
          distance: dist,
          draw: () => {
            const center = project(bot.pos.x, bot.state === 'dying' ? bot.deathTimer * 12 : 0, bot.pos.z);
            if (!center) return;
            const sc = center.scale;
            const px = center.x;
            const py = center.y;

            if (bot.state === 'dying') {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
              ctx.font = 'bold 12px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('💀 ELIMINATED', px, py - 60 * sc);
              return;
            }

            const screenDist = Math.hypot(px - width / 2, py - height / 2);
            if (screenDist < minScreenDist) {
              minScreenDist = screenDist;
              closestBotId = bot.id;
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

            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(px - 25 * sc, py - 135 * sc, 50 * sc, 6 * sc);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(px - 25 * sc, py - 135 * sc, (bot.health / bot.maxHealth) * 50 * sc, 6 * sc);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(px - 16 * sc, py - 78 * sc, 30 * sc, 5 * sc);

            if (bot.state === 'shoot' && (bot.shootTimer % 60 < 15)) {
              ctx.fillStyle = '#f6e05e';
              ctx.beginPath();
              ctx.arc(px - 20 * sc, py - 76 * sc, 10 * sc, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      });

      targetedBotIdRef.current = closestBotId;

      renderList.sort((a, b) => b.distance - a.distance);
      renderList.forEach(item => item.draw());

      // Render PROPER 3D HUMAN PLAYER CHARACTER WITH RIGGED ANATOMY & EQUIPPED GEAR (HELMET, ARMOR, BACKPACK)
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

        // Legs / Boots
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(5, 10 * sc);
        ctx.beginPath();
        ctx.moveTo(adjustedPx - 6 * sc, adjustedPy - 50 * sc);
        ctx.lineTo(adjustedPx - 9 * sc + stride * sc, adjustedPy - kneeLift * sc);
        ctx.lineTo(adjustedPx - 11 * sc + stride * sc, adjustedPy);
        ctx.moveTo(adjustedPx + 6 * sc, adjustedPy - 50 * sc);
        ctx.lineTo(adjustedPx + 9 * sc - stride * sc, adjustedPy - (12 - kneeLift) * sc);
        ctx.lineTo(adjustedPx + 11 * sc - stride * sc, adjustedPy);
        ctx.stroke();

        // Backpack on back
        if (backpackLevel > 0) {
          ctx.fillStyle = backpackLevel === 3 ? '#b45309' : backpackLevel === 2 ? '#1d4ed8' : '#334155';
          ctx.fillRect(adjustedPx + 10 * sc, adjustedPy - 105 * sc, 16 * sc, 35 * sc);
        }

        // Torso & Equipped Armor
        ctx.fillStyle = camoStyle === 'black' ? '#111827' : '#374151';
        ctx.fillRect(adjustedPx - 16 * sc, adjustedPy - 110 * sc, 32 * sc, 60 * sc);

        if (armorLevel > 0) {
          ctx.fillStyle = armorLevel === 3 ? '#eab308' : armorLevel === 2 ? '#3b82f6' : '#22c55e';
          ctx.fillRect(adjustedPx - 18 * sc, adjustedPy - 106 * sc, 36 * sc, 34 * sc);
        }

        // Arms & Weapon
        const recoilKick = recoilRef.current * 14 * sc;
        const recoilUp = recoilRef.current * 8 * sc;
        const armSway = p.isMoving ? Math.sin(p.strideCycle) * 4 * sc : Math.sin(timeNow * 1.5) * 1.2 * sc;

        ctx.strokeStyle = camoStyle === 'black' ? '#111827' : '#374151';
        ctx.lineWidth = Math.max(4, 8 * sc);
        ctx.beginPath();
        ctx.moveTo(adjustedPx - 14 * sc, adjustedPy - 95 * sc);
        ctx.lineTo(adjustedPx - 6 * sc + armSway - recoilKick, adjustedPy - 78 * sc - recoilUp);
        ctx.moveTo(adjustedPx + 14 * sc, adjustedPy - 95 * sc);
        ctx.lineTo(adjustedPx + 4 * sc - armSway - recoilKick, adjustedPy - 80 * sc - recoilUp);
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(adjustedPx - 18 * sc - recoilKick, adjustedPy - 86 * sc - recoilUp, 36 * sc, 6 * sc);

        if (recoilRef.current > 0.08) {
          ctx.fillStyle = '#f6e05e';
          ctx.beginPath();
          ctx.arc(adjustedPx - 22 * sc - recoilKick, adjustedPy - 83 * sc - recoilUp, 12 * sc * recoilRef.current, 0, Math.PI * 2);
          ctx.fill();
        }

        // Head, Hair & Equipped Helmet
        ctx.fillStyle = '#f6ad55';
        ctx.beginPath();
        ctx.arc(adjustedPx, adjustedPy - 126 * sc, 13 * sc, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(adjustedPx, adjustedPy - 134 * sc, 12 * sc, Math.PI, Math.PI * 2);
        ctx.fill();

        if (helmetLevel > 0) {
          ctx.fillStyle = helmetLevel === 3 ? '#eab308' : helmetLevel === 2 ? '#3b82f6' : '#22c55e';
          ctx.beginPath();
          ctx.arc(adjustedPx, adjustedPy - 132 * sc, 15 * sc, Math.PI, Math.PI * 2);
          ctx.fill();
        }
      }

      // Render Minimap Radar in top-right
      if (minimapCtx && minimapCanvas) {
        const mw = minimapCanvas.width;
        const mh = minimapCanvas.height;
        minimapCtx.clearRect(0, 0, mw, mh);

        minimapCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        minimapCtx.fillRect(0, 0, mw, mh);
        minimapCtx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        minimapCtx.lineWidth = 2;
        minimapCtx.strokeRect(0, 0, mw, mh);

        const radarScale = 0.04;
        const centerX = mw / 2;
        const centerY = mh / 2;

        minimapCtx.strokeStyle = '#ef4444';
        minimapCtx.lineWidth = 1.5;
        minimapCtx.beginPath();
        minimapCtx.arc(centerX, centerY, safeZoneRadius * radarScale, 0, Math.PI * 2);
        minimapCtx.stroke();

        mapDataRef.current.bots.forEach(bot => {
          if (bot.state === 'dying') return;
          const ex = centerX + (bot.pos.x - p.pos.x) * radarScale;
          const ez = centerY + (bot.pos.z - p.pos.z) * radarScale;
          if (ex >= 0 && ex <= mw && ez >= 0 && ez <= mh) {
            minimapCtx.fillStyle = '#ef4444';
            minimapCtx.beginPath();
            minimapCtx.arc(ex, ez, 3, 0, Math.PI * 2);
            minimapCtx.fill();
          }
        });

        minimapCtx.fillStyle = '#38bdf8';
        minimapCtx.beginPath();
        minimapCtx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        minimapCtx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, timeOfDay, camoStyle, characterName, graphicsQuality, audioEnabled, safeZoneRadius, armorLevel, helmetLevel, backpackLevel]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {gameState === 'lobby' && (
        <div className="flex flex-col flex-1 items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black relative overflow-y-auto">
          <div className="max-w-xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-10 h-10 text-red-500 animate-pulse" />
                <div>
                  <h1 className="text-2xl font-black tracking-wider bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                    FIRESTRIKE ROYALE
                  </h1>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Mobile 3D Battle Royale</p>
                </div>
              </div>

              <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                {isInstalled ? 'Installed' : 'Install PWA'}
              </button>
            </div>

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
                onClick={startNewMatch}
                className="w-full py-4 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black tracking-widest uppercase rounded-2xl shadow-xl shadow-red-600/30 transition-all flex items-center justify-center gap-3 text-sm active:scale-95"
              >
                <Play className="w-5 h-5 fill-white" />
                START BATTLE ROYALE MATCH
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
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

          {/* Center Crosshair & Red Hit Marker Feedback */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="relative flex items-center justify-center">
              <Target className={`w-10 h-10 transition-colors ${hitMarkerActive ? 'text-red-500 scale-125' : targetedBotIdRef.current ? 'text-red-400 animate-pulse scale-110' : 'text-white/70'}`} />
              <div className="absolute w-1.5 h-1.5 bg-red-500 rounded-full shadow-lg" />
              {hitMarkerActive && (
                <div className="absolute -top-8 text-red-500 font-black text-xs tracking-widest animate-ping">
                  [ RED HIT ]
                </div>
              )}
            </div>
          </div>

          {/* Kill Notification Pop-up (+1 Kill) */}
          {killNotification && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-600/95 backdrop-blur-md text-white font-black px-6 py-2.5 rounded-2xl shadow-2xl z-45 animate-bounce text-sm tracking-wider border border-red-400">
              {killNotification} 💀
            </div>
          )}

          {/* Portrait Warning Overlay */}
          {isPortrait && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center">
              <RotateCcw className="w-16 h-16 text-red-500 animate-spin mb-4" />
              <h2 className="text-2xl font-black text-white mb-2">Rotate Your Phone Horizontally</h2>
              <p className="text-slate-400 text-sm max-w-sm mb-6">
                FireStrike Royale is optimized for mobile landscape mode.
              </p>
              <button
                onClick={() => setIsPortrait(false)}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm shadow-lg"
              >
                Dismiss & Play
              </button>
            </div>
          )}

          {/* Top Landscape HUD & Minimap Radar in Top-Right */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-2 shadow-xl flex items-center gap-3 pointer-events-auto">
                <div className="p-2 bg-red-500/20 text-red-500 rounded-xl">
                  <Heart className="w-4 h-4 animate-pulse fill-red-500 text-red-500" />
                </div>
                <div>
                  <h3 className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">HP</h3>
                  <p className="text-xs font-black text-white">{Math.round(playerHealth)} / 100</p>
                </div>
              </div>

              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-2 shadow-xl flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Gear</h3>
                  <p className="text-xs font-black text-white">Helmet: Lv. {helmetLevel || 'None'} | Armor: Lv. {armorLevel || 'None'} | Pack: Lv. {backpackLevel || 'None'}</p>
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

            <div className="flex items-center gap-4 pointer-events-auto">
              {/* Minimap Radar */}
              <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-red-500/50 shadow-2xl bg-slate-900/90 backdrop-blur-md">
                <canvas ref={minimapCanvasRef} width={128} height={128} className="w-full h-full block" />
                <div className="absolute bottom-1 right-1 text-[8px] font-bold text-red-400 uppercase tracking-widest bg-black/60 px-1 rounded">RADAR</div>
              </div>

              <div className="flex items-center gap-2">
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
          </div>

          {/* Loot pickup banner notification */}
          {interactMessage && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-cyan-600/90 backdrop-blur-md text-white font-bold px-6 py-2 rounded-2xl shadow-xl z-30 animate-bounce text-xs">
              {interactMessage}
            </div>
          )}

          {/* Left Side: Directional Arrow Controls */}
          <div className="absolute bottom-6 left-6 w-36 h-36 bg-white/5 backdrop-blur-xs border border-white/20 rounded-3xl p-2 grid grid-cols-3 grid-rows-3 gap-1 z-20 shadow-2xl">
            {/* UP */}
            <button
              onMouseDown={() => (moveDirectionRef.current.up = true)}
              onMouseUp={() => (moveDirectionRef.current.up = false)}
              onMouseLeave={() => (moveDirectionRef.current.up = false)}
              onTouchStart={() => (moveDirectionRef.current.up = true)}
              onTouchEnd={() => (moveDirectionRef.current.up = false)}
              className="col-start-2 row-start-1 bg-slate-900/90 hover:bg-red-600 active:bg-red-700 border border-slate-700 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-md"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
            {/* LEFT */}
            <button
              onMouseDown={() => (moveDirectionRef.current.left = true)}
              onMouseUp={() => (moveDirectionRef.current.left = false)}
              onMouseLeave={() => (moveDirectionRef.current.left = false)}
              onTouchStart={() => (moveDirectionRef.current.left = true)}
              onTouchEnd={() => (moveDirectionRef.current.left = false)}
              className="col-start-1 row-start-2 bg-slate-900/90 hover:bg-red-600 active:bg-red-700 border border-slate-700 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {/* CENTER ICON */}
            <div className="col-start-2 row-start-2 flex items-center justify-center pointer-events-none opacity-40 text-xs font-black text-white">
              MOVE
            </div>
            {/* RIGHT */}
            <button
              onMouseDown={() => (moveDirectionRef.current.right = true)}
              onMouseUp={() => (moveDirectionRef.current.right = false)}
              onMouseLeave={() => (moveDirectionRef.current.right = false)}
              onTouchStart={() => (moveDirectionRef.current.right = true)}
              onTouchEnd={() => (moveDirectionRef.current.right = false)}
              className="col-start-3 row-start-2 bg-slate-900/90 hover:bg-red-600 active:bg-red-700 border border-slate-700 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-md"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            {/* DOWN */}
            <button
              onMouseDown={() => (moveDirectionRef.current.down = true)}
              onMouseUp={() => (moveDirectionRef.current.down = false)}
              onMouseLeave={() => (moveDirectionRef.current.down = false)}
              onTouchStart={() => (moveDirectionRef.current.down = true)}
              onTouchEnd={() => (moveDirectionRef.current.down = false)}
              className="col-start-2 row-start-3 bg-slate-900/90 hover:bg-red-600 active:bg-red-700 border border-slate-700 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-md"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
          </div>

          {/* Right Side Action Controls: Sprint, Jump, Crouch, Interact, Fire */}
          <div className="absolute bottom-6 right-6 flex items-end gap-3 z-25">
            <div className="flex flex-col gap-2">
              <button
                onClick={handleInteract}
                className="w-16 h-16 bg-cyan-600/80 hover:bg-cyan-500 active:scale-95 backdrop-blur-md border border-cyan-400 rounded-2xl text-white font-bold text-[11px] shadow-xl flex flex-col items-center justify-center transition-all"
              >
                <Package className="w-5 h-5 mb-0.5" />
                PICKUP
              </button>
              <button
                onClick={() => {
                  isSprinting ? setIsSprinting(false) : setIsSprinting(true);
                  playerRef.current.isSprinting = !playerRef.current.isSprinting;
                  setIsSprinting(playerRef.current.isSprinting);
                }}
                className={`w-16 h-16 backdrop-blur-md border rounded-2xl font-bold text-xs shadow-xl flex flex-col items-center justify-center active:scale-95 transition-all ${
                  isSprinting
                    ? 'bg-red-600 border-red-400 text-white shadow-red-600/50'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300'
                }`}
              >
                <Footprints className="w-5 h-5 mb-0.5" />
                {isSprinting ? 'SPRINT ON' : 'SPRINT'}
              </button>
              <button
                onClick={triggerJump}
                className="w-16 h-16 bg-slate-900/80 active:bg-red-600/50 backdrop-blur-md border border-slate-700 rounded-2xl text-white font-bold text-xs shadow-xl flex flex-col items-center justify-center active:scale-95 transition-all"
              >
                <ChevronUp className="w-5 h-5 mb-0.5" />
                JUMP
              </button>
            </div>

            {/* Hold-to-Fire Auto Button with Targeted Crosshair Shooting */}
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
                    <span>Red Hit Markers</span>
                    <strong className="text-red-400">Flashing red indicators near crosshair on hit</strong>
                  </li>
                  <li className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span>3D Rigged Human Character</span>
                    <strong className="text-amber-400">Equipped helmets, armor & backpacks attach to body</strong>
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

      {gameState === 'victory' && (
        <div className="flex flex-col flex-1 items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950 via-slate-950 to-black relative">
          <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-amber-500/50 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <Trophy className="w-20 h-20 text-amber-400 mx-auto animate-bounce" />
            <h1 className="text-3xl font-black text-amber-400 tracking-wider">VICTORY ROYALE!</h1>
            <p className="text-slate-300 text-sm">
              Incredible battle! You successfully explored the map, equipped gear, and eliminated hostile operators.
            </p>
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Kills</span>
                <strong className="text-amber-400 text-lg">{enemiesEliminated}</strong>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Shots Fired (∞)</span>
                <strong className="text-cyan-400 text-lg">{shotsFiredCount}</strong>
              </div>
            </div>
            <button
              onClick={() => setGameState('lobby')}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black tracking-widest uppercase rounded-2xl shadow-xl shadow-amber-500/25 transition-all text-sm"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {gameState === 'defeat' && (
        <div className="flex flex-col flex-1 items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950 via-slate-950 to-black relative">
          <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-red-500/50 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <Skull className="w-20 h-20 text-red-500 mx-auto animate-pulse" />
            <h1 className="text-3xl font-black text-red-500 tracking-wider">ELIMINATED</h1>
            <p className="text-slate-300 text-sm">
              You were taken down in combat. Regroup and deploy back into the battlefield!
            </p>
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Kills</span>
                <strong className="text-red-400 text-lg">{enemiesEliminated}</strong>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Shots Fired (∞)</span>
                <strong className="text-cyan-400 text-lg">{shotsFiredCount}</strong>
              </div>
            </div>
            <button
              onClick={() => setGameState('lobby')}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black tracking-widest uppercase rounded-2xl shadow-xl shadow-red-600/30 transition-all text-sm"
            >
              Deploy Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
