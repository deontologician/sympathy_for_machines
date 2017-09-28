'use strict';

const representations = require('./representations.js')
const {Graph} = require('./graph.js')
const PIXI = require('pixi.js')
const Gen = require('random-seed')

class Config {
  constructor({rand, height, width}) {
    this.size = 512 // Pixel size of the complete grid
    this.dim = 16  // number of squares per side of the grid
    this.squareSize = Math.floor(this.size / this.dim) // size of a grid square
    this.fps = 5  // frames per second
    this.updateMs = Math.floor(1000 / this.fps) // How many milliseconds per frame
    this.correlationBound = 0.5 // Correlations must be this or 1 - this
    this.gameLengthMs = 2 * 60 * 1000  // milliseconds before heat death
    this.statefulProb = 0.2 // Chance a node is stateful
    this.numNodes = 5 + Math.round(rand.random() * this.dim * this.dim * 0.10)
    this.rewardPoints = 10 // Points when the reward nodes are active
    this.punishPoints = 10  // Points deducted when "punish" nodes are active
    this.screenHeight = height
    this.screenWidth = width
    this.cheatMode = false
  }

}

function assert(condition, error) {
  if (!condition) {
    throw new Error(error)
  }
}

class Random {

  constructor({seed}) {
    if (seed !== null) {
      this.gen = Gen.create(seed)
    } else {
      this.gen = Gen.create(Math.random())
    }
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

  boundedFloat(lower, upper) {
    return this.random() * (upper - lower) + lower
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
    const startBlends = [
      'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl',
      'gr', 'pl', 'pr', 'sc', 'sh', 'sk', 'sl', 'sm', 'sn',
      'sp', 'st', 'sw', 'th', 'tr', 'tw', 'wh', 'wr', 'sch',
      'scr', 'shr', 'sph', 'spl', 'squ', 'str', 'thr', 'qu',
    ]
    const endBlends = [
      'nt', 'ck', 'mp', 'ch', 'st', 'nth', 'll',
      'sh', 'th', 'rs', 'ght', 'sk',
    ]
    const consonants = [
      ['b', 1.492],
      ['c', 2.782],
      ['d', 4.253],
      ['f', 2.228],
      ['g', 2.014],
      ['h', 6.094],
      ['j', 6.966],
      ['k', 0.153],
      ['l', 4.025],
      ['m', 2.406],
      ['n', 6.749],
      ['p', 1.929],
      ['qu', 0.095],
      ['r', 5.987],
      ['s', 6.327],
      ['t', 9.056],
      ['v', 0.978],
      ['w', 2.360],
      ['x', 0.150],
      ['y', 1.974],
      ['z', 0.074],
    ]
    const vowels = [
      ['a', 5], ['ai', 1],
      ['e', 6], ['ei', 1], ['ea', 1],
      ['i', 5], ['ie', 1],
      ['o', 5], ['ou', 1],
      ['u', 1], ['ui', 1],
    ]
    const len = this.intBetween(5, 7)
    let result = ""
    for(let i = 0; i < len; i++) {
      if (i == 0 && this.boolWithProb(0.5)) {
        result += this.choice(startBlends)
      } else if (i % 2 === 0) {
        if (i == len - 1 && this.boolWithProb(0.3)) {
          result += this.choice(endBlends)
        } else {
          result += this.multinomialChoice(consonants)
        }
      } else {
        result += this.multinomialChoice(vowels)
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
      probMap[true] = this.createProbMap(level - 1, correlationBound)
      probMap[false] = this.createProbMap(level - 1, correlationBound)
    }
    return probMap
  }

  choice(arr) {
    return arr[this.intBetween(0, arr.length - 1)]
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
      console.error('Results:', results)
      console.error('Chosen', chosen)
      console.error('s', s)
      console.error('arr', arr)
      throw new Error('undefined unexpected')
    }
    return results
  }

  // Takes an array of tuples with [value, weight]
  // Weights are not assumed to sum to 1.0
  multinomialChoice(weights) {
    const total = weights.reduce((total, elem) => total + elem[1], 0)
    const threshold = this.boundedFloat(0, total)
    let runningSum = 0
    for(let i = 0; i < weights.length; i++) {
      runningSum += weights[i][1]
      if (runningSum >= threshold) {
        return weights[i][0]
      }
    }
    return weights[weights.length - 1][0]
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

    // These are set by the graph layout code
    this.fx = null
    this.fy = null

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
    return this.hypothetical(actives)
  }

  hypothetical(actives) {
    actives = actives.slice()
    let pmap = this.probMap
    while(actives.length > 1) {
      pmap = pmap[actives.shift()]
    }
    return pmap[actives.shift()]
  }

  recalculate() {
    let prob = this.prob()
    this.active = this.rand.boolWithProb(prob)
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
    // Set by graph layout code
    this.fx = null
    this.fy = null
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
    this.layers = this.makeFCLayeredNodes(config.numNodes)
    this.nodeArray = [].concat.apply([], this.layers)
    let rewardNode = this.nodeArray[this.nodeArray.length-1]
    rewardNode.isRewarding = true
    rewardNode.name = 'reward'
    let punishNode = this.nodeArray[this.nodeArray.length-2]
    punishNode.isPunishing = true
    punishNode.name = 'punish'
    this.nodeRegistry = this.makeNodeRegistry(this.nodeArray)
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

  makeNodeRegistry(nodes) {
    let reg = {}
    nodes.forEach(node => {
      reg[node.name] = node
    })
    return reg
  }

  makeFCLayeredNodes(totalNodes) {
    let layers = [this.inputNodes()]
    for(let layer = 1, nodesLeft = totalNodes; nodesLeft > 0; layer++) {
      let nodesInThisLayer = this.rand.intBetween(2, Math.min(5, nodesLeft))
      layers[layer] = []
      let parents = layers[layer - 1]
      for(let i = 0; i < nodesInThisLayer; i++) {
        layers[layer].push(new Node({parents, rand: this.rand, config: this.config}))
      }
      nodesLeft -= nodesInThisLayer
    }
    return layers
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
    this.graph = new Graph({logicCenter})
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
    this.graph.ticked()
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
  let height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
  let width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
  let rand = new Random({seed})
  let config = new Config({rand, height, width})
  let gameboard = new Gameboard({config})
  let logicCenter = new LogicCenter({config, rand})
  return new Game({rand, config, gameboard, logicCenter})
}

function displayGameSeed(seed) {
  let gameTitle = seed[0].toUpperCase() + seed.slice(1)
  document.getElementById('gameseed').innerHTML = gameTitle
}

document.addEventListener("DOMContentLoaded", () => {
  let gameSeed = (new Random({seed: undefined})).randomName()
  displayGameSeed(gameSeed)
  let game = window.game = gameFromSeed(gameSeed)
  game.start()
})
