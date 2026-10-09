const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
const added = ['643', '398', '304', '356', '788', '784', '512', '422', '704'];
const square = (x, y, size) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const geometry = { type: 'MultiPolygon', coordinates: [
  [square(0, 0, 10), square(3, 3, 2)], [square(20, 20, 2)]
] };

function app(saved = null, script = source) {
  const storage = new Map(saved ? [['streetguess_free_play_settings', JSON.stringify(saved)]] : []);
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const el = { value: id === 'timeLimitInput' ? '120' : '', checked: id === 'movementAllowed',
        textContent: '', disabled: false, style: {}, dataset: {},
        classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} };
      Object.defineProperty(el, 'innerHTML', { set(markup) {
        this.options = [...markup.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
          .map((m) => ({ value: m[1], textContent: m[2] }));
        if (this.options.length) this.value = this.options[0].value;
      }});
      Object.defineProperty(el, 'selectedOptions', { get() {
        return this.options.filter(option => option.value === this.value);
      }});
      elements.set(id, el);
    }
    return elements.get(id);
  }
  let fetchCount = 0;
  const context = vm.createContext({ console, Math, setTimeout, clearTimeout, setInterval, clearInterval,
    document: { getElementById: element, querySelector: element, querySelectorAll: () => [] },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    window: {},
    google: { maps: { StreetViewSource: { GOOGLE: 'google', DEFAULT: 'default' },
      StreetViewStatus: { OK: 'OK' }, StreetViewPreference: { NEAREST: 'nearest' } } },
    fetch: async () => { fetchCount++; return { ok: true, json: async () => ({ objects: { countries: {} } }) }; }
  });
  const run = code => vm.runInContext(code, context);
  run(script);
  run(`topojson = window.topojson = { feature: () => ({ features: PLAY_REGIONS.map(region =>
    ({ id: region.boundary.featureId, geometry: ${JSON.stringify(geometry)} })) }) };`);
  return { run, context, element, storage, fetchCount: () => fetchCount };
}

