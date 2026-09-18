// EI TOKEN 案例 · 点头摇头
// 用脖子上的两个舵机演三套动作：是 / 不是 / 歪头
// 适用：M5 StackChan（CoreS3）

#include <Arduino.h>
#include <M5StackChan.h>

// 角度单位是 0.1°，也就是 10 = 1°
//   yaw（左右转）范围 -1280 ~ 1280，正数向左
//   pitch（抬低头）范围 0 ~ 900，建议留边 50 ~ 850 不要顶死
//   speed 范围 0 ~ 1000
struct Frame_t {
  int yaw;
  int pitch;
  int speed;
  uint32_t hold;  // 这一帧停多久（毫秒）
};

// 「是」：连点三下头
static const Frame_t kYes[] = {
  {0, 450, 600, 300},
  {0, 200, 900, 260}, {0, 450, 900, 260},
  {0, 200, 900, 260}, {0, 450, 900, 260},
  {0, 200, 900, 260}, {0, 450, 600, 400},
};

// 「不是」：左右摇头
static const Frame_t kNo[] = {
  {0, 450, 600, 300},
  {350, 450, 800, 280}, {-350, 450, 800, 280},
  {350, 450, 800, 280}, {-350, 450, 800, 280},
  {0, 450, 600, 400},
};

// 「歪头」：转一点点 + 抬头，停住装可爱
static const Frame_t kTilt[] = {
  {0, 450, 600, 300},
  {260, 700, 400, 900},
  {-260, 700, 400, 900},
  {0, 450, 500, 500},
};

struct Action_t {
  const char *nm;
  const Frame_t *frames;
  int count;
};

static const Action_t kActions[] = {
  {"yes",  kYes,  sizeof(kYes)  / sizeof(Frame_t)},
  {"no",   kNo,   sizeof(kNo)   / sizeof(Frame_t)},
  {"tilt", kTilt, sizeof(kTilt) / sizeof(Frame_t)},
};
static const int kActionCount = sizeof(kActions) / sizeof(kActions[0]);

static int action_index = 0;

void playAction(const Action_t &a) {
  Serial.printf("action %s\n", a.nm);
  M5StackChan.Display().printf("> %s\n", a.nm);
  for (int i = 0; i < a.count; i++) {
    const Frame_t &f = a.frames[i];
    M5StackChan.Motion.move(f.yaw, f.pitch, f.speed);
    delay(f.hold);
  }
}

void setup() {
  Serial.begin(115200);
  M5StackChan.begin();

  M5StackChan.Display().setTextSize(2);
  M5StackChan.Display().setTextScroll(true);
  M5StackChan.Display().setTextColor(TFT_GREENYELLOW);
  M5StackChan.Display().printf("> nod / shake / tilt\n");

  // 连续动作里关掉自动对齐，动起来更顺，不会一帧一顿
  M5StackChan.Motion.setAutoAngleSyncEnabled(false);
  M5StackChan.Motion.goHome(500);
  delay(800);

  Serial.println("EIT sc-nod ready");
}

void loop() {
  M5StackChan.update();

  playAction(kActions[action_index]);
  action_index = (action_index + 1) % kActionCount;

  // 一轮做完回正，歇一会儿再来
  M5StackChan.Motion.goHome(500);
  delay(1200);
}
