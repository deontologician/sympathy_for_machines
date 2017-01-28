const representations = require('./representations.js')
const PIXI = require('pixi.js')
const Gen = require('random-seed')

class Config {
  constructor({rand, height, width}) {
    this.size = 512 // Pixel size of the complete grid
    this.dim = 16  // number of squares per side of the grid
    this.squareSize = Math.floor(this.size / this.dim) // size of a grid square
    this.fps = 5  // frames per second
    this.updateMs = Math.floor(1000 / this.fps) // How many milliseconds per frame
    this.correlationBound = 0.10 // Correlations must be this or 1 - this
    this.gameLengthMs = 2 * 60 * 1000  // milliseconds before heat death
    this.layeredProb = 0.5  // Chance nodes will be layered
    this.statefulProb = 0.5 // Chance a node is stateful
    this.numNodes = 5 + Math.round(rand.random() * this.dim * this.dim * 0.10)
    this.layers = 4  // if nodes layered, use this many layers
    this.rewardPoints = 10 // Points when the reward nodes are active
    this.punishPoints = 10  // Points deducted when "punish" nodes are active
    this.screenHeight = height
    this.screenWidth = width
    this.cheatMode = false
  }

}

class Random {

  constructor({seed}) {
    this.gen = Gen.create(seed)
  }

  random() {
    return this.gen.random()
  }

  intBetween(min, max) {
    return this.gen.intBetween(min, max)
  }

  boolWithProb(prob) {
    return this.random() < prob
  }

  correlation(bound) {
    let corr = this.random() * bound

    if (this.boolWithProb(0.5)) {
      return corr
    } else {
      return 1 - corr
    }
  }

  randomName(){
    const consonants = "bcdfghjklmnpqrstvwxz"
    const vowels = "aeiouy"
    const len = this.intBetween(5,7)
    let result = ""
    for(let i = 0; i < len; i++) {
      if (i % 2 === 0) {
        result += consonants[this.intBetween(0, consonants.length - 1)]
      } else {
        result += vowels[this.intBetween(0, vowels.length - 1)]
      }
    }
    return result
  }

  randomColor() {
    return this.intBetween(0, 0xffffff)
  }

  createProbMap(level, correlationBound) {
    let probMap = {}
    if(level === 1) {
      probMap[true] = this.correlation(correlationBound)
      probMap[false] = this.correlation(correlationBound)
    } else {
      probMap[true] = this.createProbMap(level - 1)
      probMap[false] = this.createProbMap(level - 1)
    }
    return probMap
  }

