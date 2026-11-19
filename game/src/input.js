// Keyboard and mouse input: a held-key set, a queue of one-shot presses, drag/pointer-lock
// camera orbit deltas, wheel zoom and the left-button state combat reads. The canvas asks
// for pointer lock on click during play; dragging works as a fallback everywhere.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let orbitDX = 0;
  let orbitDY = 0;
  let wheelDelta = 0;
  let mouseDown = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let locked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) {
    held.delete(e.code);
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) {
      mouseDown = false;
      dragging = false;
    }
  }
  function onMouseMove(e) {
    if (locked) {
      orbitDX += e.movementX ?? 0;
      orbitDY += e.movementY ?? 0;
    } else if (dragging) {
      orbitDX += e.clientX - lastX;
      orbitDY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }
  function onWheel(e) {
    wheelDelta += e.deltaY;
    e.preventDefault();
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    /** True while a key (KeyboardEvent.code) is held. */
    down: (code) => held.has(code),
    /** True once per physical press; consumes the press. */
    take: (code) => {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    /** Forward input: W/S or the arrow keys, as -1..1. */
    forward() {
      return (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
    },
    /** Side input: D/A or the arrow keys, as -1..1 (right positive). */
    strafe() {
      return (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
    },
    /** The left mouse button, held (shooting and punching read this). */
    get firing() { return mouseDown; },
    /** Take the accumulated camera orbit movement since the last frame. */
    takeOrbit() {
      const out = { dx: orbitDX, dy: orbitDY, wheel: wheelDelta };
      orbitDX = 0;
      orbitDY = 0;
      wheelDelta = 0;
      return out;
    },
    /** Ask for pointer lock (called on canvas click while playing). */
    lock() {
      if (!locked && canvas.requestPointerLock) canvas.requestPointerLock();
    },
    get locked() { return locked; },
    /** Clear one-shot presses (on screen changes, so a menu click never fires a shot). */
    flush() {
      pressed.clear();
      mouseDown = false;
    },
  };
}
