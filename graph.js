const d3 = require('d3')
class Graph {
  constructor({logicCenter}) {
    console.log(logicCenter)
    let nodes = logicCenter.nodeArray
    let links = getLinks(nodes)
    let svg = d3.select("svg"),
        width = +svg.attr("width"),
        height = +svg.attr("height")

    let simulation = d3.forceSimulation(logicCenter._inputNodes)
        .force("link", d3.forceLink()
               .id(d => d.name)
               .distance(1)
               .strength(0.01)
              )
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(width / 2, height / 2))

    this.link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .enter().append("line")

    this.node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(nodes)
      .enter().append("circle")
        .attr("r", "10")
        .attr("fill", determineFill)
    this.node.append("title")
      .text(d => d.name)

    simulation.nodes(nodes).on("tick", this.ticked.bind(this))
    simulation.force("link").links(links)
  }

  ticked() {
    this.link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y)
    this.node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("fill", determineFill)
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