  sample(arr, num) {
    let s = new Set()
    let results = []
    let chosen
    while(s.size < num) {
      do {
        chosen = this.intBetween(0, arr.length - 1)
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

}

class Node {
  constructor({parents, rand, config}) {
    this.rand = rand
    this.parents = parents.slice()
    this.stateful = rand.boolWithProb(config.statefulProb)
    this.active = rand.boolWithProb(0.5)
    this.name = rand.randomName()
    this.isRewarding = false
    this.isPunishing = false
    this.children = []
    this.activeColor = rand.randomColor()
    this.inactiveColor = rand.randomColor()

    if (this.stateful) {
      // Hey! This was easy to get t-1, calculate based on ourselves.
      this.parents.push(this)
    }
    this.parents.forEach(p => p.children.push(this))
    this.probMap = rand.createProbMap(
      this.parents.length, config.correlationBound)
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
    this.active = this.rand.boolWithProb(prob)
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

class HeatNode {
  constructor({config, rand}) {
    this.config = config
    this.rand = rand
    this.target = Date.now() + this.config.gameLengthMs
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
      return remaining / this.config.gameLengthMs
    }
  }

  recalculate() {
    this.active = this.rand.boolWithProb(this.prob())
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

  recalculate(rand) {
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

class LogicCenter {

  constructor({config, rand}) {
    this.config = config
    this.totalNodes = config.numNodes
    this.rand = rand
    this.config = config
    if (rand.boolWithProb(config.layeredProb)) {
      this.nodeArray = this.makeLayeredNodes(config.numNodes)
    } else {
      this.nodeArray = this.makeUnconstrainedNodes(config.numNodes)
    }
    let rewardNode = this.nodeArray[this.nodeArray.length-1]
    rewardNode.isRewarding = true
    let punishNode = this.nodeArray[this.nodeArray.length-2]
    punishNode.isPunishing = true
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
        return total + this.config.rewardPoints
      } else if (n.active && n.isPunishing) {
        return total - this.config.punishPoints
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
        new HeatNode({config: this.config, rand: this.rand}),
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
      let numParents = this.rand.intBetween(1, Math.min(3, nodeArray.length))
      let parents = this.rand.sample(nodeArray, numParents)
      nodeArray.push(new Node({parents, rand: this.rand, config: this.config}))
    }
    return nodeArray
  }

  makeLayeredNodes(totalNodes) {
    console.log('Making layered nodes')
    // Connected only to previous layer
    let nodesPerLayer = Math.floor(totalNodes / this.config.layers)
    let layers = [this.inputNodes()]
    let nodesCreated = 0
    for(let layer = 1; layer <= this.config.layers; layer++) {
      layers[layer] = Array(nodesPerLayer)
      for(let i = 0; i < nodesPerLayer ||
              (layer === this.config.layers &&  nodesCreated < totalNodes); i++) {
        // Creates a topological sorting of the DAG by construction
        let numParents = this.rand.intBetween(1, Math.min(3, layers[layer-1].length))
        let parents = this.rand.sample(layers[layer-1], numParents)
        layers[layer][i] = new Node({parents, rand: this.rand, config: this.config})
        nodesCreated += 1
      }
    }
    return [].concat.apply([], layers) // flatten
  }
}

/// Rendering code etc below
class Gameboard {
  constructor({config}) {
    this.config = config
    this.renderer = PIXI.autoDetectRenderer(config.screenWidth, config.size)
    this.stage = new PIXI.Container()

    // Main board
    this.board = new PIXI.Graphics()
    this.stage.addChild(this.board)

    // Score display
    this.oldscore = 0
    this.scoreText = new PIXI.Text(
      "0",
      {fontFamily: "Mono", fontSize: 30, fill: "white"}
    )
    this.stage.addChild(this.scoreText)
    this.scoreText.position.set(this.config.size + 5, 5)

    // FPS display
    this.totalFramesRendered = 0
    this.startTime = Date.now()
    this.fpsText = new PIXI.Text(
      '',
      {fontFamily: "Mono", fontSize:30, fill: "white"}
    )
    this.stage.addChild(this.fpsText)
    this.fpsText.position.set(this.config.size + 5, 40)

    // Shortcut to the canvas element
    this.view = this.renderer.view
  }

  render(boardstate, score) {
    // Render the board
    for(let i = 0; i < this.config.dim; i++) {
      for(let j = 0; j < this.config.dim; j++) {
        let x = i * this.config.squareSize
        let y = j * this.config.squareSize
        this.board.beginFill(boardstate[i * this.config.dim + j])
        this.board.drawRect(x, y, this.config.squareSize, this.config.squareSize)
        this.board.endFill()
      }
    }

    // Render the score
    this.scoreText.text = String(score)
    if (score > this.oldscore) {
      this.scoreText.style['fill'] = 'green'
    } else if (score < this.oldscore) {
      this.scoreText.style['fill'] = 'red'
    }
    this.oldscore = score

    // Render the FPS

    if (this.config.cheatMode) {
      let fps = this.totalFramesRendered / ((Date.now() - this.startTime) / 1000)
      this.fpsText.text = `FPS: ${fps}`
    }

    this.totalFramesRendered += 1

    // Output it then clear the board
    this.renderer.render(this.stage)
    this.board.clear()
  }

  destroy() {
    this.view.remove()
  }
}


class Game {
  constructor({rand, config, gameboard, logicCenter}) {
    this.rand = rand
    this.config = config
    this.gameboard = gameboard
    this.boardstate = this.makeBoardState()
    this.score = 0
    this.logic = logicCenter
  }

  start() {
    document.getElementById('container').appendChild(this.gameboard.view)
    this.intervalId = setInterval(this.doRound.bind(this), this.config.updateMs)
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
    for(let i = 0; i < this.config.dim; i++) {
      for(let j = 0; j < this.config.dim; j++) {
        let pos = (i * this.config.dim + j)
        let node = this.logic.getNode(pos % this.logic.totalNodes)
        let color = this.config.cheatMode ? this.secretColor(node) : node.color()
        this.boardstate[pos] = color
      }
    }
  }

  makeBoardState() {
    return new Float32Array(Math.pow(this.config.dim, 2))
  }

}

function gameFromSeed(seed) {
  let height = Math.max(document.documentElement.clientHeight, window.innerHeigh || 0)
  let width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
  let rand = new Random({seed})
  let config = new Config({rand, height, width})
  let gameboard = new Gameboard({config})
  let logicCenter = new LogicCenter({config, rand})
  return new Game({rand, config, gameboard, logicCenter})
}

document.addEventListener("DOMContentLoaded", () => {
  let game = window.game = gameFromSeed(Math.random())
  game.start()
})
