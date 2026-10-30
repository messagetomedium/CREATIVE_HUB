import Phaser from 'phaser';
import type { AvatarConfig, GameLocation, PlayerState } from '@creative-factory/contracts';
import { feetDepth } from '@creative-factory/contracts';
import { FIXED_STEP_MS, stepPlayer, zoneAt } from '@creative-factory/world-core';
import { DIRECTIONS } from '../avatar/modular/rig';
import type { GameContent } from './content';
import { GameBridge } from './bridge';
import { KeyboardInput } from './KeyboardInput';
import { GAME_AVATAR, avatarAnimation } from './avatarSheet';
import { followAxis } from './camera';
import { ProximityInteraction } from './interactions';
import { installLocation } from './world/render';
import type { WorldStore } from './world/storage';

/** Shared island/interior scene; the historical name preserves the game integration boundary. */
export class FactoryScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private keyboard?: KeyboardInput;
  private state: PlayerState;
  private previous: PlayerState;
  private accumulator = 0;
  private positionTimer = 0;
  private saveTimer = 0;
  private currentZone?: string;
  private overview = false;
  private tick = 0;
  private world: GameLocation;
  private follow?: { x: number; y: number };
  private proximity = new ProximityInteraction();
  private menuSignature = '';
  private propSprites: ReturnType<typeof installLocation> = [];
  constructor(
    content: GameContent,
    private bridge: GameBridge,
    private avatar: AvatarConfig = content.avatars.defaultAvatar,
    private avatarSheet: HTMLCanvasElement,
    private pixelRatio = 1,
    private store: WorldStore,
    private locationId: GameLocation['id'],
  ) {
    super(locationId);
    this.world = store.location(locationId);
    this.state = store.position(locationId);
    this.previous = this.state;
  }
  create(): void {
    try {
      const world = this.world;
      this.propSprites = installLocation(this, world, this.store.data.seed);
      this.textures.addCanvas('avatar', this.avatarSheet);
      this.textures.addSpriteSheet('', this.textures.get('avatar'), {
        frameWidth: GAME_AVATAR.width,
        frameHeight: GAME_AVATAR.height,
      });
      this.textures.get('avatar').setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const direction of DIRECTIONS)
        for (const mode of ['idle', 'walk'] as const) {
          // Phaser 3.90 uses explicit frame durations instead of the default interval.
          this.anims.create({
            key: `${direction}-${mode}`,
            frames: avatarAnimation(direction, mode).map((f) => ({
              key: 'avatar',
              frame: f.frame,
              duration: f.duration,
            })),
            frameRate: 1000,
            repeat: -1,
          });
        }
      this.shadow = this.add
        .ellipse(this.state.x, this.state.y, 26, 12, 0x253e37, 0.14)
        .setDepth(2);
      this.player = this.add
        .sprite(this.state.x, this.state.y, 'avatar', 0)
        .setOrigin(0.5, 0.875)
        .setScale(GAME_AVATAR.scale)
        .setDepth(feetDepth(this.state.y));
      this.keyboard = new KeyboardInput(this.game.canvas);
      this.game.canvas.setAttribute(
        'aria-label',
        `${world.id === 'island' ? 'Карта острова' : 'Интерьер дома'}. Перемещение: WASD или стрелки.`,
      );
      this.cameras.main
        .setBackgroundColor(world.id === 'island' ? '#70b8bd' : '#a99b89')
        .setRoundPixels(true);
      this.configureCamera();
      this.updateCamera(0, true);
      this.scale.on('resize', this.configureCamera, this);
      const close = this.bridge.on('dismissInteraction', () => {
        this.proximity.close();
        this.emitInteraction();
      });
      const escape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.proximity.close();
          this.emitInteraction();
        }
      };
      const click = (pointer: Phaser.Input.Pointer) => {
        const home = this.propSprites.find((p) => p.id === 'home');
        if (
          home?.sprite instanceof Phaser.GameObjects.Image &&
          home.sprite.getBounds().contains(pointer.worldX, pointer.worldY)
        ) {
          this.proximity.click();
          this.emitInteraction();
        } else if (
          world.id === 'house' &&
          Math.hypot(pointer.worldX - world.door.x, pointer.worldY - world.door.y) < 48
        ) {
          this.proximity.click();
          this.emitInteraction();
        }
      };
      this.input.on('pointerdown', click);
      document.addEventListener('keydown', escape);
      const persist = () => this.persist();
      window.addEventListener('pagehide', persist);
      const hidden = () => {
        if (document.hidden) this.persist();
      };
      document.addEventListener('visibilitychange', hidden);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.persist();
        this.keyboard?.dispose();
        close();
        this.scale.off('resize', this.configureCamera, this);
        this.input.off('pointerdown', click);
        document.removeEventListener('keydown', escape);
        document.removeEventListener('visibilitychange', hidden);
        window.removeEventListener('pagehide', persist);
      });
      this.game.canvas.focus({ preventScroll: true });
      this.updateZone();
      this.bridge.emit('position', this.state);
      this.bridge.emit('ready', undefined);
    } catch (error) {
      this.bridge.emit(
        'error',
        error instanceof Error ? error.message : 'Не удалось запустить сцену',
      );
    }
  }
  persist() {
    try {
      this.store.update(this.locationId, this.state);
      this.store.flush();
    } catch {
      this.bridge.emit(
        'error',
        'Не удалось сохранить остров в этом браузере. Проверьте доступное место.',
      );
    }
  }
  private updateZone() {
    const zone = zoneAt(this.world, this.state);
    if (zone?.id !== this.currentZone) {
      this.currentZone = zone?.id;
      this.bridge.emit('zone', zone);
    }
  }
  setOverview(value: boolean) {
    if (this.overview === value) return;
    this.overview = value;
    if (this.cameras?.main) {
      this.configureCamera();
      this.updateCamera(0, true);
    }
  }
  private configureCamera() {
    const camera = this.cameras.main,
      width = this.world.width * 32,
      height = this.world.height * 32;
    camera.stopFollow();
    if (this.overview) {
      // The solid water/background continues around the complete overview.
      camera
        .removeBounds()
        .setZoom(Math.min(this.scale.width / width, this.scale.height / height) * 0.96)
        .centerOn(width / 2, height / 2);
    } else {
      camera
        .setZoom(Math.max(this.pixelRatio, this.scale.width / width, this.scale.height / height))
        .setBounds(0, 0, width, height);
    }
    this.emitInteraction();
  }
  private updateCamera(delta: number, snap = false) {
    if (this.overview) return;
    const camera = this.cameras.main;
    // Phaser scroll is measured before zoom about the viewport centre, not at
    // the visible top-left. Its bounds clamp includes that same origin offset.
    const x = camera.clampX(this.player.x - this.scale.width / 2);
    const y = camera.clampY(this.player.y - this.scale.height / 2);
    if (!this.follow || snap) this.follow = { x, y };
    const sx = followAxis(this.follow.x, x, delta, 1),
      sy = followAxis(this.follow.y, y, delta, 1);
    this.follow = { x: sx.value, y: sy.value };
    camera.setScroll(sx.display, sy.display);
  }
  private cameraView() {
    const c = this.cameras.main;
    return {
      x: c.scrollX + (c.width - c.width / c.zoom) / 2,
      y: c.scrollY + (c.height - c.height / c.zoom) / 2,
      width: c.width / c.zoom,
      height: c.height / c.zoom,
      zoom: c.zoom,
    };
  }
  private emitInteraction() {
    if (!this.player || !this.proximity.opened) {
      if (this.menuSignature) {
        this.menuSignature = '';
        this.bridge.emit('interaction', undefined);
      }
      return;
    }
    const c = this.cameraView(),
      door = this.world.door;
    const value = {
      id: 'home',
      title: 'Дом',
      x: Math.round(((door.x - c.x) * c.zoom) / this.pixelRatio),
      y: Math.round(((door.y - c.y) * c.zoom) / this.pixelRatio),
      actions: [
        {
          id: 'enter',
          label: this.locationId === 'island' ? 'Войти' : 'Выйти',
          target: this.locationId === 'island' ? ('house' as const) : ('island' as const),
        },
      ],
    };
    const signature = JSON.stringify(value);
    if (signature !== this.menuSignature) {
      this.menuSignature = signature;
      this.bridge.emit('interaction', value);
    }
  }
  update(_time: number, delta: number) {
    if (!this.player || !this.keyboard) return;
    this.accumulator += Math.min(delta, 100);
    const input = this.keyboard.read();
    while (this.accumulator >= FIXED_STEP_MS) {
      this.previous = this.state;
      this.state = stepPlayer(this.state, input, this.world);
      this.accumulator -= FIXED_STEP_MS;
      this.tick++;
    }
    const alpha = this.accumulator / FIXED_STEP_MS;
    const x = Phaser.Math.Linear(this.previous.x, this.state.x, alpha),
      y = Phaser.Math.Linear(this.previous.y, this.state.y, alpha);
    this.player.setPosition(x, y).setDepth(feetDepth(y));
    this.shadow.setPosition(x, y);
    this.player.play(`${this.state.direction}-${this.state.moving ? 'walk' : 'idle'}`, true);
    this.updateCamera(delta);
    this.updateZone();
    this.proximity.update(this.state, this.world.door);
    this.emitInteraction();
    this.positionTimer += delta;
    this.saveTimer += delta;
    if (this.positionTimer >= 100) {
      this.positionTimer = 0;
      this.bridge.emit('position', this.state);
    }
    if (this.saveTimer >= 1000) {
      this.saveTimer = 0;
      this.persist();
    }
  }
  snapshot() {
    const camera = this.cameras?.main;
    return {
      player: { ...this.state },
      avatar: this.avatar,
      zone: this.currentZone,
      tick: this.tick,
      location: this.locationId,
      islandId: this.store.data.id,
      seed: this.store.data.seed,
      world: this.world,
      interaction: this.proximity.opened,
      animation: this.player?.anims.currentAnim?.key,
      frame: this.player?.frame.name,
      animationDurations: this.player?.anims.currentAnim?.frames.map((f) => f.duration),
      rendering: {
        pixelRatio: this.pixelRatio,
        avatarFilter: this.player?.texture.source[0]?.scaleMode,
        projection: 'three-quarter',
        worldSize: this.player
          ? { width: this.player.displayWidth, height: this.player.displayHeight }
          : undefined,
        sourceResolution: this.player?.texture.getSourceImage().width,
        origin: this.player ? { x: this.player.originX, y: this.player.originY } : undefined,
        playerDepth: this.player?.depth,
        playerRenderY: this.player?.y,
        playerRenderX: this.player?.x,
        props: this.propSprites.map(({ id, sprite }) => ({
          id,
          depth: sprite.depth,
          x: sprite.x,
          y: sprite.y,
        })),
        textures: this.textures
          ? [
              'avatar',
              'landscape',
              ...(this.locationId === 'island' ? ['home'] : ['interior-wall']),
            ].map((key) => {
              const image = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
              return { key, width: image.width, height: image.height };
            })
          : [],
      },
      camera: camera ? this.cameraView() : undefined,
      map: { width: this.world.width * 32, height: this.world.height * 32 },
    };
  }
}
