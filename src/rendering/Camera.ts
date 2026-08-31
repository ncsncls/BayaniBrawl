// ============================================================================
// Camera: keeps both fighters framed, zooms with distance, never crops a
// fighter, never zooms so far that sprites get tiny.
// ============================================================================

import { VIEW_BASE_W, VIEW_BASE_H, VIEW_MIN_W, VIEW_MAX_W, BALANCE } from '../data/balance';

export class Camera {
  /** world x at the left edge of the view */
  x = 0;
  /** logical view width in world units (zoom) */
  viewW = VIEW_BASE_W;
  viewH = VIEW_BASE_H;
  shakeX = 0;
  shakeY = 0;
  private shake = 0;
  private targetX = 0;
  private targetW = VIEW_BASE_W;
  /** stage bounds */
  private left = 0;
  private right = 1400;

  setStage(left: number, right: number): void {
    this.left = left;
    this.right = right;
  }

  setAspect(aspect: number): void {
    // keep width authoritative; derive height from the canvas aspect
    this.viewH = Math.round(this.viewW / aspect);
  }

  snap(ax: number, bx: number, aspect: number): void {
    this.compute(ax, bx, aspect);
    this.x = this.targetX;
    this.viewW = this.targetW;
    this.viewH = Math.round(this.viewW / aspect);
  }

  private compute(ax: number, bx: number, aspect: number): void {
    const mid = (ax + bx) / 2;
    const dist = Math.abs(ax - bx);
    // widen the view as the fighters separate, with generous padding
    const want = Math.max(VIEW_MIN_W, Math.min(VIEW_MAX_W, dist * 1.9 + 250));
    this.targetW = want;
    const half = want / 2;
    let cx = mid - half;
    const maxX = Math.max(this.left, this.right - want);
    cx = Math.max(this.left, Math.min(maxX, cx));
    this.targetX = cx;
  }

  update(ax: number, bx: number, aspect: number, dt = 1): void {
    this.compute(ax, bx, aspect);
    const lerp = 0.14 * dt;
    this.x += (this.targetX - this.x) * lerp;
    this.viewW += (this.targetW - this.viewW) * (0.09 * dt);
    this.viewH = this.viewW / aspect;

    if (this.shake > 0.05) {
      this.shakeX = (Math.random() - 0.5) * this.shake * 2;
      this.shakeY = (Math.random() - 0.5) * this.shake * 1.4;
      this.shake *= BALANCE.shakeDecay;
    } else {
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  addShake(amount: number, enabled = true): void {
    if (!enabled) return;
    this.shake = Math.min(BALANCE.maxShake, this.shake + amount);
  }

  /** world -> view-local coordinates (before the canvas scale) */
  get offsetX(): number {
    return this.x - this.shakeX;
  }

  get offsetY(): number {
    return this.shakeY;
  }
}
