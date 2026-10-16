"""Exercise native float32 parity and true float64 data, matrices and tube roots.

Requires the media build's native EGL/OpenGL libraries. The double probe is a
known radial ray for which the un-factored double discriminant is negative due
to cancellation, although the exact ray hits the tube centrally.
"""
import copy
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_renderer', root / 'tools/prerender-egl.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
with tempfile.TemporaryDirectory(prefix='site-native-check-') as scratch:
    subprocess.run(['node', '--experimental-default-type=module',
                    str(root / 'tools/prerender-scene.mjs'), scratch], check=True)
    scene = json.loads((Path(scratch) / 'scene.json').read_text())
    assert scene['precision'] == 'float64'
    # Export the browser reference separately, before any float64 shader replacement.
    script = f"""
      import {{readFile,writeFile}} from 'node:fs/promises';
      import {{packScene}} from {json.dumps((root / 'polyhedral.js').as_uri())};
      const scene=JSON.parse(await readFile({json.dumps(str(Path(scratch) / 'scene.json'))},'utf8'));
      const data=JSON.parse(await readFile({json.dumps(str(root / 'dodecahedral-data.json'))},'utf8'));
      const packed=packScene(data);
      scene.precision='float32';scene.texels=Array.from(packed.texels);scene.fragment=packed.fragment;
      await writeFile({json.dumps(str(Path(scratch) / 'float32.json'))},JSON.stringify(scene));
    """
    subprocess.run(['node', '--experimental-default-type=module', '--input-type=module',
                    '-e', script], check=True)
    browser_scene = json.loads((Path(scratch) / 'float32.json').read_text())
    poses = [scene['stations'][0], scene['stations'][1], scene['legs'][1][240]]
    reference = native.Renderer(browser_scene, 256, 128, steps=160, uniform_buffer=False)
    expected = [reference.render(pose) for pose in poses]
    accelerated = native.Renderer(browser_scene, 256, 128, steps=160, uniform_buffer=True)
    differences = [max(abs(a-b) for a, b in zip(image, accelerated.render(pose)))
                   for image, pose in zip(expected, poses)]
    assert max(differences) <= 1, differences

    probe = copy.deepcopy(scene)
    probe['fragment'] = scene['fragment'].split('void main(){')[0] + '''
void main(){
 dvec3 r=roots(sceneData[0].xy,sceneData[1].xy,beamRadiusSquared);
 double relative=r.z/(beamRadiusSquared*(1.0LF+beamRadiusSquared));
 bool stable=abs(relative-1.0LF)<1e-6LF && r.x>0.0LF && r.x<1.0LF;
 bool constants=sceneData[2].x==16777216.25LF;
 bool matrix=camera[0][0]==16777216.25LF;
 pixel=(stable&&constants&&matrix)?vec4(0.,1.,0.,1.):vec4(1.,0.,0.,1.);
}
'''
    probe['texels'][0:4] = [-10000., 0., 0., 0.]
    probe['texels'][4:8] = [math.sqrt(1+10000.**2), 0., 0., 0.]
    probe['texels'][8] = 16777216.25
    pose = copy.deepcopy(scene['stations'][0])
    pose['camera'][0] = 16777216.25
    double = native.Renderer(probe, 8, 8, steps=160)
    assert double.render(pose) == bytes([0,255,0,255])*64
    # Exercise context switching: a subsequent double context must not alter float output.
    assert accelerated.render(poses[0]) == expected[0]
    print(f'Native highp texture/UBO parity: maximum {max(differences)} byte levels.')
    print('Native float64 UBO values, matrix uniforms and cancellation-resistant radial hit verified.')
