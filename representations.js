/// Representation stuff

const pixelView = (numPixels) => {
  // Returns a list of random pixels from the gameboard
  let view = Array(numPixels)
  for(let i = 0; i < numPixels; i++) {
    view[i] = {x: randomInt(0, DIM), y: randomInt(0, DIM)}
  }
  return view
}

const convolve = (func, boardstate) => {
  const boardDim = Math.floor(Math.sqrt(boardstate.length))
  let newBoardstate = new Float32Array(boardstate.length)
  for(let x=0; x<boardDim; x++) {
    for(let y=0; y<boardDim; y++) {
      let dst = new Float32Array(3 * 3)
      for(let i=0; i<3; i++) {
        for(let j=0; j<3;j++) {
          let srcX = x + (i - 1)
          let srcY = y + (j - 1)
          if (srcX < 0 || srcY < 0 || srcX >= boardDim || srcY >= boardDim) {
            // Zero padding on the edges
            continue
          }
          dst[i*3 + j] = boardstate[srcX*boardDim + srcY]
        }
      }
      newBoardstate[x*boardDim + y] = func(dst)
    }
  }
  return newBoardstate

}

// Aggregators :: Prob -> Test -> [Color] -> Bool
const atLeast = (prob) => (test) => (arr) => {
  let count = 0
  let total = arr.reduce((acc, val) => (test(val)) ? acc + 1: acc, 0)
  return (total / arr.length) >= prob
}

const atMost = (prob) => (test) => (arr) => {
  let count = 0
  let total = arr.reduce((acc, val) => test(val) ? acc + 1: acc, 0)
  return (total / arr.length) <= prob
}

const aggregators = {
  atLeast,
  atMost,
}


// Filters :: Color -> Prob
const red = (color) => {
  return (color >> 16) / 255
}

const green = (color) => {
  return ((color & 0x00ff00) >> 8) / 255
}

const blue = (color) => {
  return (color & 0x0000ff) / 255
}

const _breakout = (color) => {
  return [red(color), green(color), blue(color)]
}

const _minMax = (breakout) => {
  let maxVal = breakout.reduce((acc, val) => Math.max(acc, val))
  let minVal = breakout.reduce((acc, val) => Math.min(acc, val))
  return [minVal, maxVal]
}

const _luminance = (breakout) => {
  let [minVal, maxVal] = _minMax(breakout)
  return (minVal + maxVal) / 2
}

const luminance = (color) => {
  return _luminance(_breakout(color))
}

const saturation = (color) => {
  let breakout = _breakout(color)
  let [minVal, maxVal] = _minMax(breakout)
  let lum = _luminance(breakout)
  let val
  if (lum < 0.5) {
    val = (maxVal - minVal) / (maxVal + minVal)
  } else {
    val = (maxVal - minVal) / (2 - maxVal - minVal)
  }
  return isNaN(val) ? 0 : val
}

const hue = (color) => {
  let [r, g, b] = _breakout(color)
  let [minVal, maxVal] = _minMax([r, g, b])
  let raw
  if (r === maxVal) {
    raw = (g - b) / (maxVal - minVal)
  } else if (g === maxVal) {
    raw = 2.0 + (b - r) / (maxVal - minVal)
  } else {
    raw = 4.0 + (r - g) / (maxVal - minVal)
  }
  return (isNaN(raw) ? 0 : raw) / 5.0
}

const filters = {
  red,
  green,
  blue,
  luminance,
  saturation,
  hue,
}
