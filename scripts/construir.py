"""Genera municipios.js: siluetas de los municipios de más de 20.000 habitantes.

Siluetas: es-atlas (IGN), población: Wikidata. Uso: python scripts/construir.py [poblacion_wikidata.json]
"""
import json, math, os, sys, urllib.request, urllib.parse

ATLAS = "https://cdn.jsdelivr.net/npm/es-atlas@0.6.0/es/municipalities.json"
SPARQL = ('SELECT ?ine ?pop WHERE { ?m wdt:P772 ?ine; wdt:P1082 ?pop; wdt:P17 wd:Q29. FILTER(?pop > 20000) }')
MIN_POB = 20000


def bajar(url, cabeceras=None):
    req = urllib.request.Request(url, headers=cabeceras or {"User-Agent": "pueblodle/1.0 (adrianezd)"})
    return json.loads(urllib.request.urlopen(req, timeout=120).read().decode("utf-8"))


def main():
    topo = bajar(ATLAS)
    q = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(SPARQL)
    pob = {}
    if len(sys.argv) > 1:
        res = json.load(open(sys.argv[1], encoding="utf-8"))
    else:
        res = bajar(q, {"User-Agent": "pueblodle/1.0 (adrianezd)", "Accept": "application/sparql-results+json"})
    for b in res["results"]["bindings"]:
        ine = b["ine"]["value"]
        if len(ine) == 5 and ine.isdigit():
            pob[ine] = max(pob.get(ine, 0), int(float(b["pop"]["value"])))

    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcos = []
    for arco in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arco:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcos.append(pts)

    def anillo(indices):
        pts = []
        for i in indices:
            a = arcos[i] if i >= 0 else arcos[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return pts

    def poligonos(g):
        if g["type"] == "Polygon":
            return [[anillo(r) for r in g["arcs"]]]
        if g["type"] == "MultiPolygon":
            return [[anillo(r) for r in p] for p in g["arcs"]]
        return []

    provs = {g["id"]: g["properties"]["name"] for g in topo["objects"]["provinces"]["geometries"]}
    ccaa = {g["id"]: g["properties"]["name"] for g in topo["objects"]["autonomous_regions"]["geometries"]}
    # Provincia -> comunidad por el código de la comunidad que contiene cada provincia (tabla fija del INE).
    PROV_CCAA = {"01": "16", "02": "08", "03": "10", "04": "01", "05": "07", "06": "11", "07": "04", "08": "09", "09": "07",
                 "10": "11", "11": "01", "12": "10", "13": "08", "14": "01", "15": "12", "16": "08", "17": "09", "18": "01",
                 "19": "08", "20": "16", "21": "01", "22": "02", "23": "01", "24": "07", "25": "09", "26": "17", "27": "12",
                 "28": "13", "29": "01", "30": "14", "31": "15", "32": "12", "33": "03", "34": "07", "35": "05", "36": "12",
                 "37": "07", "38": "05", "39": "06", "40": "07", "41": "01", "42": "07", "43": "09", "44": "02", "45": "08",
                 "46": "10", "47": "07", "48": "16", "49": "07", "50": "02", "51": "18", "52": "19"}

    salida = []
    for g in topo["objects"]["municipalities"]["geometries"]:
        ine = g.get("id")
        if pob.get(ine, 0) < MIN_POB:
            continue
        polys = poligonos(g)
        todos = [p for poly in polys for p in poly[0]]
        if not todos:
            continue
        lon = sum(p[0] for p in todos) / len(todos)
        lat = sum(p[1] for p in todos) / len(todos)
        k = math.cos(math.radians(lat))
        xs = [p[0] * k for p in todos]
        ys = [-p[1] for p in todos]
        minx, miny = min(xs), min(ys)
        lado = max(max(xs) - minx, max(ys) - miny) or 1
        caminos = []
        for poly in polys:
            for r in poly:
                pts = ["%.1f %.1f" % ((p[0] * k - minx) / lado * 100, (-p[1] - miny) / lado * 100) for p in r]
                caminos.append("M" + "L".join(pts) + "Z")
        salida.append({"id": ine, "n": g["properties"]["name"], "p": provs.get(ine[:2], ""),
                       "c": ccaa.get(PROV_CCAA.get(ine[:2], ""), ""), "pob": pob[ine],
                       "lat": round(lat, 4), "lon": round(lon, 4), "d": "".join(caminos)})
    salida.sort(key=lambda m: m["id"])
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "municipios.js")
    with open(ruta, "w", encoding="utf-8") as f:
        f.write("// Generado por scripts/construir.py. Siluetas: IGN vía es-atlas. Población: Wikidata.\n")
        f.write("var MUNICIPIOS = " + json.dumps(salida, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(len(salida), "municipios")


if __name__ == "__main__":
    main()
