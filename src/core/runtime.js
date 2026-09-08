/**
 * Minimal component runtime: hyperscript, virtual DOM diffing and React-like
 * hooks. No build step required — plain ES modules in the browser.
 *
 * Why a micro-runtime instead of a framework: this app ships as a static PWA
 * with zero tooling, but still needs real components, local state and effects.
 */

const EMPTY_PROPS = Object.freeze({});

/** Create a virtual node. `type` is a tag name or a component function. */
export function h(type, props, ...children) {
  const flat = children.flat(Infinity).filter((c) => c != null && typeof c !== 'boolean');
  const p = props || EMPTY_PROPS;
  return { type, props: p, children: flat, key: p.key ?? null };
}

/** Fragment component: renders its children without a wrapper element. */
export function Fragment(props) {
  return props.children;
}

// --------------------------------------------------------------------------
// Component instances and hooks
// --------------------------------------------------------------------------

let currentInstance = null;
let pendingEffects = [];
let scheduledRoot = null;

function createInstance() {
  return { hooks: [], cursor: 0, children: new Map(), alive: true };
}

/** Read (or lazily create) the hook slot for the rendering component. */
function hookSlot(initialValue) {
  const inst = currentInstance;
  if (!inst) throw new Error('Hooks can only be called during a component render.');
  const index = inst.cursor++;
  if (inst.hooks.length <= index) inst.hooks.push({ value: initialValue });
  return inst.hooks[index];
}

/** Local component state. Returns [value, setValue]. */
export function useState(initial) {
  const inst = currentInstance;
  const slot = hookSlot(typeof initial === 'function' ? initial() : initial);
  const setValue = (next) => {
    const value = typeof next === 'function' ? next(slot.value) : next;
    if (Object.is(value, slot.value)) return;
    slot.value = value;
    scheduleRender();
  };
  slot.owner = inst;
  return [slot.value, setValue];
}

/** Mutable box that survives re-renders (never triggers a render). */
export function useRef(initial) {
  const slot = hookSlot(null);
  if (slot.value === null) slot.value = { current: initial };
  return slot.value;
}

function depsChanged(prev, next) {
  if (!prev || !next || prev.length !== next.length) return true;
  return next.some((d, i) => !Object.is(d, prev[i]));
}

/** Run a side effect after the DOM is committed. */
export function useEffect(effect, deps) {
  const slot = hookSlot(null);
  if (slot.value === null) slot.value = { deps: undefined, cleanup: undefined };
  const state = slot.value;
  if (depsChanged(state.deps, deps)) {
    state.deps = deps;
    pendingEffects.push(() => {
      if (typeof state.cleanup === 'function') state.cleanup();
      state.cleanup = effect() || undefined;
    });
  }
}

/** Memoize an expensive computation between renders. */
export function useMemo(factory, deps) {
  const slot = hookSlot(null);
  if (slot.value === null) slot.value = { deps: undefined, result: undefined };
  const state = slot.value;
  if (depsChanged(state.deps, deps)) {
    state.deps = deps;
    state.result = factory();
  }
  return state.result;
}

/** Stable callback identity between renders. */
export function useCallback(fn, deps) {
  return useMemo(() => fn, deps);
}

/** Force a re-render from imperative code (rare; prefer state). */
export function useForceUpdate() {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((t) => t + 1), []);
}

// --------------------------------------------------------------------------
// Expansion: component tree -> host-element tree
// --------------------------------------------------------------------------

function expand(vnode, owner, slotKey) {
  if (vnode == null || typeof vnode !== 'object') return vnode;
  if (Array.isArray(vnode)) return vnode.map((c, i) => expand(c, owner, `${slotKey}.${i}`));

  if (typeof vnode.type === 'function') {
    const key = `${vnode.key ?? slotKey}:${vnode.type.name || 'anon'}`;
    let instance = owner.children.get(key);
    if (!instance) {
      instance = createInstance();
      owner.children.set(key, instance);
    }
    instance.alive = true;

    const previous = currentInstance;
    currentInstance = instance;
    instance.cursor = 0;
    const output = vnode.type({ ...vnode.props, children: vnode.children });
    currentInstance = previous;

    return expand(output, instance, `${slotKey}.0`);
  }

  return {
    ...vnode,
    children: vnode.children.map((c, i) => expand(c, owner, `${slotKey}.${i}`)).flat(Infinity),
  };
}

/** Drop instances that were not rendered this pass and run their cleanups. */
function sweep(instance) {
  for (const [key, child] of instance.children) {
    if (!child.alive) {
      unmount(child);
      instance.children.delete(key);
    } else {
      child.alive = false; // reset for the next pass
      sweep(child);
    }
  }
}

function unmount(instance) {
  for (const hook of instance.hooks) {
    if (hook.value && typeof hook.value.cleanup === 'function') hook.value.cleanup();
  }
  for (const child of instance.children.values()) unmount(child);
  instance.children.clear();
}

// --------------------------------------------------------------------------
// DOM patching
// --------------------------------------------------------------------------

