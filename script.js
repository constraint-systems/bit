window.addEventListener('load', () => {
  // Elements
  let $container = document.querySelector('#container')
  let $work_container = document.querySelector('#work_container')
  let $help_container = document.querySelector('#help_container')
  let $bmodes = document.querySelectorAll('.mode')
  let $hmodes = document.querySelectorAll('.mode_controls')
  let $buttons = document.querySelectorAll('button')

  // Readouts
  let $rmarker = document.querySelector('#rmarker')
  let $rgrid = document.querySelector('#rgrid')
  $rgrid.style.marginLeft = '8px'

  // Canvas contexts
  let rx = document.querySelector('#render').getContext('2d')
  let cx = document.createElement('canvas').getContext('2d')
  let gx = document.createElement('canvas').getContext('2d')
  let mx = document.createElement('canvas').getContext('2d')

  // Utilities
  function setContainerSize() {
    let px = state.px
    let w = state.cols * px + 2
    let h = state.rows * px + 2

    let sidebar = 16 * 16
    let min_width = Math.max(w, 28 * 16 + 2)
    $work_container.style.width = min_width + 'px'
    $work_container.style.flexShrink = 0
    if (state.show_help) {
      $help_container.style.display = 'block'
      $container.style.width = min_width + sidebar + 16 + 'px'
    } else {
      $help_container.style.display = 'none'
      $container.style.width = min_width + 'px'
    }
  }
  function setSize() {
    let px = state.px
    let w = state.cols * px + 2
    let h = state.rows * px + 2

    rx.canvas.width = w
    rx.canvas.height = h

    setContainerSize()

    let contexts = [cx, gx, mx]
    for (let ctx of contexts) {
      ctx.canvas.width = w
      ctx.canvas.height = h
      ctx.translate(1, 1)
    }
  }
  function cacheCanvas() {
    let copy = document.createElement('canvas')
    let cpx = copy.getContext('2d')
    copy.width = cx.canvas.width - 2
    copy.height = cx.canvas.height - 2
    cpx.drawImage(
      cx.canvas,
      1,
      1,
      cx.canvas.width - 2,
      cx.canvas.height - 2,
      0,
      0,
      copy.width,
      copy.height
    )
    state.canvas_cache = copy
  }
  function resizeCanvas(dc) {
    let px = state.px
    let w = state.cols * px + 2
    let h = state.rows * px + 2

    let nc = state.cols + dc[2]
    let nr = state.rows + dc[3]
    if (nc <= 0 || nr <= 0) {
      return
    }

    let dx = state.cache_offset[0] + dc[0]
    let dy = state.cache_offset[1] + dc[1]
    state.cache_offset[0] = dx
    state.cache_offset[1] = dy

    // setting size clears canvas
    state.cols = nc
    state.rows = nr
    setSize()

    // draw canvas from cache
    let cache = state.canvas_cache
    cx.drawImage(
      cache,
      0,
      0,
      cache.width,
      cache.height,
      -dx * px,
      -dy * px,
      cache.width,
      cache.height
    )

    // adjust offset for grid
    state.grid_offset[0] += dc[0]
    state.grid_offset[1] += dc[1]

    // adjust marker
    if (dc[0] !== 0) {
      state.marker[0] -= dc[0]
    }
    if (dc[1] !== 0) {
      state.marker[1] -= dc[1]
    }
    containMarker()
  }
  function finishCanvasResize() {
    state.cache_canvas = null
    state.cache_offset = [0, 0]
  }
  function checkProposal(proposed) {
    return (
      proposed[0] + proposed[2] >= 1 &&
      proposed[1] + proposed[3] >= 1 &&
      proposed[0] < state.cols &&
      proposed[1] < state.rows &&
      proposed[2] >= 1 &&
      proposed[3] >= 1 &&
      proposed[2] <= state.cols &&
      proposed[3] <= state.rows
    )
  }
  function containMarker() {
    let marker = state.marker
    if (state.marker[0] + state.marker[2] <= 1) {
      state.marker[0] = -(state.marker[2] - 1)
    }
    if (state.marker[0] >= state.cols - 1) {
      state.marker[0] = state.cols - 1
    }
    if (state.marker[1] + state.marker[3] <= 1) {
      state.marker[1] = -(state.marker[3] - 1)
    }
    if (state.marker[1] >= state.rows - 1) {
      state.marker[1] = state.rows - 1
    }
  }
  function changeMarker(dm) {
    // dm = [dx, dy, dw, dh]
    let proposed = state.marker.map((v, i) => v + dm[i])
    if (checkProposal(proposed)) {
      state.marker = proposed
    }
  }
  function displayMode() {
    let modes = ['move', 'marker_resize', 'canvas_resize']
    let index = modes.indexOf(state.mode)
    for (let $bmode of $bmodes) {
      $bmode.classList.remove('active')
    }
    $bmodes[index].classList.add('active')
    for (let $hmode of $hmodes) {
      $hmode.classList.remove('active')
    }
    $hmodes[index].classList.add('active')
  }
  function addHistory() {
    let entry = {}
    entry.cols = state.cols
    entry.rows = state.rows
    entry.grid_offset = state.grid_offset.slice()
    entry.canvas = cx.getImageData(0, 0, cx.canvas.width, cx.canvas.height)
    if (state.history_index !== null) {
      state.history = state.history.slice(0, state.history_index)
    }
    state.history.push(entry)
    state.history = state.history.slice(-history_limit)
    state.history_index = null
  }

  // State
  state = {}
  state.px = 16
  state.cols = 32
  state.rows = 32
  state.mode = 'move'
  state.marker = [0, 0, 1, 1]
  state.show_grid = true
  state.grid_offset = [0, 0]
  state.canvas_cache = null
  state.cache_offset = [0, 0]
  state.show_help = true
  let history_limit = 128
  state.history = []
  state.history_index = null

  // Render
  function renderMarker() {
    let px = state.px
    mx.clearRect(-1, -1, mx.canvas.width, mx.canvas.height)
    mx.lineWidth = 2
    if (state.mode === 'canvas_resize') {
      mx.strokeStyle = 'rgb(255,122,255)'
    } else {
      mx.strokeStyle = 'magenta'
    }
    mx.fillStyle = 'magenta'
    let [x, y, w, h] = state.marker
    mx.strokeRect(x * px, y * px, w * px, h * px)
    if (state.mode === 'marker_resize') {
      if (km.shift) {
        mx.fillRect(x * px, y * px, px / 2, px / 2)
      } else {
        mx.fillRect(
          x * px + w * px - px / 2,
          y * px + h * px - px / 2,
          px / 2,
          px / 2
        )
      }
    }
    if (state.mode === 'canvas_resize') {
      mx.strokeStyle = 'blue'
      mx.fillStyle = 'blue'
      mx.strokeRect(0, 0, state.cols * px, state.rows * px)
      if (km.shift) {
        mx.fillRect(0, 0, px / 2, px / 2)
      } else {
        mx.fillRect(
          state.cols * px - px / 2,
          state.rows * px - px / 2,
          px / 2,
          px / 2
        )
      }
    }
    $rmarker.innerHTML = `${x},${y}:${w}x${h} `
  }
  function makeGrid() {
    let px = state.px
    gx.clearRect(-1, -1, gx.canvas.width, gx.canvas.height)
    gx.lineWidth = 2
    gx.strokeStyle = '#bbb'
    for (let r = 0; r < state.rows + 1; r++) {
      gx.strokeStyle = '#bbb'
      if ((r + state.grid_offset[1]) % 8 === 0) gx.strokeStyle = 'cyan'
      let y = r * px
      gx.beginPath()
      gx.moveTo(0, y)
      gx.lineTo(state.cols * px, y)
      gx.stroke()
    }
    for (let c = 0; c < state.cols + 1; c++) {
      gx.strokeStyle = '#bbb'
      if ((c + state.grid_offset[0]) % 8 === 0) gx.strokeStyle = 'cyan'
      let x = c * px
      gx.beginPath()
      gx.moveTo(x, 0)
      gx.lineTo(x, state.rows * px)
      gx.stroke()
    }
    $rgrid.innerHTML = `${state.cols}x${state.rows}`
  }
  function compose() {
    rx.fillStyle = 'white'
    rx.clearRect(0, 0, rx.canvas.width, rx.canvas.height)
    rx.fillRect(1, 1, rx.canvas.width - 2, rx.canvas.height - 2)
    rx.drawImage(cx.canvas, 1, 1)
    if (state.show_grid) rx.drawImage(gx.canvas, 0, 0)
    rx.drawImage(mx.canvas, 0, 0)
  }

  // Init
  setSize()
  renderMarker()
  makeGrid()
  compose()
  displayMode()
  addHistory()

  // Actions
  let km = {}

  // Handlers
  let cdown = () => km.j || km.arrowdown
  let cup = () => km.k || km.arrowup
  let cleft = () => km.h || km.arrowleft
  let cright = () => km.l || km.arrowright
  function handleMove() {
    let marker = state.marker
    let movex = km.shift ? 1 : state.marker[2]
    let movey = km.shift ? 1 : state.marker[3]
    if (cleft()) changeMarker([-movex, 0, 0, 0])
    if (cright()) changeMarker([movex, 0, 0, 0])
    if (cup()) changeMarker([0, -movey, 0, 0])
    if (cdown()) changeMarker([0, movey, 0, 0])
  }
  function handleMarkerResize() {
    if (km.shift) {
      if (cdown()) changeMarker([0, 1, 0, -1])
      if (cup()) changeMarker([0, -1, 0, 1])
      if (cleft()) changeMarker([-1, 0, 1, 0])
      if (cright()) changeMarker([1, 0, -1, 0])
    } else {
      if (cdown()) changeMarker([0, 0, 0, 1])
      if (cup()) changeMarker([0, 0, 0, -1])
      if (cleft()) changeMarker([0, 0, -1, 0])
      if (cright()) changeMarker([0, 0, 1, 0])
    }
  }
  function handleCanvasResize() {
    if (km.shift) {
      if (cdown()) resizeCanvas([0, 1, 0, -1])
      if (cup()) resizeCanvas([0, -1, 0, 1])
      if (cleft()) resizeCanvas([-1, 0, 1, 0])
      if (cright()) resizeCanvas([1, 0, -1, 0])
    } else {
      if (cdown()) resizeCanvas([0, 0, 0, 1])
      if (cup()) resizeCanvas([0, 0, 0, -1])
      if (cleft()) resizeCanvas([0, 0, -1, 0])
      if (cright()) resizeCanvas([0, 0, 1, 0])
    }
  }

  // Key action
  function keyAction(key, e) {
    let px = state.px

    if (km['1'] || km.enter || km.escape) {
      if (state.mode === 'canvas_resize') {
        finishCanvasResize()
      }
      state.mode = 'move'
      renderMarker()
      compose()
      displayMode()
    }
    if (km['2']) {
      if (state.mode === 'canvas_resize') {
        finishCanvasResize()
      }
      state.mode = 'marker_resize'
      renderMarker()
      compose()
      displayMode()
    }
    if (km['3']) {
      if (state.mode !== 'canvas_resize') {
        cacheCanvas()
        addHistory()
        state.mode = 'canvas_resize'
      }
      renderMarker()
      compose()
      displayMode()
    }
    if (state.mode === 'move' && km.z) {
      if (km.shift) {
        if (
          state.history_index !== null &&
          state.history.length - 1 > state.history_index
        ) {
          let undo_index = state.history_index + 1
          let undo_state = state.history[undo_index]
          state.history_index = undo_index
          if (
            undo_state.rows !== state.rows ||
            undo_state.cols !== state.cols
          ) {
            // resize canvas
            state.cols = undo_state.cols
            state.rows = undo_state.rows
            state.grid_offset = undo_state.grid_offset
            setSize()
            containMarker()
            makeGrid()
            cx.putImageData(undo_state.canvas, 0, 0)
            compose()
          } else {
            cx.putImageData(undo_state.canvas, 0, 0)
            compose()
          }
        }
      } else {
        let undo_index
        if (state.history_index === null) {
          undo_index = Math.max(0, state.history.length - 1)
          // preserve current state for redo
          addHistory()
        } else {
          if (state.history_index > 0) {
            undo_index = Math.max(0, state.history_index - 1)
          }
        }
        let undo_state = state.history[undo_index]
        state.history_index = undo_index
        if (undo_state.rows !== state.rows || undo_state.cols !== state.cols) {
          // resize canvas
          state.cols = undo_state.cols
          state.rows = undo_state.rows
          state.grid_offset = undo_state.grid_offset
          setSize()
          containMarker()
          makeGrid()
          cx.putImageData(undo_state.canvas, 0, 0)
          compose()
        } else {
          cx.putImageData(undo_state.canvas, 0, 0)
          compose()
        }
      }
    }
    if (key === 'p') {
      let link = document.createElement('a')
      let $print = document.createElement('canvas')
      $print.width = state.cols * px
      $print.height = state.rows * px
      let pbx = $print.getContext('2d')
      pbx.fillStyle = 'white'
      pbx.fillRect(0, 0, $print.width, $print.height)
      pbx.drawImage(
        cx.canvas,
        0,
        0,
        cx.canvas.width,
        cx.canvas.height,
        -1,
        -1,
        cx.canvas.width,
        cx.canvas.height
      )
      $print.toBlob(function(blob) {
        link.setAttribute(
          'download',
          'bit-' + Math.round(new Date().getTime() / 1000) + '.png'
        )
        link.setAttribute('href', URL.createObjectURL(blob))
        link.dispatchEvent(
          new MouseEvent(`click`, {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        )
      })
    }
    if (km.g) {
      state.show_grid = !state.show_grid
      compose()
    }
    if (km['?']) {
      state.show_help = !state.show_help
      setContainerSize()
    }

    if (state.mode === 'move') {
      handleMove()
      let [x, y, w, h] = state.marker
      if (km.d) {
        addHistory()
        cx.fillRect(x * px, y * px, w * px, h * px)
      }
      if (km.e) {
        addHistory()
        cx.clearRect(x * px, y * px, w * px, h * px)
      }
      renderMarker()
      compose()
    } else if (state.mode === 'marker_resize') {
      handleMarkerResize()
      renderMarker()
      compose()
    } else if (state.mode === 'canvas_resize') {
      handleCanvasResize()
      makeGrid()
      renderMarker()
      compose()
    }
  }
  function downHandler(e) {
    let key = e.key.toLowerCase()
    km[key] = true
    km.shift = e.shiftKey
    km.ctrl = e.ctrlKey
    keyAction(key, e)
  }
  function upHandler(e) {
    let key = e.key.toLowerCase()
    km[key] = false
    km.shift = e.shiftKey
    km.ctrl = e.ctrlKey
    if (key === 'shift') {
      renderMarker()
      compose()
    }
  }
  window.addEventListener('keydown', downHandler)
  window.addEventListener('keyup', upHandler)

  // button triggers
  for (let $button of $buttons) {
    $button.addEventListener('click', () => {
      let val = $button.getAttribute('data-trigger') || $button.innerText.trim()
      if (val === '←') val = 'arrowleft'
      if (val === '↓') val = 'arrowdown'
      if (val === '↑') val = 'arrowup'
      if (val === '→') val = 'arrowright'
      km[val] = true
      if ($button.getAttribute('data-shift')) km.shift = true
      keyAction(val, {})
      setTimeout(() => {
        km[val] = false
        if ($button.getAttribute('data-shift')) km.shift = false
      }, 200)
    })
  }
})
