/* 用热身实测数据重新规划 WP->WP4 (含朝向修正 + 实测速度) */
var S = require('./sim_core.js');

// ---- 热身实测 ----
S.CAL.V = 1.62;                 // 实测速度 (800ms 走 1.344m, 电池掉电 1.95->1.62)
var C = [-3.552, 2.244];        // 车热身后位置 (UWB)
var Hcar = 15.1;                // 车热身实测朝向 (UWB, 位移方向)

var WPS = [C, [0.25, 3.58], [1.91, 1.57], [-0.34, 0.09]];   // 当前 -> WP2,WP3,WP4
var NM = ['车', 'WP2', 'WP3', 'WP4'];

function norm(a) { while (a > 180) a -= 360; while (a < -180) a += 360; return a; }

var legs = [];
for (var i = 0; i < WPS.length - 1; i++) {
  var dx = WPS[i + 1][0] - WPS[i][0], dy = WPS[i + 1][1] - WPS[i][1];
  legs.push({ L: Math.hypot(dx, dy), h: Math.atan2(dy, dx) * 180 / Math.PI });
}
var turns = [norm(legs[0].h - Hcar)];                  // 第1段 = 朝向修正
for (var i = 1; i < legs.length; i++) turns.push(norm(legs[i].h - legs[i - 1].h));

var R = S.CAL.V / (S.CAL.YAW_RATE * Math.PI / 180);
var T = [];
for (var i = 0; i < legs.length; i++) T.push(R * Math.tan(Math.abs(turns[i]) / 2 * Math.PI / 180));
T.push(0);

var segs = [];
for (var i = 0; i < legs.length; i++) {
  var straight = legs[i].L - T[i] - T[i + 1];
  var dur = (Math.abs(turns[i]) / S.CAL.YAW_RATE + Math.max(0, straight) / S.CAL.V) * 1000;
  segs.push({ delta: +turns[i].toFixed(1), dur: Math.round(dur) });
}

console.log('=== 重新规划 (热身真实数据) ===');
console.log('  车在 (' + C + ')  朝向 ' + Hcar + '°  速度 ' + S.CAL.V + ' m/s');
for (var i = 0; i < legs.length; i++)
  console.log('  段' + (i + 1) + ' ' + NM[i] + '->' + NM[i + 1] +
    ': delta=' + segs[i].delta + '°  dur=' + segs[i].dur + 'ms  (腿 ' + legs[i].L.toFixed(2) + 'm)');
console.log('  set_lap d=' + segs.map(function (s) { return s.delta + ',' + s.dur; }).join(';'));

var res = S.simulate(C, Hcar, segs);
console.log('--- 仿真 ---');
if (res.hit) {
  console.log('  X 撞墙 段' + (res.hit.seg + 1) + ' @ (' +
    res.hit.x.toFixed(2) + ',' + res.hit.y.toFixed(2) + ')');
} else {
  var e = res.traj[res.traj.length - 1];
  console.log('  OK 跑通, 终点 (' + e.x.toFixed(2) + ',' + e.y.toFixed(2) +
    ')  目标 WP4 (-0.34,0.09)  误差 ' +
    Math.hypot(e.x + 0.34, e.y - 0.09).toFixed(2) + 'm');
}