const isEventProp = (name) => name.startsWith('on') && name.length > 2;

function applyProps(el, next, prev = EMPTY_PROPS) {
  // Remove props that disappeared.
  for (const name in prev) {
    if (name === 'key' || name in next) continue;
    if (isEventProp(name)) {
      el.removeEventListener(name.slice(2).toLowerCase(), prev[name]);
    } else if (name === 'style') {
      el.removeAttribute('style');
    } else {
      el.removeAttribute(name === 'className' ? 'class' : name);
    }
  }

  for (const name in next) {
    if (name === 'key' || name === 'children') continue;
    const value = next[name];
    const old = prev[name];
    if (Object.is(value, old)) continue;

    if (isEventProp(name)) {
      const type = name.slice(2).toLowerCase();
      if (old) el.removeEventListener(type, old);
      if (value) el.addEventListener(type, value);
    } else if (name === 'ref') {
      if (value && typeof value === 'object') value.current = el;
    } else if (name === 'style') {
      if (typeof value === 'string') el.setAttribute('style', value);
      else {
        el.removeAttribute('style');
        Object.assign(el.style, value);
      }
    } else if (name === 'className') {
      el.setAttribute('class', value ?? '');
    } else if (name === 'value' || name === 'checked' || name === 'disabled') {
      // Set as a property so controlled inputs keep caret/selection.
      if (el[name] !== value) el[name] = value ?? (name === 'value' ? '' : false);
    } else if (name === 'dangerouslySetInnerHTML') {
      el.innerHTML = value;
    } else if (value === false || value == null) {
      el.removeAttribute(name);
    } else {
      el.setAttribute(name, value === true ? '' : value);
    }
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function createDom(vnode, inSvg = false) {
  if (vnode == null) return document.createComment('');
  if (typeof vnode !== 'object') return document.createTextNode(String(vnode));
  // Once inside <svg>, every descendant needs the SVG namespace.
  const isSvg = inSvg || vnode.type === 'svg';
  const el = isSvg ? document.createElementNS(SVG_NS, vnode.type) : document.createElement(vnode.type);
  applyProps(el, vnode.props);
  for (const child of vnode.children) el.appendChild(createDom(child, isSvg));
  return el;
}

const sameType = (a, b) => {
  if (a == null || b == null) return a === b;
  const aText = typeof a !== 'object';
  const bText = typeof b !== 'object';
  if (aText || bText) return aText && bText;
  return a.type === b.type && a.key === b.key;
};

function patch(parentDom, domNode, newVNode, oldVNode, inSvg = false) {
  if (!sameType(newVNode, oldVNode)) {
    const fresh = createDom(newVNode, inSvg);
    parentDom.replaceChild(fresh, domNode);
    return fresh;
  }
  if (typeof newVNode !== 'object' || newVNode == null) {
    if (domNode.nodeValue !== String(newVNode)) domNode.nodeValue = String(newVNode);
    return domNode;
  }

  applyProps(domNode, newVNode.props, oldVNode.props);
  patchChildren(domNode, newVNode.children, oldVNode.children, inSvg || newVNode.type === 'svg');
  return domNode;
}

function patchChildren(parentDom, newChildren, oldChildren, inSvg = false) {
  const max = Math.max(newChildren.length, oldChildren.length);
  for (let i = 0; i < max; i++) {
    const next = newChildren[i];
    const prev = oldChildren[i];
    const dom = parentDom.childNodes[i];
    if (prev === undefined) {
      parentDom.appendChild(createDom(next, inSvg));
    } else if (next === undefined) {
      // Remove trailing nodes (iterate from the end to keep indexes valid).
      while (parentDom.childNodes.length > newChildren.length) {
        parentDom.removeChild(parentDom.lastChild);
      }
      break;
    } else {
      patch(parentDom, dom, next, prev, inSvg);
    }
  }
}

// --------------------------------------------------------------------------
// Root rendering
// --------------------------------------------------------------------------

function flushEffects() {
  const effects = pendingEffects;
  pendingEffects = [];
  for (const run of effects) run();
}

function scheduleRender() {
  if (!scheduledRoot || scheduledRoot.queued) return;
  scheduledRoot.queued = true;
  queueMicrotask(() => {
    scheduledRoot.queued = false;
    renderRoot(scheduledRoot);
  });
}

function renderRoot(root) {
  const expanded = expand(h(root.component, root.props), root.instance, '0');
  const tree = Array.isArray(expanded) ? expanded : [expanded];

  if (!root.mounted) {
    for (const node of tree) root.container.appendChild(createDom(node));
    root.mounted = true;
  } else {
    patchChildren(root.container, tree, root.previous);
  }
  root.previous = tree;

  sweep(root.instance);
  flushEffects();
}

/** Mount a component into a DOM container and keep it updated. */
export function mount(component, container, props = {}) {
  const root = {
    component,
    props,
    container,
    instance: createInstance(),
    previous: [],
    mounted: false,
    queued: false,
  };
  scheduledRoot = root;
  renderRoot(root);
  return root;
}
