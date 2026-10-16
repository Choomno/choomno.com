"""Render site media from an exported scene and encode forward/reverse clips.

Requirements: Node.js, Python with Pillow, system EGL/OpenGL 4.5 (Mesa), and FFmpeg
with libx264 and libvpx-vp9. No browser or display server is needed. Raw frames
stay outside the served repository. LP_NUM_THREADS limits Mesa worker threads.

  node --experimental-default-type=module tools/prerender-scene.mjs /tmp/site-render
  LP_NUM_THREADS=8 python tools/prerender-media.py --work /tmp/site-render --output media

Use --ffmpeg /path/to/ffmpeg (or FFMPEG_BINARY) for a non-system encoder. The
optional imageio-ffmpeg Python package supplies a suitable executable; it need
not be installed in the website or the host's global Python environment.

Rendering is resumable when scene and quality settings match. --force invalidates
old cached frames before starting a new generation. --encode-only reuses a
completed render without creating a GL context. Default video output is 1920x960,
rendered at 2880x1440 and Lanczos-downsampled. Each eight-second route contains
481 frames at 60fps: the exact destination is at PTS 8.0s and the container lasts
8.0167s. Reverse clips reuse the same frames backwards. Portrait files are exact
center crops with the same vertical field of view.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import subprocess
import time
from pathlib import Path
from PIL import Image


def portrait_width(height):
    return (height * 3 // 4) // 2 * 2


def save_image(image, path):
    temporary = path.with_name('.' + path.stem + '.partial' + path.suffix)
    if path.suffix == '.webp':
        image.save(temporary, quality=96, method=6)
    else:
        image.save(temporary, compress_level=1)
    temporary.replace(path)


def crop_portrait(image):
    width, height = image.size
    cropped_width = portrait_width(height)
    left = (width - cropped_width) // 2
    return image.crop((left, 0, left + cropped_width, height))


def encode(source, output, fps, codec, frame_count, *, ffmpeg='ffmpeg',
           threads=2, portrait=False, width=1920, height=960):
    filters = ['format=yuv420p']
    if portrait:
        cropped_width = portrait_width(height)
        filters.insert(0, f'crop={cropped_width}:{height}:{(width-cropped_width)//2}:0')
    common = [ffmpeg, '-hide_banner', '-loglevel', 'warning', '-y',
              '-framerate', str(fps), '-i', str(source / '%04d.png'), '-an',
              '-frames:v', str(frame_count), '-vf', ','.join(filters),
              '-threads', str(threads)]
    if codec == 'mp4':
        options = ['-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
                   '-g', str(fps), '-profile:v', 'high', '-movflags', '+faststart']
    else:
        options = ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '21',
                   '-deadline', 'good', '-cpu-used', '3', '-row-mt', '1', '-g', str(fps)]
    temporary = output.with_name('.' + output.stem + '.partial' + output.suffix)
    subprocess.run(common + options + [str(temporary)], check=True)
    temporary.replace(output)


def encode_leg(work, output, scene, leg, *, ffmpeg='ffmpeg', threads=2,
               width=1920, height=960):
    frames = scene['legs'][leg]
    directory = work / 'frames' / f'leg-{leg}'
    for i in range(len(frames)):
        if not (directory / f'{i:04d}.png').is_file():
            raise RuntimeError(f'Incomplete leg {leg}: frame {i} is missing')
    reverse = work / 'frames' / f'leg-{leg}-reverse'
    reverse.mkdir(parents=True, exist_ok=True)
    for i in range(len(frames)):
        target = reverse / f'{i:04d}.png'
        original = directory / f'{len(frames)-1-i:04d}.png'
        target.unlink(missing_ok=True)
        os.link(original, target)
    for direction, source in [('forward', directory), ('reverse', reverse)]:
        for portrait in [False, True]:
            suffix = '-portrait' if portrait else ''
            for codec in ['mp4', 'webm']:
                path = output / f'transition-{leg}-{direction}{suffix}.{codec}'
                print(f'Encoding {path.name}', flush=True)
                encode(source, path, scene['fps'], codec, len(frames), ffmpeg=ffmpeg,
                       threads=threads, portrait=portrait, width=width, height=height)


def write_manifest(work, output, scene, settings, ffmpeg):
    width, height = settings['width'], settings['height']
    expected = [f'station-{i}{suffix}.webp' for i in range(len(scene['stations']))
                for suffix in ['', '-portrait']]
    expected += [f'transition-{leg}-{direction}{suffix}.{codec}'
                 for leg in range(len(scene['legs'])) for direction in ['forward', 'reverse']
                 for suffix in ['', '-portrait'] for codec in ['mp4', 'webm']]
    for name in expected:
        if not (output / name).is_file():
            raise RuntimeError(f'Cannot finalize incomplete media: {name} is missing')
    manifest = {
        'version': 1, 'width': width, 'height': height, 'aspectRatio': width / height,
        'portraitWidth': portrait_width(height), 'portraitHeight': height,
        'fps': scene['fps'], 'frameCount': scene['intervals'] + 1,
        'timelineDuration': scene['timelineDuration'],
        'videoDuration': (scene['intervals'] + 1) / scene['fps'],
        'fieldScale': .82, 'beamRadius': .025, 'sceneSha256': settings['sceneSha256'],
        'geometryPrecision': scene.get('precision', 'float32'),
        'colorPrecision': 'float32', 'tubeDiscriminant': 'factored-compensated',
        'tubeFacing': 'scalar-discriminant',
        'maxSteps': settings['steps'], 'supersampling': settings['supersample'],
        'resampling': 'Lanczos', 'stillWidth': settings['still_width'],
        'stillHeight': settings['still_height'], 'stillMaxSteps': settings['still_steps'],
        'sourceHashes': scene['sourceHashes'],
        'encoding': {'mp4': {'encoder': 'libx264', 'crf': 18, 'preset': 'slow'},
                     'webm': {'encoder': 'libvpx-vp9', 'crf': 21, 'cpuUsed': 3},
                     'pixelFormat': 'yuv420p', 'keyframeInterval': scene['fps'],
                     'ffmpegVersion': subprocess.check_output(
                         [ffmpeg, '-version'], text=True).splitlines()[0]},
        'stations': [{'index': i, 'image': f'station-{i}.webp',
                      'portraitImage': f'station-{i}-portrait.webp', 'phase': frame['phase']}
                     for i, frame in enumerate(scene['stations'])],
        'transitions': [],
    }
    for leg in range(len(scene['legs'])):
        entry = {'from': leg, 'to': leg + 1}
        for direction in ['forward', 'reverse']:
            entry[direction] = {codec: f'transition-{leg}-{direction}.{codec}'
                                for codec in ['mp4', 'webm']}
            entry[direction]['portrait'] = {
                codec: f'transition-{leg}-{direction}-portrait.{codec}'
                for codec in ['mp4', 'webm']}
        manifest['transitions'].append(entry)
    manifest['files'] = {
        path.name: {'bytes': path.stat().st_size,
                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        for path in sorted(output.iterdir()) if path.suffix in ['.webp', '.mp4', '.webm']
        and not path.name.startswith('.')}
    temporary = output / '.manifest.partial.json'
    temporary.write_text(json.dumps(manifest, indent=2) + '\n')
    temporary.replace(output / 'manifest.json')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--height', type=int, default=960)
    parser.add_argument('--still-width', type=int, default=3840)
    parser.add_argument('--still-height', type=int, default=1920)
    parser.add_argument('--supersample', type=float, default=1.5)
    parser.add_argument('--steps', type=int, default=160)
    parser.add_argument('--still-steps', type=int, default=160)
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--skip-encode', action='store_true')
    parser.add_argument('--encode-only', action='store_true')
    parser.add_argument('--ffmpeg', default=os.environ.get('FFMPEG_BINARY', 'ffmpeg'))
    parser.add_argument('--threads', type=int, default=2)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    scene = json.loads((args.work / 'scene.json').read_text())
    started = time.perf_counter()
    if any(v <= 0 or v % 2 for v in [args.width, args.height, args.still_width, args.still_height]):
        parser.error('Image dimensions must be positive even integers.')
    if args.supersample < 1 or args.threads < 1 or args.steps < 1 or args.still_steps < 1:
        parser.error('Supersampling, threads and traversal limits must be at least 1.')
    if args.width * args.still_height != args.height * args.still_width:
        parser.error('Stills and videos must use the same aspect ratio.')
    if args.width < portrait_width(args.height):
        parser.error('Master image must be at least as wide as the portrait crop.')
    if args.encode_only and (args.force or args.skip_encode):
        parser.error('--encode-only cannot be combined with --force or --skip-encode.')
    keys = ['width', 'height', 'still_width', 'still_height', 'supersample', 'steps', 'still_steps']
    settings = {key: getattr(args, key) for key in keys}
    settings['sceneSha256'] = hashlib.sha256((args.work / 'scene.json').read_bytes()).hexdigest()
    settings_path = args.work / 'render-settings.json'
    if settings_path.exists() and not args.force and json.loads(settings_path.read_text()) != settings:
        parser.error('Cached render settings differ; choose a new work directory or use --force.')
    if not settings_path.exists() and not args.force and any((args.work / 'frames').glob('leg-*/*.png')):
        parser.error('Cached frames have no provenance record; choose a new work directory or use --force.')
    if args.encode_only and not settings_path.exists():
        parser.error('--encode-only requires the provenance record from a completed render.')
    if args.force:
        # Invalidate the entire old generation first, so interruption cannot mix scenes.
        for path in (args.work / 'frames').glob('leg-*/*.png'):
            path.unlink()
    settings_path.write_text(json.dumps(settings, indent=2) + '\n')
    if not args.encode_only:
        spec = importlib.util.spec_from_file_location(
            'prerender_egl', Path(__file__).with_name('prerender-egl.py'))
        egl = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(egl)
        def render_image(renderer, frame, size):
            image = Image.frombytes('RGBA', (renderer.width, renderer.height), renderer.render(frame))
            image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB')
            return image.resize(size, Image.Resampling.LANCZOS) if image.size != size else image
        # Poster cache belongs to this work generation, not an arbitrary output directory.
        poster_provenance = args.work / 'poster-settings.json'
        poster_names = [f'station-{i}{suffix}.webp' for i in range(len(scene['stations']))
                        for suffix in ['', '-portrait']]
        record = {}
        if not args.force and poster_provenance.exists():
            try:
                record = json.loads(poster_provenance.read_text())
            except json.JSONDecodeError:
                pass  # Incomplete provenance never authorizes reuse of existing images.
        reuse_posters = (not args.force and record.get('settings') == settings
                         and all((args.output / name).is_file()
                                 and hashlib.sha256((args.output / name).read_bytes()).hexdigest()
                                 == record.get('files', {}).get(name) for name in poster_names))
        if not reuse_posters:
            poster_provenance.unlink(missing_ok=True)
            still = egl.Renderer(scene, round(args.still_width * args.supersample),
                                 round(args.still_height * args.supersample), args.still_steps)
            for i, frame in enumerate(scene['stations']):
                image = render_image(still, frame, (args.still_width, args.still_height))
                save_image(image, args.output / f'station-{i}.webp')
                save_image(crop_portrait(image), args.output / f'station-{i}-portrait.webp')
                print(f'Still {i} complete', flush=True)
            record = {'settings': settings, 'files': {
                name: hashlib.sha256((args.output / name).read_bytes()).hexdigest()
                for name in poster_names}}
            poster_provenance.write_text(json.dumps(record, indent=2) + '\n')
        renderer = egl.Renderer(scene, round(args.width * args.supersample),
                                round(args.height * args.supersample), args.steps)
    for leg, frames in enumerate(scene['legs']):
        directory = args.work / 'frames' / f'leg-{leg}'
        directory.mkdir(parents=True, exist_ok=True)
        if not args.encode_only:
            for i, frame in enumerate(frames):
                path = directory / f'{i:04d}.png'
                if not path.exists():
                    save_image(render_image(renderer, frame, (args.width, args.height)), path)
                if i % 20 == 0 or i == len(frames) - 1:
                    print(f'Leg {leg}: {i+1}/{len(frames)}, elapsed {time.perf_counter()-started:.0f}s', flush=True)
        if not args.skip_encode:
            encode_leg(args.work, args.output, scene, leg, ffmpeg=args.ffmpeg,
                       threads=args.threads, width=args.width, height=args.height)
    if not args.skip_encode:
        write_manifest(args.work, args.output, scene, settings, args.ffmpeg)
    print(f'Complete: {time.perf_counter()-started:.0f}s', flush=True)


if __name__ == '__main__':
    main()
