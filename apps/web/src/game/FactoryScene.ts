import Phaser from 'phaser';
import type { AvatarConfig, PlayerState, Workshop } from '@creative-factory/contracts';
import { feetDepth, SHADOW_DEPTH, wallFrame } from '@creative-factory/contracts';
import { FIXED_STEP_MS, initialPlayer, stepPlayer, zoneAt } from '@creative-factory/world-core';
import type { GameContent } from './content';
import { GameBridge } from './bridge';
import { KeyboardInput } from './KeyboardInput';
import { makeAvatar } from './placeholderArt';
import { installSceneArt, propAppearance } from './sceneArt';
import { contentPath } from './contentPath';

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
  private propSprites: { id: string; sprite: Phaser.GameObjects.Image }[] = [];
  constructor(
    private content: GameContent,
    private bridge: GameBridge,
    private avatar: AvatarConfig = content.avatars.defaultAvatar,
    private avatarSheet: HTMLCanvasElement,
  ) {
    super('factory');
    this.state = initialPlayer(content.world);
    this.previous = this.state;
  }
  preload(): void {
    this.load.image('factory-tiles', this.content.manifest.tilesUrl);
    for (const [key, spec] of [
      ['props', this.content.sceneArt.props],
      ['walls', this.content.sceneArt.walls],
    ] as const)
      if (spec.source.kind === 'spritesheet')
        this.load.spritesheet(key, contentPath(spec.source.url, import.meta.env.BASE_URL), {
          frameWidth: spec.frameWidth,
          frameHeight: spec.frameHeight,
        });
    this.load.on('loaderror', () =>
      this.bridge.emit('error', 'Не удалось загрузить графику карты. Обновите страницу.'),
    );
  }
  create(): void {
    try {
      if (!this.textures.exists('factory-tiles')) throw new Error('Tileset карты не загрузился');
      const { world, avatars, sceneArt } = this.content;
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
      installSceneArt(this, sceneArt);
      // The original solids grid remains the collider. Only its visual representation changes.
      for (let y = 0; y < world.height; y++)
        for (let x = 0; x < world.width; x++) {
          if (!world.solids[y * world.width + x]) continue;
          const frame = wallFrame(
            x > 0 && world.solids[y * world.width + x - 1]!,
            x + 1 < world.width && world.solids[y * world.width + x + 1]!,
          );
          this.add
            .image(x * 32 + 16, (y + 1) * 32, 'walls', frame)
            .setOrigin(sceneArt.walls.anchor.x / 32, sceneArt.walls.anchor.y / 64)
            .setDepth(feetDepth((y + 1) * 32));
        }
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
          .setDepth(SHADOW_DEPTH);
        const appearance = propAppearance(sceneArt, prop);
        const sprite = this.add
          .image(
            prop.bounds.x + prop.bounds.width / 2,
            prop.bounds.y + prop.bounds.height,
            'props',
            appearance.frame,
          )
          .setOrigin(
            sceneArt.props.anchor.x / sceneArt.props.frameWidth,
            sceneArt.props.anchor.y / sceneArt.props.frameHeight,
          )
          .setDepth(feetDepth(prop.bounds.y + prop.bounds.height));
        this.propSprites.push({ id: prop.id, sprite });
      }
      makeAvatar(this, avatars, this.avatarSheet);
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
        .ellipse(this.state.x, this.state.y, 26, 12, 0x253e37, 0.15)
        .setDepth(501);
      this.ring = this.add
        .ellipse(this.state.x, this.state.y, 36, 18)
        .setStrokeStyle(2, 0x54705a, 0.7)
        .setDepth(502);
      this.player = this.add
        .sprite(this.state.x, this.state.y, 'avatar', 0)
        .setOrigin(
          avatars.sprite.anchor.x / avatars.sprite.frameWidth,
          avatars.sprite.anchor.y / avatars.sprite.frameHeight,
        )
        .setDepth(feetDepth(this.state.y));
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
    this.player.setPosition(x, y).setDepth(feetDepth(y));
    this.shadow.setPosition(x, y);
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
      rendering: {
        projection: this.content.sceneArt.projection,
        origin: this.player ? { x: this.player.originX, y: this.player.originY } : undefined,
        playerDepth: this.player?.depth,
        playerRenderY: this.player?.y,
        props: this.propSprites.map(({ id, sprite }) => ({
          id,
          depth: sprite.depth,
          x: sprite.x,
          y: sprite.y,
        })),
        textures: this.textures
          ? ['avatar', 'props', 'walls'].map((key) => {
              const image = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
              return { key, width: image.width, height: image.height };
            })
          : [],
      },
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
