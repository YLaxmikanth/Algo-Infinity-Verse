document.addEventListener('DOMContentLoaded', () => {
  initHeroTyping();
  updateVisualization();
});

function initHeroTyping() {
  const el = document.getElementById('typingTextVisualizer');
  if (!el) return;

  const words = [
    'Build and inspect B-Trees',
    'Insert keys step by step',
    'Search nodes with highlights',
    'Explore degree-based splits'
  ];

  let wordIdx = 0;
  let charIdx = 0;
  let isDeleting = false;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    el.textContent = words[0];
    return;
  }

  function tick() {
    const current = words[wordIdx];

    if (isDeleting) {
      el.textContent = current.substring(0, charIdx - 1);
      charIdx--;
    } else {
      el.textContent = current.substring(0, charIdx + 1);
      charIdx++;
    }

    let speed = isDeleting ? 50 : 100;

    if (!isDeleting && charIdx === current.length) {
      speed = 1800;
      isDeleting = true;
    } else if (isDeleting && charIdx === 0) {
      isDeleting = false;
      wordIdx = (wordIdx + 1) % words.length;
      speed = 500;
    }

    requestAnimationFrame(() => setTimeout(tick, speed));
  }

  tick();
}

class BTreeNode {
  constructor(leaf = true) {
    this.leaf = leaf;
    this.keys = [];
    this.children = [];
  }
}

function cloneNode(node) {
  if (!node) return null;
  const copy = new BTreeNode(node.leaf);
  copy.keys = [...node.keys];
  for (const child of node.children) {
    copy.children.push(cloneNode(child));
  }
  return copy;
}

class BTree {
  constructor(t = 3) {
    this.t = t;
    this.root = new BTreeNode(true);
    this.steps = [];
  }

  recordStep(message, highlightKeys = []) {
    const keysSnapshot = highlightKeys ? Array.from(highlightKeys) : [];
    this.steps.push({
      tree: cloneNode(this.root),
      message,
      highlightKeys: keysSnapshot
    });
  }

  splitChild(parent, index) {
    const t = this.t;
    const fullChild = parent.children[index];
    const newChild = new BTreeNode(fullChild.leaf);
    const median = fullChild.keys[t - 1];

    this.recordStep(
      `Node [${fullChild.keys.join(', ')}] is full. Splitting around median ${median}.`,
      [median]
    );

    newChild.keys = fullChild.keys.slice(t);
    fullChild.keys = fullChild.keys.slice(0, t - 1);

    if (!fullChild.leaf) {
      newChild.children = fullChild.children.slice(t);
      fullChild.children = fullChild.children.slice(0, t);
    }

    parent.children.splice(index + 1, 0, newChild);
    parent.keys.splice(index, 0, median);

    this.recordStep(
      `Promoted median ${median} into parent node.`,
      [median]
    );
  }

  insertNonFull(node, key) {
    let i = node.keys.length - 1;

    if (node.leaf) {
      node.keys.push(0);
      while (i >= 0 && key < node.keys[i]) {
        node.keys[i + 1] = node.keys[i];
        i--;
      }
      node.keys[i + 1] = key;
      this.recordStep(
        `Inserted ${key} into leaf node.`,
        [key]
      );
      return;
    }

    while (i >= 0 && key < node.keys[i]) {
      i--;
    }
    i++;

    if (node.children[i].keys.length === (2 * this.t - 1)) {
      this.recordStep(
        `Child node is full while inserting ${key}.`,
        node.children[i].keys
      );
      this.splitChild(node, i);
      if (key > node.keys[i]) {
        i++;
      }
    }

    this.insertNonFull(node.children[i], key);
  }

  insert(key) {
    const root = this.root;
    if (root.keys.length === (2 * this.t - 1)) {
      const newRoot = new BTreeNode(false);
      newRoot.children.push(root);
      this.root = newRoot;
      this.recordStep(
        `Root node is full. Creating a new root.`,
        root.keys
      );
      this.splitChild(newRoot, 0);
      this.insertNonFull(newRoot, key);
    } else {
      this.insertNonFull(root, key);
    }

    this.recordStep(
      `Successfully inserted ${key}.`,
      [key]
    );
  }

