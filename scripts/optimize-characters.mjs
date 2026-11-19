import { mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [toolDir, sourceDir, outputDir] = process.argv.slice(2);
if (!outputDir) throw new Error('Usage: node scripts/optimize-characters.mjs <tool install dir> <raw GLBs> <output dir>');
const fromTools = createRequire(resolve(toolDir, 'package.json'));
const acquire = name => import(pathToFileURL(fromTools.resolve(name)));
const { NodeIO } = await acquire('@gltf-transform/core');
const { KHRMeshQuantization } = await acquire('@gltf-transform/extensions');
const { dedup, prune, quantize, resample, simplify, weld } = await acquire('@gltf-transform/functions');
const { MeshoptSimplifier } = await acquire('meshoptimizer');
const { default: sharp } = await acquire('sharp');
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions([KHRMeshQuantization]);

const clips = new Map([
 ['Idle', 'idle'], ['Walk', 'walk'], ['Slouch walk', 'shamble'], ['Run', 'run'],
 ['Turn left 45°', 'turnLeft'], ['Turn right 45°', 'turnRight'], ['Sword slash', 'melee'],
 ['Pistol aim', 'aim'], ['Pistol fire', 'fire'], ['Forward roll', 'dodge'],
 ['Hit from front', 'hit'], ['Death (fall forward)', 'fall'], ['Death (fall backward)', 'fallBack'],
 ['Use / press', 'interact'], ['Talk with gestures', 'talk'], ['Stumble and recover', 'stagger'], ['Punch', 'attack'],
]);

function thinMotion(root) {
 for (const animation of root.listAnimations()) {
  const previous = animation.getName();
  if (!clips.has(previous)) throw new Error(`Unexpected raw clip ${previous}`);
  animation.setName(clips.get(previous));
  for (const sampler of animation.listSamplers()) {
   const input = sampler.getInput(), output = sampler.getOutput();
   if (sampler.getInterpolation() !== 'LINEAR' || input.getCount() < 4) continue;
   const last = input.getCount() - 1;
   const points = Array.from({ length: Math.floor(last / 2) + 1 }, (_, i) => i * 2);
   if (points.at(-1) !== last) points.push(last);
   const width = output.getElementSize(), times = input.getArray(), samples = output.getArray();
   sampler.setInput(input.clone().setArray(Float32Array.from(points, i => times[i])));
   const reduced = points.flatMap(i => Array.from(samples.subarray(i * width, (i + 1) * width)));
   sampler.setOutput(output.clone().setArray(Float32Array.from(reduced)));
  }
 }
}

async function compressImages(root, hero) {
 const roles = new Map();
 for (const material of root.listMaterials()) {
  const name = material.getName(), color = material.getBaseColorTexture();
  if (color) {
   const previous = roles.get(color) ?? {};
   roles.set(color, {
    edge: Math.max(previous.edge ?? 0, name === 'Skin' ? (hero ? 768 : 512) : name === 'Hair' ? 384 : name === 'Eyes' || name === 'Eyebrows' ? 128 : 256),
    alpha: previous.alpha || material.getAlphaMode() !== 'OPAQUE',
    plaid: previous.plaid || (hero && name === 'Uniform shirt'),
   });
  }
  // Preserve the hero's main fabric normals and use scalar roughness on the rest.
  const normal = material.getNormalTexture();
  if (hero && name === 'Uniform shirt' && normal) roles.set(normal, { edge: 256 });
  else material.setNormalTexture(null);
  material.setMetallicRoughnessTexture(null);
  if (hero && name === 'Epaulettes') material.setBaseColorFactor([.19,.065,.052,1]);
 }
 for (const texture of root.listTextures()) {
  const role = roles.get(texture);
  if (!role) continue;
  let image = sharp(texture.getImage()).resize(role.edge, role.edge, { fit: 'inside', withoutEnlargement: true });
  if (role.plaid) {
   const { data, info } = await image.removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
   for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const offset = (y * info.width + x) * 3;
    const u = x / info.width * 4 % 1, v = y / info.height * 4 % 1;
    const shade = (axis) => axis < .22 ? .54 : axis > .45 && axis < .51 ? .73 : 1;
    const thread = (u > .30 && u < .32) || (v > .30 && v < .32) ? 1.19 : 1;
    const value = (.78 + data[offset] / 640) * shade(u) * shade(v) * thread;
    data[offset] = 136 * value; data[offset + 1] = 43 * value; data[offset + 2] = 38 * value;
   }
   image = sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });
  }
  const data = role.alpha ? await image.png({ palette: true, quality: 90 }).toBuffer() : await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  texture.setMimeType(role.alpha ? 'image/png' : 'image/jpeg').setImage(data);
 }
}

await mkdir(outputDir, { recursive: true });
for (const name of ['survivor', 'mara', 'vale', 'guard', 'infected']) {
 const input = resolve(sourceDir, name + '.glb'), output = resolve(outputDir, name + '.glb');
 const document = await io.read(input), root = document.getRoot();
 const hero = name === 'survivor';
 if (hero) thinMotion(root);
 await compressImages(root, hero);
 await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: hero ? .59 : name === 'infected' ? .34 : .44, error: .006 }),
  resample(), quantize(), dedup(), prune({ keepLeaves: true }));
 if (root.listSkins().length !== 1 || root.listSkins()[0].listJoints().length !== 26) throw new Error(`Invalid rig in ${name}`);
 if (hero && root.listAnimations().length !== clips.size) throw new Error('Missing survivor animation');
 await io.write(output, document);
 const triangles = root.listMeshes().flatMap(mesh => mesh.listPrimitives()).reduce((sum, prim) => sum + prim.getIndices().getCount() / 3, 0);
 console.log(`${name}: ${triangles} triangles, ${(await stat(input)).size} B source, ${(await stat(output)).size} B optimized`);
}
