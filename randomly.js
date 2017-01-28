let h = Math.max(document.documentElement.clientHeight, window.innerHeigh || 0)
const SIZE = h// 512 // Pixel size of the complete grid
const DIM = 16  // number of squares per side of the grid
const SQUARE_SIZE = Math.floor(SIZE / DIM) // size of a grid square
const FPS = 5  // frames per second
const UPDATE_MS = Math.floor(1000 / FPS) // How many milliseconds per frame
const CORRELATION_BOUND = 0.10 // Correlations must be this or 1 - this
const GAME_LENGTH_MS = 2 * 60 * 1000  // milliseconds before heat death
const LAYERED_PROB = 0.5  // Chance nodes will be layered
const STATEFUL_PROB = 0.5 // Chance a node is stateful
const NUM_NODES = 5 + Math.round(Math.random() * DIM * DIM * 0.10)
const LAYERS = 4  // if nodes layered, use this many layers
const YAY_POINTS = 10 // Points when the yay nodes are active
const NO_POINTS = 10  // Points deducted when "no" nodes are active
let CHEAT_MODE = false

// Return the index of an array, given an array with proportional
// weights for each index as values
const randomByDist = (dist) => {
  const total = dist.reduce((x,y) => x + y)
  const val = Math.random() * total
  let sum = 0
  for(let i = 0; i < dist.length; i++) {
    sum += dist[i]
    if(sum >= val) {
      return i
    }
  }
  // Maybe rounding error?
  return dist.length - 1
}

const correlation = () => {
  let corr = Math.random() * CORRELATION_BOUND

  if (boolWithProb(0.5)) {
    return corr
  } else {
    return 1 - corr
  }
}

const randomName = () => {
  const consonants = "bcdfghjklmnpqrstvwxz"
  const vowels = "aeiouy"
  const len = randomInt(5,7)
  let result = ""
  for(let i = 0; i < len; i++) {
    if (i % 2 === 0) {
      result += consonants[randomInt(0, consonants.length - 1)]
    } else {
      result += vowels[randomInt(0, vowels.length - 1)]
    }
  }
  return result
}

const randomColor = () => {
  return randomInt(0, 0xffffff)
}


function createProbMap(level) {
  let probMap = {}
  if(level === 1) {
    probMap[true] = correlation()
    probMap[false] = correlation()
  } else {
    probMap[true] = createProbMap(level - 1)
    probMap[false] = createProbMap(level - 1)
  }
  return probMap
}

class Node {
  constructor(parents) {
    this.parents = parents.slice()
    this.stateful = boolWithProb(STATEFUL_PROB)
    this.active = boolWithProb(0.5)
    this.name = randomName()
    this.isRewarding = false
    this.isPunishing = false
    this.children = []
    this.activeColor = randomColor()
    this.inactiveColor = randomColor()

    if (this.stateful) {
      // Hey! This was easy to get t-1, calculate based on ourselves.
      this.parents.push(this)
    }
    this.parents.forEach(p => p.children.push(this))
    this.probMap = createProbMap(this.parents.length)
    this.recalculate() // Get good probability based on dependencies
  }

  prob() {
    const actives = this.parents.map(p => p.active)
    let pmap = this.probMap
    while(actives.length > 1) {
      pmap = pmap[actives.shift()]
    }
    return pmap[actives.shift()]
  }

  recalculate() {
    let prob = this.prob()
    this.active = boolWithProb(prob)
    if (this.active && this.isRewarding) {
      //console.log(`${this.name} gave a reward!`)
    }
    if (this.active && this.isPunishing) {
      //console.log(`${this.name} gave a punishment.`)
    }
    return this.active
  }

  toString() {
    let active = this.active ? 'active' : 'inactive'
    let stateful = this.stateful ? 'stateful' : 'unstateful'
    return `Node(${this.prob()}, ${active}, ${stateful})`
  }

  color() {
    return this.active ? this.activeColor : this.inactiveColor
  }

  destroy() {
  }
}

