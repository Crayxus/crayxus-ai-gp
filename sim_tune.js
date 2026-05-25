/* 参数扫描: 找最匹配真车实测转弯的车模型参数 (KP_HEAD, MAX_YAW, YAW_TAU) */
var S = require('./sim_core.js');

// 真车实测: 命令角 -> 实际末角 (单段 1000ms)
var TARGETS = [[30, 32.0], [60, 65.7], [90, 97.8]];

function tryParams(kp, my, tau) {
  S.CAL.KP_HEAD = kp; S.CAL.MAX_YAW = my; S.CAL.YAW_TAU = tau;
  var err = 0, out = [];
  TARGETS.forEach(function (t) {
    var r = S.simulate([0, 0], 0, [{ delta: -t[0], dur: 1000 }], true);
    var e = -r.traj[r.traj.length - 1].h;        // 末角 (正数)
    out.push(e);
    err += (e - t[1]) * (e - t[1]);
  });
  return { err: err, out: out };
}

var best = null;
for (var kp = 2.0; kp <= 6.0; kp += 0.2)
  for (var my = 120; my <= 280; my += 5)
    for (var tau = 0.08; tau <= 0.40; tau += 0.01) {
      var r = tryParams(kp, my, tau);
      if (!best || r.err < best.err)
        best = { kp: kp, my: my, tau: +tau.toFixed(2), err: r.err, out: r.out };
    }

console.log('=== 最优解 ===');
console.log('  KP_HEAD = ' + best.kp.toFixed(1));
console.log('  MAX_YAW = ' + best.my);
console.log('  YAW_TAU = ' + best.tau);
console.log('  拟合残差 RMS = ' + Math.sqrt(best.err / 3).toFixed(2) + '°');
console.log('--- 拟合对比 ---');
TARGETS.forEach(function (t, i) {
  console.log('  命令 -' + t[0] + '° -> 仿真 -' + best.out[i].toFixed(1) +
    '°   真车 -' + t[1] + '°   差 ' + (best.out[i] - t[1]).toFixed(1) + '°');
});
