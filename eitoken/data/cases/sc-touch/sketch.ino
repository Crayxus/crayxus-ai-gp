// EI TOKEN 案例 · 摸头有反应
// 头顶三个触摸区，摸哪一块就换一种表情、配一套动作
// 适用：M5 StackChan（CoreS3）

#include <Arduino.h>
#include <M5StackChan.h>
#include <Avatar.h>

using namespace m5avatar;

Avatar avatar;

// 三个触摸区的强度值在 getIntensities() 里：
//   下标 0 = 前（额头）、1 = 中（头顶）、2 = 后（后脑勺）
//   每个值 0 表示没碰，1~3 表示越按越重
static const char *kZoneName[3] = {"front", "middle", "back"};

static int last_zone = -1;

// 摸到某一区 → 一种表情 + 一种动作 + 一种灯色
void react(int zone) {
  switch (zone) {
    case 0:  // 摸额头：有点疑惑，往后仰
      avatar.setExpression(Expression::Doubt);
      M5StackChan.showRgbColor(0, 60, 120);
      M5StackChan.Motion.move(0, 750, 700);
      break;
    case 1:  // 摸头顶：最开心，连点头
      avatar.setExpression(Expression::Happy);
      M5StackChan.showRgbColor(120, 90, 0);
      M5StackChan.Motion.move(0, 250, 900);
      delay(250);
      M5StackChan.Motion.move(0, 550, 900);
      break;
    case 2:  // 摸后脑勺：吓一跳，回头看
      avatar.setExpression(Expression::Angry);
      M5StackChan.showRgbColor(140, 0, 0);
      M5StackChan.Motion.move(-500, 450, 900);
      break;
    default:
      break;
  }
  Serial.printf("touch %s\n", kZoneName[zone]);
}

void setup() {
  Serial.begin(115200);
  M5StackChan.begin();

  avatar.init();
  avatar.setIsAutoBlink(true);
  avatar.setExpression(Expression::Neutral);

  M5StackChan.Motion.goHome(500);
  delay(600);
  M5StackChan.Motion.move(0, 450, 500);  // 先摆一个平视的姿势

  Serial.println("EIT sc-touch ready");
}

void loop() {
  M5StackChan.update();

  // 从前到后划一下算一个手势，比单点更有意思
  if (M5StackChan.TouchSensor.wasSwipedForward()) {
    Serial.println("swipe forward");
    avatar.setExpression(Expression::Sleepy);
    M5StackChan.Motion.move(0, 150, 400);   // 舒服得低下头
    M5StackChan.showRgbColor(60, 0, 90);
  } else if (M5StackChan.TouchSensor.wasSwipedBackward()) {
    Serial.println("swipe backward");
    avatar.setExpression(Expression::Happy);
    M5StackChan.Motion.move(0, 800, 700);   // 精神一振抬起头
    M5StackChan.showRgbColor(0, 120, 60);
  }

  // 找出当前被摸的那一区（同时摸多块时取靠前的）
  const std::array<uint8_t, 3> &v = M5StackChan.TouchSensor.getIntensities();
  int zone = -1;
  for (int i = 0; i < 3; i++) {
    if (v[i] > 0) { zone = i; break; }
  }

  // 只在「刚碰上」的那一下反应，按着不放不重复触发
  if (zone >= 0 && zone != last_zone) {
    react(zone);
  }
  // 松手：恢复常态
  if (zone < 0 && last_zone >= 0) {
    avatar.setExpression(Expression::Neutral);
    M5StackChan.showRgbColor(0, 0, 0);
    M5StackChan.Motion.move(0, 450, 400);
    Serial.println("touch released");
  }
  last_zone = zone;

  delay(50);
}