class RandNode {
  // Node that is randomly true or false with a given probability, but
  // with no dependencies
  constructor() {
    this.active = boolWithProb(this.prob())
    this.name = "Random"
    this.children = []
  }

  prob() {
    return 0.5
  }

  recalculate() {
    this.active = boolWithProb(this.prob())
    return this.active
  }

  toString() {
    return `RandNode(active=${this.active})`
  }

  destroy() {
  }
}

class HeatNode {
  constructor(delta) {
    this.target = Date.now() + GAME_LENGTH_MS
    this.active = true
    this.heatDeath = false
    this.name = "Heat"
    this.children = []
  }

  prob() {
    if (this.heatDeath) {
      return 0
    } else {
      let remaining = Math.max(this.target - Date.now(), 0)
      if (remaining === 0) {
        console.log('Heat death')
        this.heatDeath = true
      }
      return remaining / GAME_LENGTH_MS
    }
  }

  recalculate() {
    this.active = boolWithProb(this.prob())
    return this.active
  }

  toString() {
    return `HeatNode(${this.prob()}, active=${this.active})`
  }

  destroy() {
  }
}

class KeyNode {
  constructor(key) {
    this.key = key
    this.active = false
    this._shouldBeActive = false
    this.children = []
    this.name = `Key[${key.toUpperCase()}]`
    this.onKeyUp = ({key}) => {
      if (key === this.key) {
        this.active = false
      }
    }
    this.onKeyDown = ({key}) => {
      if (key === this.key) {
        this.active = true
      }
    }
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
  }

  recalculate() {
    return this.active
  }

  toString() {
    return `KeyNode(${this.key}, active=${this.active})`
  }

  destroy() {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
  }

}

// Note: this is buggy, just use a random library dangit
const sample = (arr, num) => {
  let s = new Set()
  let results = []
  let chosen
  while(s.size < num) {
    do {
      chosen = randomInt(0, arr.length - 1)
    } while(s.has(chosen))
    s.add(chosen)
    results.push(arr[chosen])
  }
  if (results.includes(undefined)) {
    console.log('Results:', results)
    console.log('Chosen', chosen)
    console.log('s', s)
    console.log('arr', arr)
    throw new Error('Shit!')
  }
  return results
}

class LogicCenter {

  constructor(totalNodes) {
    this.totalNodes = totalNodes
    if (boolWithProb(LAYERED_PROB)) {
      this.nodeArray = this.makeLayeredNodes(totalNodes)
    } else {
      this.nodeArray = this.makeUnconstrainedNodes(totalNodes)
    }
    let yayNode = this.nodeArray[this.nodeArray.length-1]
    yayNode.isRewarding = true
    let noNode = this.nodeArray[this.nodeArray.length-2]
    noNode.isPunishing = true
  }

  destroy() {
    this.nodeArray.forEach(n => n.destroy())
  }

  recalculate() {
    this.nodeArray.forEach(n => {
      n.recalculate()
    })
  }

  reward() {
    return this.nodeArray.reduce((total, n) => {
      if (n.active && n.isRewarding) {
        return total + YAY_POINTS
      } else if (n.active && n.isPunishing) {
        return total - NO_POINTS
      } else {
        return total
      }
    }, 0)
  }

  getNode(index) {
    return this.nodeArray[index + this._inputNodes.length]
  }

  inputNodes() {
    // memoize since these create eventListeners
    if (!this._inputNodes) {
      this._inputNodes = [
        new HeatNode(),
        //new RandNode(),
        new KeyNode('a'),
        new KeyNode('s'),
        new KeyNode('k'),
        new KeyNode('l'),
      ]
    }
    return this._inputNodes.slice()
  }

  makeUnconstrainedNodes(totalNodes) {
    console.log('Making unconstrained nodes')
    // No connectivity depth restrictions, still a dag
    let nodeArray = this.inputNodes()
    for(let i = 0; i < totalNodes; i++) {
      let numParents = randomInt(1, Math.min(3, nodeArray.length))
      let parents = sample(nodeArray, numParents)
      nodeArray.push(new Node(parents))
    }
    return nodeArray
  }

