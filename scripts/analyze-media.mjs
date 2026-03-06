import { spawnSync } from 'node:child_process'
import { basename } from 'node:path'

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' })
  return { code: res.status ?? 0, stdout: res.stdout || '', stderr: res.stderr || '' }
}

function parseRate(s) {
  if (!s || typeof s !== 'string') return null
  if (s.includes('/')) {
    const [n, d] = s.split('/').map(Number)
    if (d && d !== 0) return n / d
  }
  const v = Number(s)
  return Number.isFinite(v) && v > 0 ? v : null
}

function toFixed(value, digits = 3) {
  if (!Number.isFinite(value)) return 'n/a'
  return value.toFixed(digits)
}

function haveFFprobe() {
  const r = run('ffprobe', ['-version'])
  return r.code === 0
}

function analyzeOne(file) {
  const base = basename(file)
  const meta = run('ffprobe', [
    '-v','error',
    '-select_streams','v:0',
    '-count_frames',
    '-show_entries','stream=codec_name,codec_time_base,r_frame_rate,avg_frame_rate,nb_read_frames,duration',
    '-of','json',
    file
  ])
  if (meta.code !== 0) {
    console.log(`${base}: ffprobe error: ${meta.stderr.trim()}`)
    return
  }
  let parsed
  try { parsed = JSON.parse(meta.stdout) } catch { parsed = null }
  const s = parsed?.streams?.[0] || {}
  const rFps = parseRate(s.r_frame_rate)
  const avgFps = parseRate(s.avg_frame_rate)
  const duration = Number(s.duration)
  const frames = Number(s.nb_read_frames)
  const approxFps = Number.isFinite(frames) && Number.isFinite(duration) && duration > 0 ? frames / duration : null

  const framesSample = run('ffprobe', [
    '-v','error',
    '-select_streams','v:0',
    '-show_frames',
    '-show_entries','frame=pkt_duration_time',
    '-of','csv=p=0',
    '-read_intervals','%+#200',
    file
  ])
  let distinctDur = 0
  let vfr = false
  if (framesSample.code === 0) {
    const vals = framesSample.stdout
      .split('\n')
      .map(x => x.trim())
      .filter(x => x.length > 0)
      .map(Number)
      .filter(Number.isFinite)
    const uniq = new Map()
    for (const v of vals) {
      const k = Math.round(v * 1e6) / 1e6
      uniq.set(k, true)
    }
    distinctDur = uniq.size
    vfr = distinctDur > 3
  }

  const nominal = rFps ?? avgFps ?? approxFps ?? null
  const frameLen = nominal ? 1 / nominal : null
  const frameCountByDuration = frameLen && Number.isFinite(duration) ? duration / frameLen : null
  const nearInt = frameCountByDuration ? Math.abs(Math.round(frameCountByDuration) - frameCountByDuration) < 1e-3 : null

  console.log(`${base}`)
  console.log(`  codec=${s.codec_name || 'n/a'} time_base=${s.codec_time_base || 'n/a'}`)
  console.log(`  r_fps=${toFixed(rFps)} avg_fps=${toFixed(avgFps)} approx_fps=${toFixed(approxFps)}`)
  console.log(`  duration=${toFixed(duration)}s frames=${Number.isFinite(frames)?frames:'n/a'}`)
  console.log(`  frame_durations_sample=${distinctDur} ${vfr?'VFR':'CFR(approx)'}`)
  console.log(`  aligns_to_whole_frames=${nearInt===null?'n/a':nearInt}`)
}

function main() {
  const args = process.argv.slice(2)
  if (!haveFFprobe()) {
    console.log('ffprobe not found. Please install FFmpeg (ffprobe) first.')
    process.exit(1)
  }
  if (args.length === 0) {
    console.log('Usage: node scripts/analyze-media.mjs <video1> <video2> ...')
    process.exit(1)
  }
  for (const f of args) {
    analyzeOne(f)
  }
}

main()

