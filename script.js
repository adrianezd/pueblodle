// Pueblodle: un municipio al día, igual para todos (fecha de Madrid).
var EPOCA = Date.UTC(2026, 9, 6);
var MAX = 6;
var FLECHAS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

function $(id) { return document.getElementById(id); }
function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function hoyMadrid() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()); }

// Orden barajado fijo, para que los municipios no salgan por orden de código.
function orden() {
  var a = MUNICIPIOS.map(function (_, i) { return i; }), s = 20261006;
  function rnd() { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
var dia = Math.floor((Date.parse(hoyMadrid() + 'T00:00:00Z') - EPOCA) / 86400000);
var ORDEN = orden();
var OBJ = MUNICIPIOS[ORDEN[((dia % ORDEN.length) + ORDEN.length) % ORDEN.length]];

function distancia(a, b) {
  var R = 6371, r = Math.PI / 180;
  var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
function rumbo(a, b) {
  var r = Math.PI / 180;
  var y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  var x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  var g = (Math.atan2(y, x) / r + 360) % 360;
  return FLECHAS[Math.round(g / 45) % 8];
}

var estado = { dia: dia, intentos: [] };
try { var g = JSON.parse(localStorage.getItem('pueblodle')); if (g && g.dia === dia) estado = g; } catch (e) {}
function guardar() { try { localStorage.setItem('pueblodle', JSON.stringify(estado)); } catch (e) {} }
function acertado() { return estado.intentos.indexOf(OBJ.id) >= 0; }
function terminado() { return acertado() || estado.intentos.length >= MAX; }

function pintar() {
  $('numero').textContent = '#' + (dia + 1);
  $('silueta').innerHTML = '<path d="' + OBJ.d + '"/>';
  var fallos = estado.intentos.filter(function (id) { return id !== OBJ.id; }).length;
  var pistas = ['<span>' + estado.intentos.length + ' de ' + MAX + ' intentos</span>'];
  if (fallos >= 3 || terminado()) pistas.push('<span>Provincia: <b>' + OBJ.p + '</b></span>');
  if (fallos >= 5 || terminado()) pistas.push('<span>' + OBJ.c + '</span>');
  $('pistas').innerHTML = pistas.join('');
  $('intentos').innerHTML = estado.intentos.map(function (id) {
    var m = MUNICIPIOS.filter(function (x) { return x.id === id; })[0];
    if (m.id === OBJ.id) return '<li class="ok"><b>' + m.n + '</b><span></span><span class="km">¡Correcto!</span><span class="flecha">🎉</span></li>';
    return '<li><span>' + m.n + ' <small style="color:var(--muted)">' + m.p + '</small></span><span></span><span class="km">' + distancia(m, OBJ).toLocaleString('es-ES') + ' km</span><span class="flecha">' + rumbo(m, OBJ) + '</span></li>';
  }).join('');
  $('form').hidden = terminado();
  $('final').hidden = !terminado();
  if (terminado()) {
    $('finalTit').textContent = acertado() ? '¡Acertaste!' : 'Era ' + OBJ.n;
    $('finalTxt').textContent = OBJ.n + ', en ' + OBJ.p + '. ' + OBJ.pob.toLocaleString('es-ES') + ' habitantes.';
  }
}

function probar(m) {
  if (!m || terminado() || estado.intentos.indexOf(m.id) >= 0) return;
  estado.intentos.push(m.id);
  guardar();
  $('entrada').value = '';
  $('sugerencias').hidden = true;
  pintar();
}

var activa = 0, lista = [];
function sugerir() {
  var q = norm($('entrada').value);
  lista = q ? MUNICIPIOS.filter(function (m) { return norm(m.n).indexOf(q) >= 0 && estado.intentos.indexOf(m.id) < 0; })
    .sort(function (a, b) { return (norm(a.n).indexOf(q) === 0 ? 0 : 1) - (norm(b.n).indexOf(q) === 0 ? 0 : 1) || b.pob - a.pob; }).slice(0, 8) : [];
  activa = 0;
  $('sugerencias').hidden = !lista.length;
  $('sugerencias').innerHTML = lista.map(function (m, i) { return '<li data-i="' + i + '"' + (i === activa ? ' class="activa"' : '') + '>' + m.n + ' <small>' + m.p + '</small></li>'; }).join('');
}

$('entrada').addEventListener('input', sugerir);
$('entrada').addEventListener('keydown', function (e) {
  if (!lista.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    activa = (activa + (e.key === 'ArrowDown' ? 1 : lista.length - 1)) % lista.length;
    $('sugerencias').querySelectorAll('li').forEach(function (li, i) { li.classList.toggle('activa', i === activa); });
  }
});
$('sugerencias').addEventListener('mousedown', function (e) {
  var li = e.target.closest('li');
  if (li) { e.preventDefault(); probar(lista[+li.dataset.i]); }
});
$('form').addEventListener('submit', function (e) {
  e.preventDefault();
  var q = norm($('entrada').value);
  probar(lista[activa] || MUNICIPIOS.filter(function (m) { return norm(m.n) === q; })[0]);
});
$('compartir').addEventListener('click', function () {
  var filas = estado.intentos.map(function (id) {
    if (id === OBJ.id) return '🟩';
    var m = MUNICIPIOS.filter(function (x) { return x.id === id; })[0], km = distancia(m, OBJ);
    return (km < 50 ? '🟨' : km < 200 ? '🟧' : '🟥') + rumbo(m, OBJ);
  });
  var txt = 'Pueblodle #' + (dia + 1) + ' ' + (acertado() ? estado.intentos.length : 'X') + '/' + MAX + '\n' + filas.join('\n') + '\n' + location.href.split('#')[0];
  if (navigator.share) navigator.share({ text: txt }).catch(function () {});
  else navigator.clipboard.writeText(txt).then(function () { $('compartir').textContent = 'Copiado'; });
});

function cuentaAtras() {
  var ahora = new Date(), m = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  var falta = (24 * 3600) - (m.getHours() * 3600 + m.getMinutes() * 60 + m.getSeconds());
  $('cuenta').textContent = 'Nuevo municipio en ' + Math.floor(falta / 3600) + ' h ' + Math.floor(falta % 3600 / 60) + ' min';
}
pintar();
cuentaAtras();
setInterval(cuentaAtras, 30000);
