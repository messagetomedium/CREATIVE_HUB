import Phaser from 'phaser';
import type { AvatarConfig, PlayerState, Workshop } from '@creative-factory/contracts';
import { FIXED_STEP_MS, initialPlayer, stepPlayer, zoneAt } from '@creative-factory/world-core';
import type { GameContent } from './content';
import { GameBridge } from './bridge';
import { KeyboardInput } from './KeyboardInput';
import { makeAvatar, makeProp } from './placeholderArt';

export class FactoryScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private ring!: Phaser.GameObjects.Ellipse;
  private shadow!: Phaser.GameObjects.Ellipse;
  private marker?: Phaser.GameObjects.Graphics;
  private keyboard?: KeyboardInput;
  private state: PlayerState;
  private previous: PlayerState;
  private accumulator = 0;
  private positionTimer = 0;
  private currentZone?: string;
  private overview = false;
  private destination?: string;
  private tick = 0;
  constructor(
    private content: GameContent,
    private bridge: GameBridge,
    private avatar: AvatarConfig = content.avatars.defaultAvatar,
  ) {
    super('factory');
    this.state = initialPlayer(content.world);
    this.previous = this.state;
  }
  preload(): void {
    this.load.image('factory-tiles', this.content.manifest.tilesUrl);
    const sprite = this.content.avatars.sprite;
    if (sprite.source.kind === 'spritesheet')
      this.load.spritesheet('avatar', sprite.source.url, {
        frameWidth: sprite.frameWidth,
        frameHeight: sprite.frameHeight,
      });
    this.load.on('loaderror', () =>
      this.bridge.emit('error', 'Не удалось загрузить графику карты. Обновите страницу.'),
    );
  }
  create(): void {
    try {
      if (!this.textures.exists('factory-tiles')) throw new Error('Tileset карты не загрузился');
      const { world, avatars } = this.content;
      const rows = Array.from({ length: world.height }, (_, i) =>
        world.ground.slice(i * world.width, (i + 1) * world.width),
      );
      const map = this.make.tilemap({
        data: rows,
        tileWidth: world.tileSize,
        tileHeight: world.tileSize,
      });
      const tiles = map.addTilesetImage(
        'factory-tiles',
        'factory-tiles',
        world.tileSize,
        world.tileSize,
        0,
        0,
      );
      if (!tiles) throw new Error('Не удалось создать слои карты');
      map.createLayer(0, tiles, 0, 0)?.setDepth(0);
      const walls = map.createBlankLayer('solids', tiles, 0, 0);
      const wallRows = Array.from({ length: world.height }, (_, y) =>
        world.solids.slice(y * world.width, (y + 1) * world.width).map((solid) => (solid ? 7 : -1)),
      );
      walls?.putTilesAt(wallRows, 0, 0);
      walls?.setDepth(4000);
      this.drawWayfinding();
      for (const prop of world.props) {
        this.add
          .ellipse(
            prop.bounds.x + prop.bounds.width / 2 + 2,
            prop.bounds.y + prop.bounds.height / 2 + 3,
            prop.bounds.width + 4,
            prop.bounds.height + 4,
            0x253e37,
            0.1,
          )
          .setDepth(500);
        this.add
          .image(prop.bounds.x, prop.bounds.y, makeProp(this, prop))
          .setOrigin(0, 0)
          .setDepth(1000 + prop.bounds.y + prop.bounds.height);
      }
      if (avatars.sprite.source.kind === 'procedural') makeAvatar(this, avatars, this.avatar);
      for (const [direction, animation] of Object.entries(avatars.sprite.animations)) {
        for (const mode of ['idle', 'walk'] as const)
          this.anims.create({
            key: `${direction}-${mode}`,
            frames: this.anims.generateFrameNumbers('avatar', { frames: animation[mode] }),
            frameRate: mode === 'idle' ? 2 : 9,
            repeat: -1,
          });
      }
      this.shadow = this.add
        .ellipse(this.state.x + 2, this.state.y + 4, 31, 24, 0x253e37, 0.15)
        .setDepth(501);
      this.ring = this.add
        .ellipse(this.state.x, this.state.y, 43, 43)
        .setStrokeStyle(2, 0x54705a, 0.7)
        .setDepth(502);
      this.player = this.add
        .sprite(this.state.x, this.state.y, 'avatar', 0)
        .setDepth(1000 + this.state.y);
      this.keyboard = new KeyboardInput(this.game.canvas);
      this.cameras.main
        .setBackgroundColor('#e0e4da')
        .setBounds(0, 0, world.width * world.tileSize, world.height * world.tileSize)
        .setRoundPixels(true);
      this.configureCamera();
      this.paintDestination();
      this.scale.on('resize', this.configureCamera, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.keyboard?.dispose();
        this.scale.off('resize', this.configureCamera, this);
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
  private drawWayfinding(): void {
    const style = {
      fontFamily: 'Arial, sans-serif',
      color: '#43574d',
      fontSize: '28px',
      fontStyle: 'bold',
    };
    for (const workshop of this.content.world.workshops) {
      const { x, y, width } = workshop.room;
      this.add
        .rectangle(
          x * 32 + 44,
          y * 32 + 43,
          22,
          4,
          Phaser.Display.Color.HexStringToColor(workshop.accent).color,
        )
        .setOrigin(0, 0)
        .setDepth(2);
      this.add
        .text(
          x * 32 + 44,
          y * 32 + 55,
          workshop.code + ' / ' + workshop.name.toLocaleUpperCase('ru'),
          style,
        )
        .setDepth(2);
      this.add
        .text(x * 32 + 44, y * 32 + 94, workshop.discipline, {
          ...style,
          fontSize: '14px',
          fontStyle: 'normal',
          color: '#68776b',
        })
        .setDepth(2);
      const doorX = (x + workshop.door.offset + workshop.door.width / 2) * 32;
      const doorY =
        (workshop.door.side === 'south' ? y + workshop.room.height - 0.5 : y + 0.5) * 32;
      const color = Phaser.Display.Color.HexStringToColor(workshop.accent).color;
      this.add.rectangle(doorX, doorY, 100, 8, color, 0.65).setDepth(2);
      this.add
        .text(
          (x + width / 2) * 32,
          workshop.door.side === 'south' ? doorY - 38 : doorY + 25,
          'ЦЕХ ' + workshop.code,
          { ...style, fontSize: '12px', color: '#68776b' },
        )
        .setOrigin(0.5)
        .setDepth(2);
    }
    this.add
      .text(1024, 749, 'CF', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '94px',
        fontStyle: 'bold',
        color: '#c3ccbb',
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.add
      .text(1024, 555, 'ЦЕНТРАЛЬНЫЙ\nХОЛЛ', {
        ...style,
        fontSize: '20px',
        align: 'center',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(1024, 950, 'МЕСТО ВСТРЕЧИ ИДЕЙ', {
        ...style,
        fontSize: '11px',
        color: '#8c9886',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(2);
    for (const [x, text] of [
      [736, '← 01 / 03'],
      [1312, '02 / 04 →'],
    ] as const)
      this.add
        .text(x, 796, text, { ...style, fontSize: '17px', color: '#7f8b78' })
        .setOrigin(0.5)
        .setDepth(2);
  }
  private updateZone(): void {
    const zone = zoneAt(this.content.world, this.state);
    if (zone?.id !== this.currentZone) {
      this.currentZone = zone?.id;
      this.bridge.emit('zone', zone);
    }
  }
  setOverview(value: boolean): void {
    this.overview = value;
    if (this.cameras?.main) this.configureCamera();
  }
  selectWorkshop(id?: string): void {
    this.destination = id;
    if (this.player) this.paintDestination();
  }
  private paintDestination(): void {
    this.marker?.destroy();
    this.marker = undefined;
    const workshop: Workshop | undefined = this.content.world.workshops.find(
      (w) => w.id === this.destination,
    );
    if (!workshop) return;
    const x = (workshop.room.x + workshop.door.offset + workshop.door.width / 2) * 32;
    const y =
      (workshop.door.side === 'north'
        ? workshop.room.y + 0.5
        : workshop.room.y + workshop.room.height - 0.5) * 32;
    this.marker = this.add.graphics().setDepth(600);
    this.marker.lineStyle(3, 0x3b5d46, 0.9).strokeCircle(x, y, 24);
    this.marker.fillStyle(0x3b5d46, 0.9).fillTriangle(x - 7, y - 5, x + 7, y - 5, x, y + 7);
  }
  private configureCamera(): void {
    const camera = this.cameras.main,
      world = this.content.world;
    if (this.overview) {
      camera
        .stopFollow()
        .removeBounds()
        .setZoom(
          Math.min(this.scale.width / (world.width * 32), this.scale.height / (world.height * 32)) *
            0.96,
        )
        .centerOn(world.width * 16, world.height * 16);
    } else {
      // At normal desktop sizes this is 1:1. Tiny viewports never reveal space outside the world.
      const zoom = Math.max(
        1,
        this.scale.width / (world.width * 32),
        this.scale.height / (world.height * 32),
      );
      camera
        .setBounds(0, 0, world.width * 32, world.height * 32)
        .setZoom(zoom)
        .startFollow(this.player, true, 0.18, 0.18)
        .centerOn(this.state.x, this.state.y);
    }
  }
  update(_time: number, delta: number): void {
    if (!this.player || !this.keyboard) return;
    this.accumulator += Math.min(delta, 100);
    const input = this.keyboard.read();
    while (this.accumulator >= FIXED_STEP_MS) {
      this.previous = this.state;
      this.state = stepPlayer(this.state, input, this.content.world);
      this.accumulator -= FIXED_STEP_MS;
      this.tick++;
    }
    const alpha = this.accumulator / FIXED_STEP_MS;
    const x = Phaser.Math.Linear(this.previous.x, this.state.x, alpha),
      y = Phaser.Math.Linear(this.previous.y, this.state.y, alpha);
    this.player.setPosition(x, y).setDepth(1000 + y);
    this.shadow.setPosition(x + 2, y + 4);
    this.ring.setPosition(x, y);
    this.player.play(`${this.state.direction}-${this.state.moving ? 'walk' : 'idle'}`, true);
    this.updateZone();
    this.positionTimer += delta;
    if (this.positionTimer >= 100) {
      this.positionTimer = 0;
      this.bridge.emit('position', this.state);
    }
  }
  snapshot() {
    const camera = this.cameras?.main;
    return {
      player: { ...this.state },
      avatar: this.avatar,
      zone: this.currentZone,
      tick: this.tick,
      animation: this.player?.anims.currentAnim?.key,
      frame: this.player?.frame.name,
      camera: camera
        ? {
            x: camera.worldView.x,
            y: camera.worldView.y,
            width: camera.worldView.width,
            height: camera.worldView.height,
            zoom: camera.zoom,
          }
        : undefined,
      map: { width: this.content.world.width * 32, height: this.content.world.height * 32 },
    };
  }
}
