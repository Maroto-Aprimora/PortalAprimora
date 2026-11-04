// Uso: node scripts/gerar-animacoes-lottie.mjs src/components/ui/animacoes
// Gera as animações Lottie do portal (desenhadas à mão, só traços, cor definida por CSS).
import fs from "node:fs";
const dir = process.argv[2];
const est = (k) => ({ a: 0, k });
const ease = { i: { x: [0.45], y: [1] }, o: { x: [0.55], y: [0] } };
const anim = (quadros) => ({ a: 1, k: quadros.map(([t, s], n) => (n < quadros.length - 1 ? { t, s, ...ease } : { t, s })) });
const tr = () => ({ ty: "tr", p: est([0, 0]), a: est([0, 0]), s: est([100, 100]), r: est(0), o: est(100), sk: est(0), sa: est(0) });
const traco = (w = 3) => ({ ty: "st", c: est([0.4, 0.4, 0.4, 1]), o: est(100), w: est(w), lc: 2, lj: 2, ml: 4 });
const preench = () => ({ ty: "fl", c: est([1, 1, 1, 1]), o: est(100), r: 1 });
const caminho = (v, fechado = false) => ({ ty: "sh", ks: est({ i: v.map(() => [0, 0]), o: v.map(() => [0, 0]), v, c: fechado }) });
const retangulo = (w, h, p, r) => ({ ty: "rc", d: 1, s: est([w, h]), p: est(p), r: est(r) });
const elipse = (d) => ({ ty: "el", d: 1, s: est([d, d]), p: est([0, 0]) });
const grupo = (it) => ({ ty: "gr", it: [...it, tr()] });
const camada = (ind, nm, cl, shapes, ks = {}, op = 120) => ({
  ddd: 0, ind, ty: 4, nm, cl, sr: 1, ao: 0, ip: 0, op, st: 0, bm: 0,
  ks: { o: est(100), r: est(0), p: est([60, 60, 0]), a: est([0, 0, 0]), s: est([100, 100, 100]), ...ks },
  shapes,
});
const doc = (nm, op, layers) => ({ v: "5.7.4", fr: 60, ip: 0, op, w: 120, h: 120, nm, ddd: 0, assets: [], layers });

// 1) Vazio: bandeja com uma folha flutuando suavemente (laço de 2 s)
const flutua = anim([[0, [60, 40, 0]], [60, [60, 33, 0]], [120, [60, 40, 0]]]);
const vazio = doc("vazio", 120, [
  camada(1, "folha", "traco-marca", [
    grupo([retangulo(30, 36, [0, 0], 4), traco(2.5)]),
    grupo([caminho([[-8, -6], [8, -6]]), caminho([[-8, 1], [8, 1]]), caminho([[-8, 8], [2, 8]]), traco(2.5)]),
  ], { p: flutua }),
  camada(2, "folha-fundo", "fundo-superficie", [grupo([retangulo(30, 36, [0, 0], 4), preench()])], { p: flutua }),
  camada(3, "bandeja", "traco", [
    grupo([caminho([[-38, 8], [-24, -22], [24, -22], [38, 8], [38, 32], [-38, 32]], true), traco(2.5)]),
    grupo([caminho([[-38, 8], [-14, 8], [-9, 17], [9, 17], [14, 8], [38, 8]]), traco(2.5)]),
  ], { p: est([60, 70, 0]) }),
]);

// 2) Sucesso: círculo se desenha, o "check" entra e tudo dá um leve pulo (toca uma vez, 1 s)
const trim = (ini, fim) => ({ ty: "tm", s: est(0), e: anim([[ini, [0]], [fim, [100]]]), o: est(0), m: 1 });
const sucesso = doc("sucesso", 60, [
  camada(1, "check", "traco-sucesso", [grupo([caminho([[-14, 1], [-4, 11], [15, -9]]), traco(4.5), trim(14, 34)])],
    { s: anim([[0, [100, 100, 100]], [34, [100, 100, 100]], [44, [112, 112, 100]], [56, [100, 100, 100]]]) }, 60),
  camada(2, "circulo", "traco-sucesso", [grupo([elipse(68), traco(4), trim(0, 24)])],
    { r: est(-90), s: anim([[0, [100, 100, 100]], [34, [100, 100, 100]], [44, [108, 108, 100]], [56, [100, 100, 100]]]) }, 60),
  camada(3, "halo", "fundo-sucesso", [grupo([elipse(68), preench()])],
    { o: anim([[0, [0]], [24, [0]], [40, [100]]]), s: anim([[24, [70, 70, 100]], [44, [100, 100, 100]]]) }, 60),
]);

fs.writeFileSync(`${dir}/vazio.json`, JSON.stringify(vazio));
fs.writeFileSync(`${dir}/sucesso.json`, JSON.stringify(sucesso));
