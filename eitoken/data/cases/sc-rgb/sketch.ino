// EI TOKEN 案例 · 心情灯
// 机身两排共 12 颗 RGB，做呼吸和流水两种效果，按心情换配色
// 适用：M5 StackChan（CoreS3）

#include <Arduino.h>
#include <M5StackChan.h>

// 12 颗灯：下标 0~5 在左边，6~11 在右边
static const int kLedCount = 12;

struct Mood_t {
  const char *nm;
  uint8_t r, g, b;
};

// 四种心情配色，亮度压在 160 以内，眼睛舒服也省电
static const Mood_t kMoods[] = {
  {"calm",  0,   90,  160},  // 平静：青蓝
  {"happy", 170, 120, 0},    // 开心：暖黄
  {"angry", 170, 20,  0},    // 生气：红
  {"dream", 110, 0,   160},  // 发呆：紫
};
static const int kMoodCount = sizeof(kMoods) / sizeof(kMoods[0]);

static int mood_index = 0;
static bool flow_mode = false;  // false = 呼吸，true = 流水

// 呼吸：12 颗一起亮一起暗，用正弦算亮度最自然
void breathe(const Mood_t &m, uint32_t t) {
  float k = (sinf(t / 900.0f) + 1.0f) / 2.0f;   // 0 ~ 1
  k = 0.08f + k * 0.92f;                        // 留一点底亮度，别全黑
  for (int i = 0; i < kLedCount; i++) {
    M5StackChan.setRgbColor(i, m.r * k, m.g * k, m.b * k);
  }
  M5StackChan.refreshRgb();
}

// 流水：左右两排各跑一个亮点，尾巴逐颗变暗
void flow(const Mood_t &m, uint32_t t) {
  int head = (t / 90) % 6;
  for (int side = 0; side < 2; side++) {
    for (int i = 0; i < 6; i++) {
      int d = (i - head + 6) % 6;               // 离亮点几颗
      float k = (d == 0) ? 1.0f : (d == 1 ? 0.35f : (d == 2 ? 0.12f : 0.02f));
      M5StackChan.setRgbColor(side * 6 + i, m.r * k, m.g * k, m.b * k);
    }
  }
  M5StackChan.refreshRgb();
}

void setup() {
  Serial.begin(115200);
  M5StackChan.begin();

  // 只玩灯，不动脖子
  M5StackChan.setServoPowerEnabled(false);

  M5StackChan.Display().setTextSize(2);
  M5StackChan.Display().setTextScroll(true);
  M5StackChan.Display().setTextColor(TFT_GREENYELLOW);
  M5StackChan.Display().printf("> tap: mood\n> swipe: effect\n");

  Serial.println("EIT sc-rgb ready");
  Serial.printf("mood %s / effect breathe\n", kMoods[mood_index].nm);
}

void loop() {
  M5StackChan.update();

  // 点一下头顶换心情
  if (M5StackChan.TouchSensor.wasClicked()) {
    mood_index = (mood_index + 1) % kMoodCount;
    M5StackChan.Display().printf("> mood %s\n", kMoods[mood_index].nm);
    Serial.printf("mood %s\n", kMoods[mood_index].nm);
  }
  // 划一下换效果
  if (M5StackChan.TouchSensor.wasSwiped()) {
    flow_mode = !flow_mode;
    M5StackChan.Display().printf("> effect %s\n", flow_mode ? "flow" : "breathe");
    Serial.printf("effect %s\n", flow_mode ? "flow" : "breathe");
  }

  uint32_t t = millis();
  if (flow_mode) {
    flow(kMoods[mood_index], t);
  } else {
    breathe(kMoods[mood_index], t);
  }

  delay(20);
}