  search(node, key) {
    if (!node) {
      this.recordStep(
        `${key} not found.`,
        []
      );
      return false;
    }

    let i = 0;
    this.recordStep(
      `Searching for ${key} in node [${node.keys.join(', ')}]`,
      node.keys
    );

    while (i < node.keys.length && key > node.keys[i]) {
      i++;
    }

    if (i < node.keys.length && node.keys[i] === key) {
      this.recordStep(
        `Found key ${key}.`,
        [key]
      );
      return true;
    }

    if (node.leaf) {
      this.recordStep(
        `${key} not found.`,
        []
      );
      return false;
    }

    return this.search(node.children[i], key);
  }
}

const canvas = document.getElementById('tree-canvas');
const nodeLayer = document.getElementById('node-layer');
const svg = document.getElementById('edges-svg');
const statusMsg = document.getElementById('status-message');
const stepCounter = document.getElementById('step-counter');
const degreeInput = document.getElementById('degree');
const inputVal = document.getElementById('node-value');
const btnInsert = document.getElementById('btn-insert');
const btnSearch = document.getElementById('btn-search');
const btnStep = document.getElementById('btn-step');
const btnPlay = document.getElementById('btn-play');
const btnReset = document.getElementById('btn-reset');

const tree = new BTree(parseInt(degreeInput.value, 10) || 3);
let highlightedKeys = [];
let currentStep = 0;
let playTimer = null;

function setStatus(message) {
  statusMsg.innerText = message;
}

function updateStepCounter() {
  if (tree.steps.length === 0) {
    stepCounter.innerText = 'Step 0 / 0';
    return;
  }

  stepCounter.innerText = `Step ${currentStep + 1} / ${tree.steps.length}`;
}

function clearRender() {
  nodeLayer.innerHTML = '';
  svg.innerHTML = '';
}

function updateVisualization() {
  renderTree(tree.root, highlightedKeys);
}

function renderTree(root, highlightKeys = []) {
  clearRender();

  if (!root || (!root.keys.length && !root.children.length)) {
    setStatus('Tree is empty. Insert a key to begin.');
    updateStepCounter();
    return;
  }

  // Work on a working copy so we never mutate stored snapshots or live tree state.
  const workRoot = cloneNode(root);
  let nextX = 0;
  let nodeId = 0;

  function layout(node, depth) {
    node._id = `node-${nodeId++}`;
    node.y = 80 + depth * 150;

    if (!node.children.length) {
      node.x = nextX * 240 + 140;
      nextX += 1;
      return;
    }

    node.children.forEach(child => layout(child, depth + 1));
    node.x = (node.children[0].x + node.children[node.children.length - 1].x) / 2;
  }

  function createNodeElements(node, map) {
    const div = document.createElement('div');
    div.className = 'btree-node';
    div.dataset.nodeId = node._id;
    div.style.left = `${node.x}px`;
    div.style.top = `${node.y}px`;

    node.keys.forEach(key => {
      const span = document.createElement('div');
      span.className = 'btree-key';
      span.innerText = key;
      if (highlightKeys && highlightKeys.includes(key)) {
        span.classList.add('active-key');
      }
      div.appendChild(span);
    });

    nodeLayer.appendChild(div);
    map[node._id] = { node, div };
    node.children.forEach(child => createNodeElements(child, map));
  }

  function computeLayout() {
    layout(workRoot, 0);
    const map = {};
    createNodeElements(workRoot, map);

    let maxRight = 0;
    let maxBottom = 0;

    Object.values(map).forEach(({ node, div }) => {
      const width = div.offsetWidth;
      const height = div.offsetHeight;
      const left = node.x - width / 2;
      const top = node.y;
      node.left = left;
      node.top = top;
      node.width = width;
      node.height = height;
      node.centerX = node.x;
      node.centerY = node.y + height / 2;
      div.style.left = `${left}px`;
      div.style.top = `${top}px`;
      maxRight = Math.max(maxRight, left + width + 20);
      maxBottom = Math.max(maxBottom, top + height + 40);
    });

    nodeLayer.style.width = `${Math.max(maxRight, canvas.clientWidth)}px`;
    nodeLayer.style.height = `${Math.max(maxBottom, canvas.clientHeight)}px`;
    svg.setAttribute('width', Math.max(maxRight, canvas.clientWidth));
    svg.setAttribute('height', Math.max(maxBottom, canvas.clientHeight));
    return workRoot;
  }

  const laidOutRoot = computeLayout();

  function drawEdges(node) {
    node.children.forEach(child => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', node.centerX);
      line.setAttribute('y1', node.top + node.height);
      line.setAttribute('x2', child.centerX);
      line.setAttribute('y2', child.top);
      line.setAttribute('class', 'edge-line');
      svg.appendChild(line);
      drawEdges(child);
    });
  }

  drawEdges(workRoot);
  setStatus('Tree rendered. Use Step or Play to walk through steps.');
  updateStepCounter();
}

