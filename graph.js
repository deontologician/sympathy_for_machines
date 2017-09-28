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

    this.boundGraph()
  }

  makeLinks() {
    let linkGraph = this.svg.selectAll('.links')
        .data(this.links)
    let linkEnter = linkGraph.enter()
        .append("line")
        .classed("links", true)
        .attr("id", d => `from-${d.source.name}-to-${d.target.name}`)
        .attr("x1", d => xOffset(d.source.offsetInLayer))
        .attr("y1", d => yOffset(d.source.layerNum) + CIRCLE_RADIUS)
        .attr("x2", d => xOffset(d.target.offsetInLayer))
        .attr("y2", d => yOffset(d.target.layerNum) - CIRCLE_RADIUS)
      .merge(linkGraph)
        .attr("stroke", d => lineColor(calcWeight(d.source, d.target)))

    // forEach((child) => {
    //       if(child.name !== node.name) {
    //         svg.append("line")
    //           .attr("stroke", "black")
    //           .attr("stroke-width", "0.1em")
    //           .attr("x1", xOffset(nodeIndex))
    //           .attr("y1", yOffset(layerIndex) + CIRCLE_RADIUS)
    //           .attr("x2", xOffset(childIndex))
    //           .attr("y2", yOffset(layerIndex + 1) - CIRCLE_RADIUS)
    //         childIndex += 1
    //       } else {
    //         // self loop
    //         let x = xOffset(nodeIndex) + CIRCLE_RADIUS
    //         let y = yOffset(layerIndex)
    //         let c1x = x + CIRCLE_RADIUS * 0.75
    //         let c1y = y - CIRCLE_RADIUS * 0.75
    //         let c2x = x + CIRCLE_RADIUS * 0.75
    //         let c2y = y + CIRCLE_RADIUS * 0.75
    //         svg.append("path")
    //           .attr("stroke", "black")
    //           .attr("stroke-width", "0.1em")
    //           .attr("fill", "white")
    //           .attr("d", `M ${x},${y} C${c1x},${c1y} ${c2x},${c2y} ${x},${y}`)
    //         // don't increment childIndex because reasons
    //       }
    //     })
  }

  boundGraph() {
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
        .attr("stroke", d => determineText(d))

    this.makeLinks()
  }

  ticked() {
    this.boundGraph()
  }


  nonBoundGraph(svg, links, layers) {
        let childIndex = 0
        node.children.forEach((child) => {
          if(child.name !== node.name) {
            svg.append("line")
              .attr("stroke", "black")
              .attr("stroke-width", "0.1em")
              .attr("x1", xOffset(nodeIndex))
              .attr("y1", yOffset(layerIndex) + CIRCLE_RADIUS)
              .attr("x2", xOffset(childIndex))
              .attr("y2", yOffset(layerIndex + 1) - CIRCLE_RADIUS)
            childIndex += 1
          } else {
            // self loop
            let x = xOffset(nodeIndex) + CIRCLE_RADIUS
            let y = yOffset(layerIndex)
            let c1x = x + CIRCLE_RADIUS * 0.75
            let c1y = y - CIRCLE_RADIUS * 0.75
            let c2x = x + CIRCLE_RADIUS * 0.75
            let c2y = y + CIRCLE_RADIUS * 0.75
            svg.append("path")
              .attr("stroke", "black")
              .attr("stroke-width", "0.1em")
              .attr("fill", "white")
              .attr("d", `M ${x},${y} C${c1x},${c1y} ${c2x},${c2y} ${x},${y}`)
            // don't increment childIndex because reasons
          }
        })
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