  makeLayeredNodes(totalNodes) {
    console.log('Making layered nodes')
    // Connected only to previous layer
    let nodesPerLayer = Math.floor(totalNodes / LAYERS)
    let layers = [this.inputNodes()]
    let nodesCreated = 0
    for(let layer = 1; layer <= LAYERS; layer++) {
      layers[layer] = Array(nodesPerLayer)
      for(let i = 0; i < nodesPerLayer ||
              (layer === LAYERS &&  nodesCreated < totalNodes); i++) {
        // Creates a topological sorting of the DAG by construction
        let numParents = randomInt(1, Math.min(3, layers[layer-1].length))
        let parents = sample(layers[layer-1], numParents)
        layers[layer][i] = new Node(parents)
        nodesCreated += 1
      }
    }
    return [].concat.apply([], layers) // flatten
  }
}

/// Rendering code etc below

const randomInt = (minVal, maxVal) => {
  return Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal
}

const boolWithProb = (prob) => {
  return Math.random() < prob
}

class Gameboard {
  constructor() {
    console.log('Creating gameboard')
    let w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    this.renderer = PIXI.autoDetectRenderer(w, SIZE)
    this.stage = new PIXI.Container()
    this.board = new PIXI.Graphics()
    this.stage.addChild(this.board)
    this.oldscore = 0
    this.scoreText = new PIXI.Text(
      "0",
      {fontFamily: "Mono", fontSize: 30, fill: "white"}
    )
    this.stage.addChild(this.scoreText)
    this.scoreText.position.set(SIZE + 5, 5)
    this.view = this.renderer.view
  }

  render(boardstate, score) {
    for(let i = 0; i < DIM; i++) {
      for(let j = 0; j < DIM; j++) {
        let x = i * SQUARE_SIZE
        let y = j * SQUARE_SIZE
        this.board.beginFill(boardstate[i * DIM + j])
        this.board.drawRect(x, y, SQUARE_SIZE, SQUARE_SIZE)
        this.board.endFill()
      }
    }
    this.scoreText.text = String(score)
    if (score > this.oldscore) {
      this.scoreText.style['fill'] = 'green'
    } else if (score < this.oldscore) {
      this.scoreText.style['fill'] = 'red'
    }
    this.oldscore = score
    this.renderer.render(this.stage)
    this.board.clear()
  }

  destroy() {
    this.view.remove()
  }
}


class Game {
  constructor() {
    this.gameboard = new Gameboard()
    this.boardstate = this.makeBoardState()
    this.score = 0
    this.logic = new LogicCenter(NUM_NODES)
  }

  start() {
    document.getElementById('container').appendChild(this.gameboard.view)
    this.intervalId = setInterval(this.doRound.bind(this), UPDATE_MS)
    this.doRound()
  }
  stop() {
    clearInterval(this.intervalId)
    this.gameboard.destroy()
    this.logic.destroy()
  }

  doRound() {
    this.determineLogic()
    requestAnimationFrame(() => {
      this.gameboard.render(this.boardstate, this.score)
    })
  }

  secretColor({active, isRewarding, isPunishing, stateful}) {
    if (isRewarding) {
      return active ? 0x0000ff : 0x00007f
    } else if (isPunishing) {
      return active ? 0xff0000 : 0x7f0000
    } else if (stateful) {
      return active ? 0x00ff00 : 0x007f00
    } else {
      return active ? 0xffffff : 0x000000
    }
  }

  determineLogic() {
    this.logic.recalculate()
    this.score += this.logic.reward()
    let numInputs = this.logic.inputNodes().length
    for(let i = 0; i < DIM; i++) {
      for(let j = 0; j < DIM; j++) {
        let pos = (i * DIM + j)
        let node = this.logic.getNode(pos % this.logic.totalNodes)
        let color = CHEAT_MODE ? this.secretColor(node) : node.color()
        this.boardstate[pos] = color
      }
    }
  }


  makeBoardState() {
    return new Float32Array(DIM*DIM)
  }

}

document.addEventListener("DOMContentLoaded", () => {
  let game = window.game = new Game()
  game.start()
})
