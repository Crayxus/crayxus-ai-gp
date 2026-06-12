/* ===================================================================
 *  择大 AI·GP  赛车仿真核心
 *  - 赛道墙 (UWB 坐标) / 航点 / 标定参数
 *  - 路线算法: 航点 -> MAPB_LAP 段
 *  - 运动仿真 + 撞墙检测
 *  浏览器 (track_sim.html) 和 node 都能用。
 *  node 直跑:  node sim_core.js
 * =================================================================== */

// ---- 赛道墙 (UWB 坐标, 来自 wall_uwb.json) ----
var OUTER = [[-0.962,-1.233],[-1.106,-1.178],[-1.232,-1.086],[-1.329,-0.966],[-1.665,-0.414],[-1.761,-0.29],[-1.882,-0.191],[-2.022,-0.121],[-2.175,-0.084],[-2.331,-0.082],[-2.484,-0.115],[-2.626,-0.181],[-3.178,-0.517],[-3.302,-0.613],[-3.401,-0.734],[-3.471,-0.874],[-3.508,-1.026],[-3.51,-1.183],[-3.478,-1.336],[-3.412,-1.478],[-3.075,-2.03],[-3.012,-2.172],[-2.989,-2.325],[-3.005,-2.479],[-3.061,-2.623],[-3.152,-2.749],[-3.273,-2.846],[-5.481,-4.192],[-5.622,-4.254],[-5.775,-4.278],[-5.929,-4.262],[-6.074,-4.206],[-6.199,-4.114],[-6.296,-3.994],[-8.315,-0.682],[-8.378,-0.541],[-8.402,-0.387],[-8.385,-0.233],[-8.329,-0.089],[-8.238,0.036],[-8.117,0.133],[0.162,5.18],[0.304,5.243],[0.457,5.267],[0.611,5.25],[0.755,5.194],[0.88,5.103],[0.977,4.983],[2.996,1.671],[3.059,1.529],[3.083,1.376],[3.066,1.222],[3.01,1.078],[2.919,0.953],[2.798,0.855],[-0.513,-1.163],[-0.655,-1.226],[-0.808,-1.25],[-0.962,-1.233]];

var INNER = [[-0.671,1.515],[-0.542,1.413],[-0.393,1.344],[-0.232,1.311],[-0.068,1.317],[0.09,1.362],[0.234,1.442],[0.355,1.553],[0.447,1.689],[0.504,1.844],[0.524,2.007],[0.505,2.17],[0.448,2.325],[0.357,2.461],[0.237,2.573],[0.094,2.654],[-0.065,2.699],[-0.229,2.706],[-0.39,2.674],[-0.54,2.606],[-5.507,-0.423],[-5.631,-0.519],[-5.73,-0.64],[-5.8,-0.78],[-5.837,-0.932],[-5.839,-1.089],[-5.806,-1.242],[-5.74,-1.384],[-5.04,-2.533],[-4.949,-2.478],[-5.65,-1.329],[-5.712,-1.187],[-5.736,-1.034],[-5.72,-0.88],[-5.664,-0.735],[-5.573,-0.61],[-5.452,-0.513],[-1.588,1.842],[-1.447,1.905],[-1.294,1.929],[-1.14,1.912],[-0.995,1.856],[-0.87,1.765],[-0.773,1.644],[-0.671,1.515]];

// ---- 航点 (UWB 实测, WP1..WP8) ----
var WAYPOINTS = [[-4.64,1.53],[0.25,3.58],[1.91,1.57],[-0.34,0.09],[-1.73,0.87],[-4.39,-2.73],[-5.61,-3.57],[-7.26,-1.01]];

// ---- 标定参数 (赛车实测) ----
var CAL = {
  V: 1.95,           // m/s   巡航速度  (距离 = 1.95*t + 0.05)
  FWD_OFFSET: 0.05,  // m     前进截距
  KP_HEAD: 4.8,      // 航向P (参数扫描拟合真车实测转弯, RMS 0.08°)
  MAX_YAW: 155,      // deg/s 最大偏航角速度 (满舵)
  YAW_TAU: 0.20,     // s     偏航一阶滞后 (舵机ramping+车身惯性 -> 过冲来源)
  YAW_RATE: 110,     // deg/s planRoute 估时长/转弯半径用的等效速率
  CAR_CLEAR: 0.15    // m     车半宽+余量, 离墙小于此 = 撞
};

// ---- 墙段: 相邻点连线, 跳过 >4.2m 的跳变线 ----
function wallSegments() {
  var segs = [];
  [OUTER, INNER].forEach(function (poly) {
    for (var i = 0; i < poly.length - 1; i++) {
      var a = poly[i], b = poly[i + 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4.2) segs.push([a, b]);
    }
  });
  return segs;
}