function seeded() {
  let state = 123456789;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

test('menu includes all nine additions and does not query coverage or boundaries', () => {
  const a = app();
  for (const id of added) assert.ok(a.element('regionSelect').options.some(o => o.value === id));
  const ids = a.element('regionSelect').options.map(o => o.value);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(a.fetchCount(), 0);
});

test('legacy selections survive and are saved under regionId', () => {
  const a = app({ countryId: '392', timerEnabled: true, timeLimitSeconds: 180, allowMovement: false });
  assert.equal(a.element('regionSelect').value, '392');
  const config = a.run('readFreePlayConfig()');
  assert.equal(config.regionId, '392');
  assert.equal(config.regionName, '日本');
  assert.equal(config.allowMovement, false);
  assert.equal(config.timeLimitSeconds, 180);
  const saved = JSON.parse(a.storage.get('streetguess_free_play_settings'));
  assert.equal(saved.regionId, '392');
  assert.equal(saved.countryId, undefined);
  assert.equal(app(saved).element('regionSelect').value, '392');
  assert.equal(app({ regionId: '304', countryId: '392' }).element('regionSelect').value, '304');
  assert.equal(app({ regionId: 'removed' }).element('regionSelect').value, 'world');
});

test('region boundaries include islands and exclude holes, with one atlas download', async () => {
  const a = app();
  a.context.rng = seeded();
  for (const id of [...added, '392']) {
    a.context.shape = await a.run(`loadRegionGeometry('${id}')`);
    assert.ok(Number.isFinite(a.context.shape.mapSizeKm) && a.context.shape.mapSizeKm > 0);
    assert.equal(a.run('pointInRegion({ lat: 4, lng: 4 }, shape)'), false);
    assert.equal(a.run('pointInRegion({ lat: 21, lng: 21 }, shape)'), true);
    assert.equal(a.run('pointInRegion({ lat: 15, lng: 15 }, shape)'), false);
    for (let i = 0; i < 100; i++) {
      assert.equal(a.run('pointInRegion(randomRegionPoint(shape, rng), shape)'), true);
    }
  }
  assert.equal(a.fetchCount(), 1);
  await assert.rejects(a.run("loadRegionGeometry('unknown')"));
});

test('non-country region can use an independent ID and inline GeoJSON boundary', async () => {
  const script = source.replace('const PLAY_REGIONS = Object.freeze([',
    `const PLAY_REGIONS = Object.freeze([{ id: 'practice-area', name: '練習エリア', boundary: { type: 'geojson', geometry: ${JSON.stringify(geometry)} } },`);
  const a = app(null, script);
  a.context.shape = await a.run("loadRegionGeometry('practice-area')");
  assert.equal(a.run('pointInRegion({ lat: 1, lng: 1 }, shape)'), true);
  assert.equal(a.fetchCount(), 0);
});

test('each added region starts repeated rounds using GOOGLE and rejects out-of-bound panoramas', async () => {
  const a = app();
  const requests = [];
  let calls = 0;
  a.context.service = { getPanorama(request, callback) {
    requests.push(request);
    const outside = calls++ % 2 === 0;
    callback({ location: { latLng: { lat: () => outside ? 40 : 1, lng: () => 1 }, pano: 'mock-pano' } }, 'OK');
  }};
  a.run('svService = service; gameActive = true; started = 0; startRound = () => { started++; };');
  for (const id of added) {
    a.context.shape = await a.run(`loadRegionGeometry('${id}')`);
    a.run(`currentRegionGeometry = shape; gameConfig = { mode: 'free', regionName: '${id}' };`);
    for (let round = 0; round < 3; round++) a.run('findRandomPano()');
  }
  assert.equal(a.run('started'), added.length * 3);
  assert.equal(requests.length, added.length * 6);
  for (const request of requests) {
    assert.equal(request.source, 'google');
    assert.equal(request.radius, 50000);
    assert.equal(a.run(`pointInRegion(${JSON.stringify(request.location)}, shape)`), true);
  }
  a.run("svSource = 'all'; findRandomPano();");
  assert.equal(requests.at(-1).source, 'default');
  a.run("gameConfig.mode = 'challenge'; findRandomPano();");
  assert.equal(requests.at(-1).source, 'google');
});

test('each added selection prepares the game and its regional score size', async () => {
  const a = app();
  a.run('mapsLoaded = true; map = {}; pano = {}; searches = 0; beginRoundSearch = () => { searches++; };');
  for (const id of added) {
    a.element('regionSelect').value = id;
    await a.run('startSelectedGame()');
    assert.equal(a.element('menuError').textContent, '');
    assert.equal(a.run('gameConfig.regionId'), id);
    assert.equal(a.run('currentMapSizeKm'), a.run('currentRegionGeometry.mapSizeKm'));
    assert.equal(a.run('gameActive'), true);
  }
  assert.equal(a.run('searches'), added.length);
});

test('world mode retains its range and needs no boundaries; challenge resets selected region', async () => {
  const a = app();
  const low = a.run('randomLatLng(() => 0)');
  const high = a.run('randomLatLng(() => 1)');
  assert.equal(low.lat, -60); assert.equal(low.lng, -180);
  assert.equal(high.lat, 70); assert.equal(high.lng, 180);
  a.run("mapsLoaded = true; map = {}; pano = {}; selectedMenuMode = 'challenge'; currentRegionGeometry = {}; beginRoundSearch = () => {}; ");
  await a.run('startSelectedGame()');
  assert.equal(a.run('gameConfig.regionId'), 'world');
  assert.equal(a.run('currentRegionGeometry'), null);
  assert.equal(a.run('currentMapSizeKm'), a.run('WORLD_MAP_SIZE_KM'));
  assert.equal(a.fetchCount(), 0);
});

test('date-line boundaries contain both sides of the meridian but not Greenland', () => {
  const a = app();
  a.context.feature = { geometry: { type: 'Polygon', coordinates: [
    [[170, 60], [-170, 60], [-170, 75], [170, 75], [170, 60]],
    [[175, 65], [-175, 65], [-175, 70], [175, 70], [175, 65]]
  ] } };
  a.run(`polygons = geometryPolygons(feature); bounds = polygonBounds(polygons[0]);
    shape = { polygons, components: [{ polygon: polygons[0], bounds, weight: 1 }] };`);
  assert.equal(a.run('pointInRegion({ lat: 62, lng: 179 }, shape)'), true);
  assert.equal(a.run('pointInRegion({ lat: 62, lng: -179 }, shape)'), true);
  assert.equal(a.run('pointInRegion({ lat: 67, lng: 179 }, shape)'), false);
  assert.equal(a.run('pointInRegion({ lat: 67.1799256, lng: -63.9963187 }, shape)'), false);
  assert.equal(a.run('bounds.maxLng - bounds.minLng'), 20);
  a.context.rng = seeded();
  for (let i = 0; i < 1000; i++) {
    a.context.point = a.run('randomRegionPoint(shape, rng)');
    assert.ok(a.context.point.lng >= -180 && a.context.point.lng < 180);
    assert.ok(Math.abs(a.context.point.lng) >= 170);
    assert.equal(a.run('pointInRegion(point, shape)'), true);
  }
});