function highlightKeys(keys) {
  highlightedKeys = [...keys];
  nodeLayer.querySelectorAll('.btree-key').forEach(span => {
    const key = parseInt(span.textContent.trim(), 10);
    if (highlightedKeys.includes(key)) {
      span.classList.add('active-key');
    } else {
      span.classList.remove('active-key');
    }
  });
}

function showStep(index) {
  const step = tree.steps[index];
  if (!step) return;

  statusMsg.innerText = step.message;
  renderTree(step.tree, step.highlightKeys);
  highlightKeys(step.highlightKeys);
  currentStep = index;
  updateStepCounter();
}

function advanceStep() {
  if (tree.steps.length === 0) {
    setStatus('No steps available yet. Insert or search a key.');
    return;
  }

  currentStep = Math.min(currentStep + 1, tree.steps.length - 1);
  showStep(currentStep);
}

function stopPlay() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
    btnPlay.textContent = 'Play';
  }
}

function resetTree() {
  stopPlay();
  highlightedKeys = [];
  tree.steps = [];
  currentStep = 0;
  tree.root = new BTreeNode(true);
  clearRender();
  setStatus('Tree reset. Ready for new keys.');
  updateStepCounter();
}

btnInsert.addEventListener('click', () => {
  const value = parseInt(inputVal.value, 10);
  const degree = parseInt(degreeInput.value, 10);

  if (Number.isNaN(value)) {
    setStatus('Enter a valid key before inserting.');
    return;
  }

  if (degree >= 2) {
    tree.t = degree;
  }

  stopPlay();
  highlightedKeys = [];
  tree.steps = [];
  currentStep = 0;

  tree.insert(value);
  if (tree.steps.length > 0) {
    showStep(0);
  }
  inputVal.value = '';
});

btnSearch.addEventListener('click', () => {
  const value = parseInt(inputVal.value, 10);
  if (Number.isNaN(value)) {
    setStatus('Enter a valid key to search.');
    return;
  }

  stopPlay();
  highlightedKeys = [];
  tree.steps = [];
  currentStep = 0;

  tree.search(tree.root, value);
  if (tree.steps.length > 0) {
    showStep(0);
  }
  inputVal.value = '';
});

btnStep.addEventListener('click', () => {
  if (tree.steps.length === 0) {
    setStatus('No actions to step through yet.');
    return;
  }

  advanceStep();
});

btnPlay.addEventListener('click', () => {
  if (playTimer) {
    stopPlay();
    return;
  }

  if (tree.steps.length === 0) {
    setStatus('No actions to play yet.');
    return;
  }

  btnPlay.textContent = 'Pause';
  playTimer = setInterval(() => {
    if (currentStep >= tree.steps.length - 1) {
      stopPlay();
      return;
    }

    currentStep++;
    showStep(currentStep);
  }, 1000);
});

btnReset.addEventListener('click', resetTree);

degreeInput.addEventListener('change', () => {
  const value = parseInt(degreeInput.value, 10);
  if (Number.isNaN(value) || value < 2) {
    degreeInput.value = '2';
    tree.t = 2;
  } else {
    tree.t = value;
  }
  setStatus(`Degree set to ${tree.t}.`);
});
