'use strict'

const d3 = require('d3')

const CIRCLE_RADIUS = 30
const H_PADDING = 20
const V_PADDING = 60
const CIRCLE_DIAMETER = CIRCLE_RADIUS * 2
const FONT_SIZE = "10pt"

function xOffset(nodeIndex) {
  return (nodeIndex * (CIRCLE_DIAMETER + H_PADDING)) + H_PADDING + CIRCLE_RADIUS
}

function yOffset(layerIndex) {
  return (layerIndex * (CIRCLE_DIAMETER + V_PADDING)) + V_PADDING + CIRCLE_RADIUS
}

function lineColor(weight) {
  let hue = weight < 0 ? 0 : 120
  let lightness = Math.round(50 + Math.abs(weight) * 50)
  return `hsl(${hue}, 100%, ${lightness}%)`
}

class Graph {
  constructor({logicCenter}) {
    this.nodeArray = logicCenter.nodeArray
    this.links = getLinks(this.nodeArray)
    this.svg = d3.select("svg")
    this.layers = logicCenter.layers

    // Preprocess the nodes so they have their layer
    this.layers.forEach((layer, layerNum) => {
      layer.forEach((node, offsetInLayer) => {
        node.layerNum = layerNum
        node.offsetInLayer = offsetInLayer
      })
    })
  }

  render() {
    let layerGroups = this.svg.selectAll(".layer-groups")
        .data(this.layers)

    layerGroups.enter()
      .append("g")
      .attr("id", (d, i) => `layer-${i}`)
      .classed("layer-groups", true)

    let nodeGroups = layerGroups.selectAll(".node-groups")
        .data(d => d)

    let nodeEnter = nodeGroups.enter()
      .append("g")
      .attr("id", d => `node-${d.layerNum}-${d.offsetInLayer}`)
      .classed("node-groups", true)

    nodeEnter.append("circle")
        .classed("node", true)
        .attr("r", CIRCLE_RADIUS)
        .attr("cx", d => xOffset(d.offsetInLayer))
        .attr("cy", d => yOffset(d.layerNum))
      .merge(nodeGroups.select("circle"))
        .attr("fill", d => determineFill(d))

    nodeEnter.append("text")
        .classed("node-text", true)
        .attr("x", d => xOffset(d.offsetInLayer))
        .attr("y", d => yOffset(d.layerNum))
        .attr("font-size", FONT_SIZE)
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .text(d => d.name)
      .merge(nodeGroups.select("text"))
        .attr("fill", d => determineText(d))

    // Making links

    let linkGraph = this.svg.selectAll('.links')
        .data(this.links)
    let linkEnter = linkGraph.enter()

    // Links from one layer to another
    let lines = linkEnter.filter(d => d.source !== d.target)
        .append("line")
        .classed("links", true)
        .attr("id", d => `from-${d.source.name}-to-${d.target.name}`)
        .attr("x1", d => xOffset(d.source.offsetInLayer))
        .attr("y1", d => yOffset(d.source.layerNum) + CIRCLE_RADIUS)
        .attr("x2", d => xOffset(d.target.offsetInLayer))
        .attr("y2", d => yOffset(d.target.layerNum) - CIRCLE_RADIUS)

    // Need to handle self-links differently
    let paths = linkEnter.filter(d => d.source === d.target)
      .append("path")
      .classed("links", true)
      .attr("d", d => {
        let x = xOffset(d.source.offsetInLayer) + CIRCLE_RADIUS
        let y = yOffset(d.source.layerNum)
        let c1x = x + CIRCLE_RADIUS * 0.75
        let c1y = y - CIRCLE_RADIUS * 0.75
        let c2x = x + CIRCLE_RADIUS * 0.75
        let c2y = y + CIRCLE_RADIUS * 0.75
        return `M ${x},${y} C${c1x},${c1y} ${c2x},${c2y} ${x},${y}`
      })

    // Update the stroke on everything the same
    linkGraph.merge(paths).merge(lines)
      .attr("stroke", d => lineColor(calcWeight(d.source, d.target)))
  }

}

function wrapSecret(secretColor) {
  return d => '#' + secretColor(d).toString(16)
}

function determineFill({active, isRewarding, isPunishing, stateful}) {
    if (isRewarding) {
      return active ? '#1010ff' : '#10107f'
    } else if (isPunishing) {
      return active ? '#ff0000' : '#7f0000'
    } else if (stateful) {
      return active ? '#00ff00' : '#007f00'
    } else {
      return active ? '#ffffff' : '#000000'
    }
}

function determineText({active, isRewarding, isPunishing, stateful}) {
  if (isRewarding || isPunishing) {
    return '#ffffff'
  } else {
    return active ? '#000000' : '#ffffff'
  }
}

function calcWeight(parent, child) {
  let currentProb = child.prob()
  // Calculate what this link would do if it were the opposite
  // activity
  let hypotheticalActives = child.parents
      .map(p => p === parent ? !p.active : p.active)
  let alternativeProb = child.hypothetical(hypotheticalActives)
  return currentProb - alternativeProb
}

function getLinks(nodes) {
  return nodes.reduce((sum, parent) =>
      sum.concat(parent.children.map(child => ({
        source: parent,
        target: child,
      }))), [])
}

exports.Graph = Graph