// ---- 点到线段最近距离 ----
function distToSeg(p, a, b) {
  var vx = b[0] - a[0], vy = b[1] - a[1];
  var wx = p[0] - a[0], wy = p[1] - a[1];
  var L2 = vx * vx + vy * vy;
  var t = L2 > 0 ? (wx * vx + wy * vy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  var cx = a[0] + t * vx, cy = a[1] + t * vy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

// ---- 路线算法: 航点 -> MAPB_LAP 段 (转弯切线几何) ----
//  车转弯半径 R; 在每个转弯点提前 T=R*tan(|A|/2) 起转, 弧线切角。
//  每段 = 转弯(turnT) + 直行(strT); 第1段不转(车头已朝WP2)。
function planRoute(wps) {
  var legs = [];
  for (var i = 0; i < wps.length - 1; i++) {
    var dx = wps[i + 1][0] - wps[i][0], dy = wps[i + 1][1] - wps[i][1];
    legs.push({ L: Math.hypot(dx, dy), h: Math.atan2(dy, dx) * 180 / Math.PI });
  }
  var n = legs.length;
  var turns = [0];
  for (var i = 1; i < n; i++) {
    var t = legs[i].h - legs[i - 1].h;
    while (t > 180) t -= 360;
    while (t < -180) t += 360;
    turns.push(t);
  }
  var R = CAL.V / (CAL.YAW_RATE * Math.PI / 180);     // 转弯半径 m
  var T = [];                                          // 各转弯点切线距离
  for (var i = 0; i < n; i++) T.push(R * Math.tan(Math.abs(turns[i]) / 2 * Math.PI / 180));
  T.push(0);                                           // 终点无转弯
  var segs = [];
  for (var i = 0; i < n; i++) {
    var A = turns[i];
    var straight = legs[i].L - T[i] - T[i + 1];        // 直行段 = 腿长 - 两端弧占用
    var turnT = Math.abs(A) / CAL.YAW_RATE;            // 转弯耗时 s
    var strT = Math.max(0, straight) / CAL.V;          // 直行耗时 s
    segs.push({ delta: +A.toFixed(1), dur: Math.round((turnT + strT) * 1000),
                legL: legs[i].L, legH: legs[i].h, straight: +straight.toFixed(2), R: R });
  }
  return segs;
}

// ---- 运动仿真: 模拟 MPU 闭环执行 MAPB_LAP 段 ----
//  航向偏差 -> P控制 -> 期望偏航(满舵饱和) -> 一阶滞后 -> 实际偏航 -> 航向积分
//  一阶滞后 = 舵机ramping + 车身惯性, 这是真实「过冲」的来源。
//  全局连续步进: 段边界只切换目标航向, 不按段重新量化时间
//  -> 把一段拆成两段(中点插值)轨迹完全不变。
function simulate(start, startHeading, segs, noCollide) {
  var x = start[0], y = start[1], h = startHeading, targetH = startHeading;
  var yaw = 0;                                  // 当前偏航角速度 deg/s
  var traj = [{ x: x, y: y, h: h, t: 0 }];
  var walls = noCollide ? [] : wallSegments();
  var dt = 0.02, hit = null;
  if (!segs.length) return { traj: traj, hit: null, segs: segs };
  var bound = [], acc = 0;                      // 各段累计结束时刻 (s)
  for (var i = 0; i < segs.length; i++) { acc += segs[i].dur / 1000; bound.push(acc); }
  var total = acc, si = 0, t = 0;
  targetH += segs[0].delta;                     // 段0目标航向
  while (t < total && !hit) {
    while (si < segs.length - 1 && t >= bound[si]) { si++; targetH += segs[si].delta; }
    var err = targetH - h;                      // 航向偏差
    while (err > 180) err -= 360;
    while (err < -180) err += 360;
    var yawCmd = CAL.KP_HEAD * err;             // P -> 期望偏航角速度
    if (yawCmd > CAL.MAX_YAW) yawCmd = CAL.MAX_YAW;
    if (yawCmd < -CAL.MAX_YAW) yawCmd = -CAL.MAX_YAW;
    yaw += (yawCmd - yaw) * Math.min(1, dt / CAL.YAW_TAU);  // 一阶滞后 -> 过冲
    h += yaw * dt;
    x += CAL.V * dt * Math.cos(h * Math.PI / 180);
    y += CAL.V * dt * Math.sin(h * Math.PI / 180);
    t += dt;
    traj.push({ x: x, y: y, h: h, t: t, seg: si, yaw: yaw });
    for (var wi = 0; wi < walls.length; wi++) {
      if (distToSeg([x, y], walls[wi][0], walls[wi][1]) < CAL.CAR_CLEAR) {
        hit = { x: x, y: y, t: t, seg: si };
        break;
      }
    }
  }
  return { traj: traj, hit: hit, segs: segs };
}

// ---- 最近墙点 (距离 + 墙上最近点坐标) ----
function closestWall(p, walls) {
  var bd = 1e9, bx = 0, by = 0;
  for (var i = 0; i < walls.length; i++) {
    var a = walls[i][0], b = walls[i][1];
    var vx = b[0] - a[0], vy = b[1] - a[1];
    var L2 = vx * vx + vy * vy;
    var t = L2 > 0 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    var cx = a[0] + t * vx, cy = a[1] + t * vy;
    var d = Math.hypot(p[0] - cx, p[1] - cy);
    if (d < bd) { bd = d; bx = cx; by = cy; }
  }
  return { d: bd, x: bx, y: by };
}

// ---- 自动修整: 仿真撞墙 -> 撞点插入推离墙的航点 -> 反复直到跑通 ----
function autoRoute(wps) {
  var walls = wallSegments();
  var route = wps.slice();
  for (var att = 0; att < 25; att++) {
    var segs = planRoute(route);
    var res = simulate(route[0], segs[0].legH, segs);
    if (!res.hit) return { route: route, segs: segs, res: res, fixes: att };
    var H = [res.hit.x, res.hit.y];
    var cw = closestWall(H, walls);
    var dx = H[0] - cw.x, dy = H[1] - cw.y, dl = Math.hypot(dx, dy) || 1;
    var push = CAL.CAR_CLEAR + 0.38;            // 推到离墙 ~0.53m
    var np = [+(cw.x + dx / dl * push).toFixed(3), +(cw.y + dy / dl * push).toFixed(3)];
    route.splice(res.hit.seg + 1, 0, np);       // 插在撞墙那段之后
  }
  var fs = planRoute(route);
  return { route: route, segs: fs, res: simulate(route[0], fs[0].legH, fs), fixes: -1 };
}

// ---- 浏览器导出 ----
if (typeof window !== 'undefined') {
  window.SIM = { OUTER: OUTER, INNER: INNER, WAYPOINTS: WAYPOINTS, CAL: CAL,
    wallSegments: wallSegments, planRoute: planRoute, simulate: simulate,
    closestWall: closestWall, autoRoute: autoRoute };
}

// ---- node 直跑: 验证 WP1-WP4 ----
if (typeof module !== 'undefined') {
  module.exports = { OUTER: OUTER, INNER: INNER, WAYPOINTS: WAYPOINTS, CAL: CAL,
    wallSegments: wallSegments, planRoute: planRoute, simulate: simulate, distToSeg: distToSeg,
    closestWall: closestWall, autoRoute: autoRoute };
  if (require.main === module) {
    var arg = process.argv[2];
    if (arg === 'calib') {
      console.log('=== 转弯模型校验 (单段 1000ms, 对比真车实测) ===');
      [30, 60, 90].forEach(function (a) {
        var r = simulate([0, 0], 0, [{ delta: -a, dur: 1000 }], true);
        var e = r.traj[r.traj.length - 1], peak = 0;
        for (var i = 1; i < r.traj.length; i++) {
          var d = Math.abs(r.traj[i].h - r.traj[i - 1].h) / 0.02;
          if (d > peak) peak = d;
        }
        console.log('  命令 -' + a + '° -> 仿真末角 ' + e.h.toFixed(1) +
          '°   峰值偏航 ' + peak.toFixed(0) + '°/s');
      });
      console.log('  真车实测:  -30->-32.0   -60->-65.7   -90->-97.8');
    } else {
      var N = arg ? parseInt(arg) : 4;
      var A = autoRoute(WAYPOINTS.slice(0, N));
      console.log('=== WP1-WP' + N + ' 路线算法 (原 ' + N + ' 航点 -> 修整 ' +
        A.route.length + ' 点, 自动修 ' + A.fixes + ' 次) ===');
      var setlap = [];
      A.segs.forEach(function (s, i) {
        console.log('  段' + (i + 1) + ': delta=' + s.delta + '°  dur=' + s.dur + 'ms');
        setlap.push(s.delta + ',' + s.dur);
      });
      console.log('  set_lap d=' + setlap.join(';'));
      console.log('  车放 (' + A.route[0] + '), 车头朝 ' + A.segs[0].legH.toFixed(1) + '°');
      console.log('--- 仿真结果 ---');
      if (!A.res || A.res.hit) {
        var h = A.res.hit;
        console.log('  X 25次仍未修好, 撞 段' + (h.seg + 1) + ' @ (' +
          h.x.toFixed(2) + ',' + h.y.toFixed(2) + ')');
      } else {
        var e = A.res.traj[A.res.traj.length - 1];
        var tgt = WAYPOINTS[N - 1];
        console.log('  OK 跑通! 用时 ' + e.t.toFixed(1) + 's, 终点 (' +
          e.x.toFixed(2) + ',' + e.y.toFixed(2) + ')  误差 ' +
          Math.hypot(e.x - tgt[0], e.y - tgt[1]).toFixed(2) + 'm');
      }
    }
  }
}
