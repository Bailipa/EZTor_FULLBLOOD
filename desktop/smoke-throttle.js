'use strict'

// 复现：focusable:false 的 overlay 窗口，CSS 动画是否因 backgroundThrottling 冻结。
// 对比 默认(节流) vs backgroundThrottling:false。
const { app, BrowserWindow, protocol } = require('electron')
const fs = require('fs')

const SCHEME = 'eztor-test'
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

const html = `<!DOCTYPE html><html><head><style>
  html,body{margin:0;background:transparent;overflow:hidden}
  .b{position:absolute;left:0;top:100px;width:200px;height:40px;background:#f60;color:#fff;font:bold 20px/40px sans-serif;text-align:center}
  @keyframes fly{from{transform:translateX(0)}to{transform:translateX(700px)}}
</style></head><body>
  <div id="stage"></div>
  <script>
    setInterval(function(){
      var el=document.createElement('div');
      el.className='b';el.textContent='T'+(Date.now()%1000);
      el.style.animation='fly 5s linear forwards';
      document.getElementById('stage').appendChild(el);
      if(document.getElementById('stage').children.length>5) document.getElementById('stage').firstChild.remove();
    },1000);
  </script></body></html>`

async function makeWin(label, throttling) {
  const w = new BrowserWindow({
    width: 1000, height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    show: true,
    webPreferences: { backgroundThrottling: throttling },
  })
  w.setIgnoreMouseEvents(true)
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  return w
}

app.whenReady().then(async () => {
  const a = await makeWin('throttle=default', true)
  const b = await makeWin('throttle=false', false)

  await new Promise((r) => setTimeout(r, 2500))

  async function measure(win, label) {
    const m = await win.webContents.executeJavaScript(`(() => {
      const el = document.getElementById('stage').children[0]
      return el ? getComputedStyle(el).transform : 'none'
    })()`)
    console.log(`${label}: transform@t0 = ${m}`)
    return m
  }

  const a0 = await measure(a, 'throttle=default')
  const b0 = await measure(b, 'throttle=false')
  await new Promise((r) => setTimeout(r, 2500))
  const a1 = await measure(a, 'throttle=default')
  const b1 = await measure(b, 'throttle=false')
  console.log(`\n默认(节流): ${a0} -> ${a1}  ${a0 === a1 ? '✗ 动画冻结' : '✓ 动画在跑'}`)
  console.log(`backgroundThrottling:false: ${b0} -> ${b1}  ${b0 === b1 ? '✗ 动画冻结' : '✓ 动画在跑'}`)

  a.destroy(); b.destroy()
  app.exit(0)
})
