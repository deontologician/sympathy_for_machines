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

class Graph {
  constructor({logicCenter}) {
    let nodes = logicCenter.nodeArray
    let links = getLinks(nodes)
    let svg = d3.select("svg")
    let width = +svg.attr("width")
    let height = +svg.attr("height")

    logicCenter.layers.forEach((layer, layerIndex) => {
      layer.forEach((node, nodeIndex) => {
        node.layerIndex = layerIndex
        node.nodeIndex = nodeIndex
        let g = svg.append("g")
            .attr("id", `group-${node.name}`)
        g.append("circle")
          .attr("r", CIRCLE_RADIUS)
          .attr("fill", "white")
          .attr("stroke", "black")
          .attr("stroke-width", "0.1em")
          .attr("cx", xOffset(nodeIndex))
          .attr("cy", yOffset(layerIndex))
        g.append("text")
          .attr("x", xOffset(nodeIndex))
          .attr("y", yOffset(layerIndex))
          .attr("font-size", FONT_SIZE)
          .attr("text-anchor", "middle")
          .attr("dy", "0.3em")
          .text(node.name)
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
      })
    })
  }
  ticked() {
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

function getLinks(nodes) {
  let links = []
  nodes.forEach(parent => {
    parent.children.forEach(child => {
      links.push({source: parent.name, target: child.name})
    })
  })
  return links
}

exports.Graph = Graph
